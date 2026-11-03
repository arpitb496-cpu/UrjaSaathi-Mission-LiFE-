import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  type AppState,
  type CompletedMissionLog,
  DEFAULT_PROFILE,
  DEFAULT_USER_ID,
  type MissionCompletionResult,
  buildMissionCompletionKey,
  getDaysDifferenceIST,
  getIndiaDateString,
} from '../utils/storage.ts';
import type { HouseholdProfile } from '../utils/sustainabilityMath.ts';

/**
 * Row schema for `public.mission_completions` in Supabase PostgreSQL.
 * Enforces UNIQUE (user_id, mission_id, completion_date).
 */
export interface MissionCompletionRow {
  id?: number;
  user_id: string;
  mission_id: string;
  completion_date: string; // Asia/Kolkata YYYY-MM-DD
  points_awarded: number;
  co2_saved_kg: number;
  inr_saved: number;
  created_at: string; // ISO-8601 timestamp
}

/**
 * Row schema for `public.user_progress` in Supabase PostgreSQL.
 */
export interface UserProgressRow {
  user_id: string;
  total_points: number;
  total_co2_saved_kg: number;
  total_inr_saved: number;
  streak_days: number;
  last_active_date: string | null; // Asia/Kolkata YYYY-MM-DD
  updated_at: string;
}

/**
 * Row schema for `public.credential_records` in Supabase PostgreSQL.
 * Reusable persistent storage layer for Green Impact Passport QR verification.
 */
export interface CredentialRecordRow {
  credential_id: string;
  user_id: string;
  holder_name: string;
  district: string;
  green_score: number;
  total_points: number;
  co2_saved_kg: number;
  inr_saved: number;
  missions_completed: number;
  streak_days: number;
  payload_hash: string;
  qr_verification_path: string;
  status: 'active' | 'revoked';
  issued_at: string;
  verified_count: number;
  last_verified_at: string | null;
}

export interface UserHouseholdProfileRecord {
  user_id: string;
  email: string;
  email_verified: boolean;
  avatar_url: string | null;
  profile: HouseholdProfile;
  is_onboarded: boolean;
  updated_at: string;
}

export interface PersistenceStatusReport {
  persistenceMode: 'supabase_postgres' | 'local_demo_fallback';
  supabaseConfigured: boolean;
  durableStorageAvailable: boolean;
  uniqueConstraintName: 'uq_mission_completions_user_mission_date';
  persistenceNotice: string;
  persistenceWarning: string | null;
}

export interface VerifiedUserIdentity {
  authenticated: boolean;
  userId: string;
  email?: string;
  emailVerified?: boolean;
  fullName?: string;
  avatarUrl?: string | null;
  provider?: string;
  authMethod: 'supabase_jwt' | 'hmac_session_token' | 'server_issued_demo_session';
  sessionToken: string;
  bodyUserIdIgnored: boolean;
  error?: string;
}

export interface SupabaseSecurityAuditReport {
  passed: boolean;
  fixedSearchPathEmpty: boolean;
  allObjectsSchemaQualified: boolean;
  revokedFromPublicAnonAuthenticated: boolean;
  grantedToServiceRoleOnly: boolean;
  rlsEnabledAndForcedOnAllTables: boolean;
  credentialRecordsLockedDown: boolean;
  noPermissivePublicPolicies: boolean;
  findings: string[];
}

/**
 * Verifies that a candidate SUPABASE_SERVICE_ROLE_KEY is not an anonymous (`anon`) or
 * ordinary `authenticated` client token. If the key is a 3-part JWT, its decoded payload
 * role (when present) must be `service_role`.
 */
export function isTrustedServiceRoleKey(rawKey: string): boolean {
  const key = (rawKey || '').trim();
  if (
    key.length <= 20 ||
    key.includes('YOUR_SUPABASE') ||
    key.includes('PLACEHOLDER') ||
    key.startsWith('sb_publishable_')
  ) {
    return false;
  }

  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);
      if (payload && typeof payload.role === 'string') {
        return payload.role === 'service_role';
      }
    } catch {
      // Non-JSON middle segment in custom test key format; allow if not explicitly anon
    }
  }

  if (/\banon\b/i.test(key)) {
    return false;
  }

  return true;
}

/**
 * Programmatic Supabase Security Advisor for `20261102000001_production_persistence.sql`.
 * Audits SECURITY DEFINER search_path, schema qualification, function EXECUTE grants,
 * and RLS/table privilege lockdown on `credential_records`, `mission_completions`, and `user_progress`.
 */
export function auditSupabaseMigrationSecurity(sqlOverride?: string): SupabaseSecurityAuditReport {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase',
    'migrations',
    '20261102000001_production_persistence.sql'
  );
  const sql = sqlOverride ?? fs.readFileSync(migrationPath, 'utf8');
  const findings: string[] = [];

  // 1. Check SET search_path = '' on SECURITY DEFINER function
  const fixedSearchPathEmpty =
    /SECURITY\s+DEFINER\s+SET\s+search_path\s*=\s*''/i.test(sql);
  if (!fixedSearchPathEmpty) {
    findings.push("SECURITY DEFINER function is missing `SET search_path = ''`");
  }

  // 2. Extract function body between AS $$ and $$; and verify explicit schema qualification
  const fnBodyMatch = sql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.complete_mission_atomic[\s\S]*?AS\s+\$\$([\s\S]*?)\$\$/i);
  const fnBody = fnBodyMatch ? fnBodyMatch[1] : '';

  const hasQualifiedTables =
    fnBody.includes('public.user_progress') &&
    fnBody.includes('public.mission_completions') &&
    !/\b(?:FROM|INTO|UPDATE)\s+(?!public\.)(?:user_progress|mission_completions)\b/i.test(fnBody);

  const hasQualifiedCatalogCalls =
    fnBody.includes('pg_catalog.pg_advisory_xact_lock') &&
    fnBody.includes('pg_catalog.hashtext') &&
    fnBody.includes('pg_catalog.jsonb_build_object') &&
    fnBody.includes('pg_catalog.to_char') &&
    fnBody.includes('pg_catalog.now()');

  const allObjectsSchemaQualified = Boolean(fnBody && hasQualifiedTables && hasQualifiedCatalogCalls);
  if (!allObjectsSchemaQualified) {
    findings.push('Unqualified table or function reference detected inside complete_mission_atomic body');
  }

  // 3. Verify REVOKE EXECUTE for exact signature from PUBLIC, anon, authenticated
  const revokedFromPublicAnonAuthenticated =
    /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.complete_mission_atomic\(\s*TEXT\s*,\s*TEXT\s*,\s*DATE\s*,\s*INTEGER\s*,\s*NUMERIC\s*,\s*NUMERIC\s*\)\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\s*;/i.test(
      sql
    );
  if (!revokedFromPublicAnonAuthenticated) {
    findings.push(
      'Missing exact REVOKE EXECUTE ON FUNCTION public.complete_mission_atomic(TEXT, TEXT, DATE, INTEGER, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;'
    );
  }

  // 4. Verify GRANT EXECUTE for exact signature to service_role only
  const grantedToServiceRoleOnly =
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.complete_mission_atomic\(\s*TEXT\s*,\s*TEXT\s*,\s*DATE\s*,\s*INTEGER\s*,\s*NUMERIC\s*,\s*NUMERIC\s*\)\s+TO\s+service_role\s*;/i.test(
      sql
    ) &&
    !/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.complete_mission_atomic[\s\S]*?TO\s+(?:PUBLIC|anon|authenticated)/i.test(
      sql
    );
  if (!grantedToServiceRoleOnly) {
    findings.push(
      'Function execution is not exclusively granted to service_role'
    );
  }

  // 5. Verify RLS enabled and forced on all 3 tables
  const rlsEnabledAndForcedOnAllTables =
    /ALTER\s+TABLE\s+public\.mission_completions\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/i.test(sql) &&
    /ALTER\s+TABLE\s+public\.mission_completions\s+FORCE\s+ROW\s+LEVEL\s+SECURITY\s*;/i.test(sql) &&
    /ALTER\s+TABLE\s+public\.user_progress\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/i.test(sql) &&
    /ALTER\s+TABLE\s+public\.user_progress\s+FORCE\s+ROW\s+LEVEL\s+SECURITY\s*;/i.test(sql) &&
    /ALTER\s+TABLE\s+public\.credential_records\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\s*;/i.test(sql) &&
    /ALTER\s+TABLE\s+public\.credential_records\s+FORCE\s+ROW\s+LEVEL\s+SECURITY\s*;/i.test(sql);
  if (!rlsEnabledAndForcedOnAllTables) {
    findings.push('RLS is not both ENABLED and FORCED on all three persistence tables');
  }

  // 6. Verify credential_records cannot be read directly by anon or authenticated
  const credentialRecordsLockedDown =
    /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.credential_records\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\s*;/i.test(
      sql
    ) &&
    /GRANT\s+ALL\s+ON\s+TABLE\s+public\.credential_records\s+TO\s+service_role\s*;/i.test(sql) &&
    !/GRANT\s+(?:SELECT|ALL)[\s\S]*?ON\s+(?:TABLE\s+)?public\.credential_records\s+TO\s+(?:PUBLIC|anon|authenticated)/i.test(
      sql
    );
  if (!credentialRecordsLockedDown) {
    findings.push('credential_records is not strictly locked down to service_role');
  }

  // 7. Confirm no permissive RLS policies expose tables to anon or authenticated
  const noPermissivePublicPolicies = !/CREATE\s+POLICY[\s\S]*?ON\s+public\.(?:credential_records|mission_completions|user_progress)/i.test(
    sql
  );
  if (!noPermissivePublicPolicies) {
    findings.push('Unexpected RLS policy found on server-only tables');
  }

  return {
    passed:
      fixedSearchPathEmpty &&
      allObjectsSchemaQualified &&
      revokedFromPublicAnonAuthenticated &&
      grantedToServiceRoleOnly &&
      rlsEnabledAndForcedOnAllTables &&
      credentialRecordsLockedDown &&
      noPermissivePublicPolicies &&
      findings.length === 0,
    fixedSearchPathEmpty,
    allObjectsSchemaQualified,
    revokedFromPublicAnonAuthenticated,
    grantedToServiceRoleOnly,
    rlsEnabledAndForcedOnAllTables,
    credentialRecordsLockedDown,
    noPermissivePublicPolicies,
    findings,
  };
}

/**
 * Checks whether real Supabase PostgreSQL credentials are configured in the environment.
 * Never fakes configuration when credentials are missing, placeholder values, or non-service-role keys.
 */
export function getPersistenceStatus(env: NodeJS.ProcessEnv = process.env): PersistenceStatusReport {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: Supabase service-role persistence module must never be executed in the browser.');
  }

  const rawUrl = (env.SUPABASE_URL || '').trim();
  const rawKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  const isRealUrl =
    rawUrl.startsWith('https://') &&
    !rawUrl.includes('YOUR_SUPABASE') &&
    !rawUrl.includes('example.supabase.co') &&
    rawUrl.length > 15;
  const isRealKey = isTrustedServiceRoleKey(rawKey);

  const supabaseConfigured = Boolean(isRealUrl && isRealKey);

  if (supabaseConfigured) {
    return {
      persistenceMode: 'supabase_postgres',
      supabaseConfigured: true,
      durableStorageAvailable: true,
      uniqueConstraintName: 'uq_mission_completions_user_mission_date',
      persistenceNotice:
        'Durable production storage active: Supabase PostgreSQL with atomic transactions and UNIQUE (user_id, mission_id, completion_date) constraint.',
      persistenceWarning: null,
    };
  }

  return {
    persistenceMode: 'local_demo_fallback',
    supabaseConfigured: false,
    durableStorageAvailable: false,
    uniqueConstraintName: 'uq_mission_completions_user_mission_date',
    persistenceNotice:
      'Local Demo Mode: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured. Mission completions use the local demo relational ledger and browser cache with explicit persistence limitations.',
    persistenceWarning:
      'Persistent production storage (Supabase PostgreSQL) is unavailable because SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured in environment variables.',
  };
}

function getHmacSecret(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.URJASAATHI_SESSION_SECRET || env.SUPABASE_JWT_SECRET || '').trim();
  if (configured && configured.length >= 16) {
    return configured;
  }
  // Deterministic fallback key for local demo environment (never hardcoded as a production secret)
  return 'urjasaathi-local-demo-hmac-key-do-not-use-in-prod';
}

/**
 * Creates a server-signed HMAC-SHA256 session token binding the verified `userId`.
 * Format: `urja_sess.<base64url(JSON)>.<hmacHex>`
 */
export function createSignedSessionToken(
  userId: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const cleanUserId = (userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
  const payload = {
    sub: cleanUserId,
    iat: Math.floor(Date.now() / 1000),
    iss: 'urjasaathi-server',
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const hmac = crypto
    .createHmac('sha256', getHmacSecret(env))
    .update(payloadB64)
    .digest('hex');
  return `urja_sess.${payloadB64}.${hmac}`;
}

/**
 * Verifies a server-signed HMAC-SHA256 session token using constant-time comparison.
 */
export function verifySignedSessionToken(
  token: string,
  env: NodeJS.ProcessEnv = process.env
): { valid: boolean; userId?: string; error?: string } {
  if (!token || typeof token !== 'string' || !token.startsWith('urja_sess.')) {
    return { valid: false, error: 'Invalid session token prefix' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed session token structure' };
  }
  const [, payloadB64, providedHmac] = parts;
  const expectedHmac = crypto
    .createHmac('sha256', getHmacSecret(env))
    .update(payloadB64)
    .digest('hex');

  const providedBuf = Buffer.from(providedHmac, 'utf8');
  const expectedBuf = Buffer.from(expectedHmac, 'utf8');
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { valid: false, error: 'Session token cryptographic signature mismatch' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded.sub !== 'string' || !decoded.sub.trim()) {
      return { valid: false, error: 'Session token missing subject claim' };
    }
    return { valid: true, userId: decoded.sub.trim() };
  } catch {
    return { valid: false, error: 'Failed to decode session token payload' };
  }
}

/**
 * Computes a deterministic cryptographic HMAC-SHA256 hash for a Green Impact Passport credential record.
 */
export function computeCredentialPayloadHash(
  payload: {
    credential_id: string;
    user_id: string;
    green_score: number;
    total_points: number;
    co2_saved_kg: number;
    inr_saved: number;
    missions_completed: number;
  },
  env: NodeJS.ProcessEnv = process.env
): string {
  const canonical = [
    payload.credential_id,
    payload.user_id,
    String(payload.green_score),
    String(payload.total_points),
    Number(payload.co2_saved_kg).toFixed(2),
    Number(payload.inr_saved).toFixed(2),
    String(payload.missions_completed),
  ].join('|');

  return crypto
    .createHmac('sha256', getHmacSecret(env))
    .update(canonical)
    .digest('hex');
}

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedSupabaseUrl = '';

export function getSupabaseAdminClient(
  env: NodeJS.ProcessEnv = process.env
): SupabaseClient | null {
  const status = getPersistenceStatus(env);
  if (!status.supabaseConfigured) {
    return null;
  }
  const url = env.SUPABASE_URL!.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY!.trim();

  if (!cachedSupabaseClient || cachedSupabaseUrl !== url) {
    cachedSupabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedSupabaseUrl = url;
  }
  return cachedSupabaseClient;
}

/**
 * Verifies user identity server-side.
 * CRITICAL SECURITY RULE: Never trusts arbitrary `user_id` or `userId` values supplied in request bodies or query strings.
 * - If an Authorization Bearer token or `x-urjasaathi-session` header is provided, it MUST pass cryptographic verification.
 * - Supabase JWTs are verified server-side using `supabase.auth.getUser(token)`.
 * - User identity (`userId`, `email`, `fullName`, `avatarUrl`, `emailVerified`) is derived ONLY from the verified JWT.
 * - If a tampered or expired token is provided, returns `authenticated: false`.
 * - Any `user_id` / `userId` in the request body that differs from the verified token identity is ignored and flagged (`bodyUserIdIgnored: true`).
 */
export async function verifyServerUserIdentity(params: {
  authorizationHeader?: string;
  sessionHeader?: string;
  cookieHeader?: string;
  untrustedBodyUserId?: string;
  env?: NodeJS.ProcessEnv;
  customJwtVerifier?: (token: string) => Promise<{
    data: { user: any } | null;
    error: { message: string } | null;
  }>;
}): Promise<VerifiedUserIdentity> {
  const env = params.env || process.env;
  const untrustedBodyId = (params.untrustedBodyUserId || '').trim();

  // If an explicit Authorization header is sent, validate its Bearer format strictly
  if (typeof params.authorizationHeader === 'string' && params.authorizationHeader.trim()) {
    const trimmedAuth = params.authorizationHeader.trim();
    if (!trimmedAuth.startsWith('Bearer ')) {
      return {
        authenticated: false,
        userId: '',
        authMethod: 'supabase_jwt',
        sessionToken: '',
        bodyUserIdIgnored: Boolean(untrustedBodyId),
        error: 'Malformed Authorization header; expected Bearer <token>',
      };
    }
    const bearerCandidate = trimmedAuth.slice('Bearer '.length).trim();
    if (!bearerCandidate) {
      return {
        authenticated: false,
        userId: '',
        authMethod: 'supabase_jwt',
        sessionToken: '',
        bodyUserIdIgnored: Boolean(untrustedBodyId),
        error: 'Empty Bearer token in Authorization header',
      };
    }
  }

  // Extract token from Authorization: Bearer <token>, X-UrjaSaathi-Session header, or Cookie
  let rawToken = '';
  let cameFromBearerHeader = false;
  if (params.authorizationHeader && params.authorizationHeader.trim().startsWith('Bearer ')) {
    rawToken = params.authorizationHeader.trim().slice('Bearer '.length).trim();
    cameFromBearerHeader = true;
  } else if (params.sessionHeader && params.sessionHeader.trim()) {
    rawToken = params.sessionHeader.trim();
  } else if (params.cookieHeader) {
    const match = params.cookieHeader.match(/(?:^|;\s*)urjasaathi_session=([^;]+)/);
    if (match && match[1]) {
      rawToken = decodeURIComponent(match[1].trim());
    }
  }

  // Case 1: Client presented an explicit token
  if (rawToken) {
    // 1a. Check if it is an HMAC-signed UrjaSaathi session token
    if (rawToken.startsWith('urja_sess.')) {
      const verified = verifySignedSessionToken(rawToken, env);
      if (!verified.valid || !verified.userId) {
        return {
          authenticated: false,
          userId: '',
          authMethod: 'hmac_session_token',
          sessionToken: '',
          bodyUserIdIgnored: Boolean(untrustedBodyId),
          error: verified.error || 'Invalid session token signature',
        };
      }
      const bodyIgnored = Boolean(untrustedBodyId && untrustedBodyId !== verified.userId);
      return {
        authenticated: true,
        userId: verified.userId,
        authMethod: 'hmac_session_token',
        sessionToken: rawToken,
        bodyUserIdIgnored: bodyIgnored,
      };
    }

    // 1b. Pre-validate JWT structure and expiration (`exp` claim) before or alongside Supabase verification
    const jwtParts = rawToken.split('.');
    if (jwtParts.length === 3) {
      try {
        const payloadRaw = Buffer.from(jwtParts[1], 'base64url').toString('utf8');
        const payload = JSON.parse(payloadRaw);
        if (payload && typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
          return {
            authenticated: false,
            userId: '',
            authMethod: 'supabase_jwt',
            sessionToken: '',
            bodyUserIdIgnored: Boolean(untrustedBodyId),
            error: 'Supabase Auth JWT has expired',
          };
        }
      } catch {
        return {
          authenticated: false,
          userId: '',
          authMethod: 'supabase_jwt',
          sessionToken: '',
          bodyUserIdIgnored: Boolean(untrustedBodyId),
          error: 'Malformed JWT payload in Bearer token',
        };
      }
    }

    // 1c. Verify Supabase Auth JWT server-side via supabase.auth.getUser(token) (or customJwtVerifier in tests)
    const supabase = getSupabaseAdminClient(env);
    if (params.customJwtVerifier || supabase) {
      const { data, error } = params.customJwtVerifier
        ? await params.customJwtVerifier(rawToken)
        : await supabase!.auth.getUser(rawToken);
      if (error || !data?.user?.id) {
        return {
          authenticated: false,
          userId: '',
          authMethod: 'supabase_jwt',
          sessionToken: '',
          bodyUserIdIgnored: Boolean(untrustedBodyId),
          error: error?.message || 'Invalid or tampered Supabase Auth Bearer token',
        };
      }
      const verifiedUser = data.user;
      const verifiedId = String(verifiedUser.id).trim();
      const userMeta = (verifiedUser.user_metadata || {}) as Record<string, any>;
      const appMeta = (verifiedUser.app_metadata || {}) as Record<string, any>;

      const fullName =
        typeof userMeta.full_name === 'string' && userMeta.full_name.trim()
          ? userMeta.full_name.trim()
          : typeof userMeta.name === 'string' && userMeta.name.trim()
          ? userMeta.name.trim()
          : '';

      const avatarUrl =
        typeof userMeta.avatar_url === 'string' && userMeta.avatar_url.trim()
          ? userMeta.avatar_url.trim()
          : typeof userMeta.picture === 'string' && userMeta.picture.trim()
          ? userMeta.picture.trim()
          : null;

      const emailVerified = Boolean(
        verifiedUser.email_confirmed_at ||
          userMeta.email_verified === true ||
          userMeta.verified === true
      );

      return {
        authenticated: true,
        userId: verifiedId,
        email: typeof verifiedUser.email === 'string' ? verifiedUser.email.trim() : '',
        emailVerified,
        fullName,
        avatarUrl,
        provider: typeof appMeta.provider === 'string' ? appMeta.provider : 'google',
        authMethod: 'supabase_jwt',
        sessionToken: rawToken,
        bodyUserIdIgnored: Boolean(untrustedBodyId && untrustedBodyId !== verifiedId),
      };
    }

    // Token presented is neither a valid HMAC session token nor verifiable via Supabase Auth
    return {
      authenticated: false,
      userId: '',
      authMethod: cameFromBearerHeader ? 'supabase_jwt' : 'hmac_session_token',
      sessionToken: '',
      bodyUserIdIgnored: Boolean(untrustedBodyId),
      error: 'Unrecognized or tampered authentication token',
    };
  }

  // Case 2: No token presented — bind to the server-issued default household session
  // IMPORTANT: Never adopt `untrustedBodyUserId` from the request body!
  const canonicalDemoUserId = DEFAULT_USER_ID;
  const sessionToken = createSignedSessionToken(canonicalDemoUserId, env);
  return {
    authenticated: true,
    userId: canonicalDemoUserId,
    authMethod: 'server_issued_demo_session',
    sessionToken,
    bodyUserIdIgnored: Boolean(untrustedBodyId && untrustedBodyId !== canonicalDemoUserId),
  };
}

/**
 * Error thrown when a direct insertion into `mission_completions` violates the
 * database `UNIQUE (user_id, mission_id, completion_date)` constraint.
 */
export class UniqueConstraintViolationError extends Error {
  public readonly code = '23505';
  public readonly constraint = 'uq_mission_completions_user_mission_date';

  constructor(userId: string, missionId: string, completionDate: string) {
    super(
      `duplicate key value violates unique constraint "uq_mission_completions_user_mission_date" Detail: Key (user_id, mission_id, completion_date)=(${userId}, ${missionId}, ${completionDate}) already exists.`
    );
    this.name = 'UniqueConstraintViolationError';
  }
}

interface RelationalLedgerSchema {
  mission_completions: MissionCompletionRow[];
  user_progress: Record<string, UserProgressRow>;
  credential_records: Record<string, CredentialRecordRow>;
  user_profiles: Record<string, UserHouseholdProfileRecord>;
  user_chat_history: Record<string, any[]>;
}

function resolveDefaultLedgerFilePath(env: NodeJS.ProcessEnv = process.env): string {
  // On Vercel / Serverless runtimes, /var/task is read-only; use os.tmpdir() (/tmp) when local fallback is used.
  if (env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'urjasaathi-data', 'urjasaathi_relational_ledger.json');
  }
  return path.resolve(process.cwd(), '.data', 'urjasaathi_relational_ledger.json');
}

/**
 * Durable Relational Ledger Engine that persists directly to disk (or Supabase PostgreSQL when configured).
 * - Does NOT rely on in-memory JavaScript Maps or Promise chains across requests.
 * - Uses OS-level exclusive lockfiles (`O_CREAT | O_EXCL`) + atomic temp-file rename so
 *   separate server instances and server restarts share the exact same durable state and
 *   enforce `UNIQUE (user_id, mission_id, completion_date)` at the storage layer.
 */
export class DurablePersistenceEngine {
  private readonly ledgerFilePath: string;
  private readonly lockFilePath: string;
  private readonly env: NodeJS.ProcessEnv;

  constructor(options?: { ledgerFilePath?: string; env?: NodeJS.ProcessEnv }) {
    this.env = options?.env || process.env;
    this.ledgerFilePath = options?.ledgerFilePath || resolveDefaultLedgerFilePath(this.env);
    this.lockFilePath = `${this.ledgerFilePath}.lock`;
  }

  public getStatus(): PersistenceStatusReport {
    return getPersistenceStatus(this.env);
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.ledgerFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Acquires an OS-level atomic file lock (`O_CREAT | O_EXCL`) to serialize database
   * transactions across concurrent requests and multiple processes without relying on in-memory locks.
   */
  private async withDatabaseTransaction<T>(fn: (db: RelationalLedgerSchema) => T | Promise<T>): Promise<T> {
    this.ensureDirectory();
    const maxWaitMs = 8000;
    const start = Date.now();
    let lockFd: number | null = null;

    while (lockFd === null) {
      try {
        lockFd = fs.openSync(this.lockFilePath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR);
      } catch (err: any) {
        if (err?.code === 'EEXIST') {
          // Check for stale lock older than 5 seconds
          try {
            const stat = fs.statSync(this.lockFilePath);
            if (Date.now() - stat.mtimeMs > 5000) {
              fs.unlinkSync(this.lockFilePath);
              continue;
            }
          } catch {
            // Lock was just released
          }
          if (Date.now() - start > maxWaitMs) {
            throw new Error('Database transaction lock acquisition timed out');
          }
          await new Promise((r) => setTimeout(r, 8));
        } else {
          throw err;
        }
      }
    }

    try {
      const db = this.readLedgerFromDisk();
      const result = await fn(db);
      this.writeLedgerAtomicallyToDisk(db);
      return result;
    } finally {
      try {
        if (lockFd !== null) {
          fs.closeSync(lockFd);
        }
      } catch {
        // Ignore close error
      }
      try {
        if (fs.existsSync(this.lockFilePath)) {
          fs.unlinkSync(this.lockFilePath);
        }
      } catch {
        // Ignore unlink error
      }
    }
  }

  private readLedgerFromDisk(): RelationalLedgerSchema {
    this.ensureDirectory();
    if (!fs.existsSync(this.ledgerFilePath)) {
      const initial = this.createSeededLedger();
      this.writeLedgerAtomicallyToDisk(initial);
      return initial;
    }
    try {
      const raw = fs.readFileSync(this.ledgerFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        mission_completions: Array.isArray(parsed.mission_completions) ? parsed.mission_completions : [],
        user_progress: parsed.user_progress && typeof parsed.user_progress === 'object' ? parsed.user_progress : {},
        credential_records:
          parsed.credential_records && typeof parsed.credential_records === 'object'
            ? parsed.credential_records
            : {},
        user_profiles:
          parsed.user_profiles && typeof parsed.user_profiles === 'object'
            ? parsed.user_profiles
            : {},
        user_chat_history:
          parsed.user_chat_history && typeof parsed.user_chat_history === 'object'
            ? parsed.user_chat_history
            : {},
      };
    } catch {
      const initial = this.createSeededLedger();
      this.writeLedgerAtomicallyToDisk(initial);
      return initial;
    }
  }

  private writeLedgerAtomicallyToDisk(db: RelationalLedgerSchema): void {
    this.ensureDirectory();
    const tmpFile = `${this.ledgerFilePath}.${process.pid}.${Date.now()}.${Math.random()
      .toString(36)
      .slice(2, 7)}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, this.ledgerFilePath);
  }

  private createSeededLedger(now: Date = new Date()): RelationalLedgerSchema {
    const userId = DEFAULT_USER_ID;
    const yesterdayDate = new Date(now.getTime() - 86400000);
    const twoDaysAgoDate = new Date(now.getTime() - 2 * 86400000);
    const yesterdayIST = getIndiaDateString(yesterdayDate);
    const twoDaysAgoIST = getIndiaDateString(twoDaysAgoDate);

    return {
      mission_completions: [
        {
          id: 1,
          user_id: userId,
          mission_id: 'm-phantom-power',
          completion_date: twoDaysAgoIST,
          points_awarded: 20,
          co2_saved_kg: 1.2,
          inr_saved: 9,
          created_at: twoDaysAgoDate.toISOString(),
        },
        {
          id: 2,
          user_id: userId,
          mission_id: 'm-ac-24',
          completion_date: yesterdayIST,
          points_awarded: 25,
          co2_saved_kg: 2.8,
          inr_saved: 22,
          created_at: yesterdayDate.toISOString(),
        },
      ],
      user_progress: {
        [userId]: {
          user_id: userId,
          total_points: 45,
          total_co2_saved_kg: 4.0,
          total_inr_saved: 31,
          streak_days: 4,
          last_active_date: yesterdayIST,
          updated_at: yesterdayDate.toISOString(),
        },
      },
      credential_records: {},
      user_profiles: {},
      user_chat_history: {},
    };
  }

  /**
   * Direct database table insertion into `mission_completions` that strictly enforces
   * the `UNIQUE (user_id, mission_id, completion_date)` constraint (`code: '23505'`).
   * Used both by atomic transactions and by regression tests verifying duplicate database insertion rejection.
   */
  public async insertMissionCompletionRow(row: {
    user_id: string;
    mission_id: string;
    completion_date: string;
    points_awarded: number;
    co2_saved_kg?: number;
    inr_saved?: number;
  }): Promise<MissionCompletionRow> {
    const supabase = getSupabaseAdminClient(this.env);
    if (supabase) {
      const { data, error } = await supabase
        .from('mission_completions')
        .insert({
          user_id: row.user_id,
          mission_id: row.mission_id,
          completion_date: row.completion_date,
          points_awarded: row.points_awarded,
          co2_saved_kg: row.co2_saved_kg ?? 0,
          inr_saved: row.inr_saved ?? 0,
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          throw new UniqueConstraintViolationError(row.user_id, row.mission_id, row.completion_date);
        }
        throw new Error(`Supabase mission_completions insert failed: ${error.message}`);
      }
      return data as MissionCompletionRow;
    }

    return this.withDatabaseTransaction((db) => {
      const duplicate = db.mission_completions.find(
        (existing) =>
          existing.user_id === row.user_id &&
          existing.mission_id === row.mission_id &&
          existing.completion_date === row.completion_date
      );
      if (duplicate) {
        throw new UniqueConstraintViolationError(row.user_id, row.mission_id, row.completion_date);
      }

      const created: MissionCompletionRow = {
        id: db.mission_completions.length + 1,
        user_id: row.user_id,
        mission_id: row.mission_id,
        completion_date: row.completion_date,
        points_awarded: Math.max(0, Number(row.points_awarded) || 0),
        co2_saved_kg: Math.max(0, Number(row.co2_saved_kg) || 0),
        inr_saved: Math.max(0, Number(row.inr_saved) || 0),
        created_at: new Date().toISOString(),
      };
      db.mission_completions.push(created);
      return created;
    });
  }

  /**
   * Executes an atomic mission completion transaction against Supabase PostgreSQL (`complete_mission_atomic`)
   * or the durable relational ledger when running in local demo mode.
   */
  public async completeMissionAtomically(params: {
    verifiedUserId: string;
    mission: {
      id: string;
      title: string;
      points: number;
      co2SavedKg?: number;
      inrSaved?: number;
    };
    now?: Date;
  }): Promise<MissionCompletionResult & PersistenceStatusReport> {
    const now = params.now || new Date();
    const completionDate = getIndiaDateString(now);
    const userId = params.verifiedUserId.trim() || DEFAULT_USER_ID;
    const missionId = String(params.mission.id).trim();
    const completionKey = buildMissionCompletionKey(userId, missionId, completionDate);
    const statusReport = this.getStatus();

    const supabase = getSupabaseAdminClient(this.env);
    if (supabase) {
      // Execute atomic PostgreSQL transaction via stored RPC function `complete_mission_atomic`
      const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_mission_atomic', {
        p_user_id: userId,
        p_mission_id: missionId,
        p_completion_date: completionDate,
        p_points: Math.max(0, Number(params.mission.points) || 0),
        p_co2_saved_kg: Math.max(0, Number(params.mission.co2SavedKg) || 0),
        p_inr_saved: Math.max(0, Number(params.mission.inrSaved) || 0),
      });

      if (rpcError) {
        throw new Error(`Supabase atomic mission transaction failed: ${rpcError.message}`);
      }

      const authoritativeState = await this.getUserAuthoritativeState(userId, now);
      const isDuplicate = Boolean(rpcResult?.duplicate || rpcResult?.status === 'already_completed');
      const pointsAwarded = isDuplicate ? 0 : Number(rpcResult?.points_awarded) || 0;
      const streakDays = Number(rpcResult?.streak_days) ?? authoritativeState.streakDays;
      const streakIncremented = Boolean(rpcResult?.streak_incremented);

      return {
        status: isDuplicate ? 'already_completed' : 'completed',
        duplicate: isDuplicate,
        userId,
        missionId,
        completionKey,
        completionDate,
        pointsAwarded,
        streakDays,
        streakIncremented,
        message: isDuplicate
          ? `"${params.mission.title}" is already completed today (${completionDate}). Come back tomorrow!`
          : `Completed "${params.mission.title}"! +${pointsAwarded} LiFE points credited.${
              streakIncremented ? ` Daily streak is now ${streakDays} ${streakDays === 1 ? 'day' : 'days'}!` : ''
            }`,
        state: authoritativeState,
        ...statusReport,
      };
    }

    // Local Demo Fallback Mode: Execute inside atomic OS-locked disk transaction
    return this.withDatabaseTransaction((db) => {
      let progress = db.user_progress[userId];
      if (!progress) {
        progress = {
          user_id: userId,
          total_points: 0,
          total_co2_saved_kg: 0,
          total_inr_saved: 0,
          streak_days: 0,
          last_active_date: null,
          updated_at: now.toISOString(),
        };
        db.user_progress[userId] = progress;
      }

      // Reconcile missed calendar day (Asia/Kolkata)
      let currentStreak = Math.max(0, Number(progress.streak_days) || 0);
      if (progress.last_active_date) {
        const diffDays = getDaysDifferenceIST(progress.last_active_date, completionDate);
        if (diffDays > 1) {
          currentStreak = 0;
        }
      } else {
        currentStreak = 0;
      }

      // Enforce UNIQUE (user_id, mission_id, completion_date) constraint inside transaction
      const existingRow = db.mission_completions.find(
        (r) =>
          r.user_id === userId &&
          r.mission_id === missionId &&
          r.completion_date === completionDate
      );

      if (existingRow) {
        progress.streak_days = currentStreak;
        const stateSnapshot = this.buildAppStateFromLedger(db, userId, now);
        return {
          status: 'already_completed',
          duplicate: true,
          userId,
          missionId,
          completionKey,
          completionDate,
          pointsAwarded: 0,
          streakDays: currentStreak,
          streakIncremented: false,
          message: `"${params.mission.title}" is already completed today (${completionDate}). Come back tomorrow!`,
          state: stateSnapshot,
          ...statusReport,
        };
      }

      const points = Math.max(0, Number(params.mission.points) || 0);
      const co2SavedKg = Math.max(0, Number(params.mission.co2SavedKg) || 0);
      const inrSaved = Math.max(0, Number(params.mission.inrSaved) || 0);

      // Insert new row into mission_completions
      const newRow: MissionCompletionRow = {
        id: db.mission_completions.length + 1,
        user_id: userId,
        mission_id: missionId,
        completion_date: completionDate,
        points_awarded: points,
        co2_saved_kg: co2SavedKg,
        inr_saved: inrSaved,
        created_at: now.toISOString(),
      };
      db.mission_completions.push(newRow);

      // Compute consecutive streak in Asia/Kolkata
      let nextStreak = currentStreak;
      let streakIncremented = false;

      if (progress.last_active_date === completionDate) {
        nextStreak = Math.max(1, currentStreak);
        streakIncremented = false;
      } else if (
        progress.last_active_date &&
        getDaysDifferenceIST(progress.last_active_date, completionDate) === 1
      ) {
        nextStreak = Math.max(1, currentStreak) + 1;
        streakIncremented = true;
      } else {
        nextStreak = 1;
        streakIncremented = true;
      }

      progress.total_points += points;
      progress.total_co2_saved_kg = Number((progress.total_co2_saved_kg + co2SavedKg).toFixed(2));
      progress.total_inr_saved = Number((progress.total_inr_saved + inrSaved).toFixed(2));
      progress.streak_days = nextStreak;
      progress.last_active_date =
        !progress.last_active_date || completionDate > progress.last_active_date
          ? completionDate
          : progress.last_active_date;
      progress.updated_at = now.toISOString();

      const stateSnapshot = this.buildAppStateFromLedger(db, userId, now);
      return {
        status: 'completed',
        duplicate: false,
        userId,
        missionId,
        completionKey,
        completionDate,
        pointsAwarded: points,
        streakDays: nextStreak,
        streakIncremented,
        message: `Completed "${params.mission.title}"! +${points} LiFE points credited.${
          streakIncremented ? ` Daily streak is now ${nextStreak} ${nextStreak === 1 ? 'day' : 'days'}!` : ''
        }`,
        state: stateSnapshot,
        ...statusReport,
      };
    });
  }

  /**
   * Retrieves or initializes a user's isolated household profile.
   * - Never hardcodes names or districts.
   * - Never copies anonymous/demo profile records into an authenticated user's profile.
   */
  public async getUserHouseholdProfile(
    userId: string,
    authMetadata?: {
      name?: string;
      email?: string;
      emailVerified?: boolean;
      avatarUrl?: string | null;
    }
  ): Promise<UserHouseholdProfileRecord> {
    const cleanUserId = (userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;

    // 1. Check local relational ledger first
    const localRecord = await this.withDatabaseTransaction(
      (db) => db.user_profiles[cleanUserId] || null
    );
    if (localRecord) {
      // If Google auth provided a fresh verified email or avatar, keep it synced
      if (authMetadata?.email || authMetadata?.avatarUrl) {
        const nextEmail = authMetadata.email || localRecord.email;
        const nextAvatar = authMetadata.avatarUrl ?? localRecord.avatar_url;
        const nextName =
          localRecord.profile.name && localRecord.profile.name.trim()
            ? localRecord.profile.name
            : (authMetadata.name || '').trim();
        if (
          nextEmail !== localRecord.email ||
          nextAvatar !== localRecord.avatar_url ||
          nextName !== localRecord.profile.name
        ) {
          return this.saveUserHouseholdProfile(cleanUserId, {
            profile: { ...localRecord.profile, name: nextName },
            isOnboarded: localRecord.is_onboarded,
            email: nextEmail,
            emailVerified: authMetadata.emailVerified ?? localRecord.email_verified,
            avatarUrl: nextAvatar,
          });
        }
      }
      return localRecord;
    }

    // 2. If Supabase Admin is configured and userId is a UUID, check Supabase Auth user_metadata
    const supabase = getSupabaseAdminClient(this.env);
    if (supabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUserId)) {
      try {
        const { data } = await supabase.auth.admin.getUserById(cleanUserId);
        const user = data?.user;
        if (user) {
          const meta = (user.user_metadata || {}) as Record<string, any>;
          const savedHousehold = meta.urjasaathi_household_profile as HouseholdProfile | undefined;
          const googleName =
            typeof meta.full_name === 'string' && meta.full_name.trim()
              ? meta.full_name.trim()
              : typeof meta.name === 'string' && meta.name.trim()
              ? meta.name.trim()
              : (authMetadata?.name || '').trim();

          const hydratedProfile: HouseholdProfile = savedHousehold
            ? {
                ...DEFAULT_PROFILE,
                ...savedHousehold,
                name: (savedHousehold.name || googleName || '').trim(),
                city: (savedHousehold.city || '').trim(),
                district: (savedHousehold.district || '').trim(),
              }
            : {
                ...DEFAULT_PROFILE,
                name: googleName,
                city: '',
                district: '',
              };

          const hydratedRecord: UserHouseholdProfileRecord = {
            user_id: cleanUserId,
            email: user.email || authMetadata?.email || '',
            email_verified: Boolean(
              user.email_confirmed_at || meta.email_verified || authMetadata?.emailVerified
            ),
            avatar_url: meta.avatar_url || meta.picture || authMetadata?.avatarUrl || null,
            profile: hydratedProfile,
            is_onboarded: Boolean(meta.urjasaathi_onboarded && hydratedProfile.district),
            updated_at: new Date().toISOString(),
          };

          await this.withDatabaseTransaction((db) => {
            db.user_profiles[cleanUserId] = hydratedRecord;
          });
          return hydratedRecord;
        }
      } catch {
        // Fallback to creating clean profile record below
      }
    }

    // 3. Initialize a clean, un-onboarded profile record (never hardcodes names or districts)
    const cleanInitialProfile: HouseholdProfile = {
      ...DEFAULT_PROFILE,
      name: (authMetadata?.name || '').trim(),
      city: '',
      district: '',
    };

    const newRecord: UserHouseholdProfileRecord = {
      user_id: cleanUserId,
      email: (authMetadata?.email || '').trim(),
      email_verified: Boolean(authMetadata?.emailVerified),
      avatar_url: authMetadata?.avatarUrl ?? null,
      profile: cleanInitialProfile,
      is_onboarded: false,
      updated_at: new Date().toISOString(),
    };

    return this.withDatabaseTransaction((db) => {
      db.user_profiles[cleanUserId] = newRecord;
      return newRecord;
    });
  }

  /**
   * Saves a user's isolated household profile and onboarding status.
   */
  public async saveUserHouseholdProfile(
    userId: string,
    params: {
      profile: Partial<HouseholdProfile>;
      isOnboarded?: boolean;
      email?: string;
      emailVerified?: boolean;
      avatarUrl?: string | null;
    }
  ): Promise<UserHouseholdProfileRecord> {
    const cleanUserId = (userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
    const sanitizedProfile: HouseholdProfile = {
      name: String(params.profile.name ?? '').trim(),
      city: String(params.profile.city ?? '').trim(),
      district: String(params.profile.district ?? '').trim(),
      familyMembers: Math.max(1, Number(params.profile.familyMembers) || DEFAULT_PROFILE.familyMembers),
      monthlyKwh: Math.max(0, Number(params.profile.monthlyKwh) || DEFAULT_PROFILE.monthlyKwh),
      monthlyBillInr: Math.max(0, Number(params.profile.monthlyBillInr) || DEFAULT_PROFILE.monthlyBillInr),
      appliances: Array.isArray(params.profile.appliances)
        ? params.profile.appliances.map((a) => String(a))
        : [...DEFAULT_PROFILE.appliances],
      rooftopAvailableSqFt: Math.max(
        0,
        Number(params.profile.rooftopAvailableSqFt ?? DEFAULT_PROFILE.rooftopAvailableSqFt)
      ),
      hasSolarInstalled: Boolean(params.profile.hasSolarInstalled),
    };

    const isOnboarded =
      typeof params.isOnboarded === 'boolean'
        ? params.isOnboarded
        : Boolean(sanitizedProfile.name && sanitizedProfile.district);

    const saved = await this.withDatabaseTransaction((db) => {
      const existing = db.user_profiles[cleanUserId];
      const nextRecord: UserHouseholdProfileRecord = {
        user_id: cleanUserId,
        email: (params.email ?? existing?.email ?? '').trim(),
        email_verified: params.emailVerified ?? existing?.email_verified ?? false,
        avatar_url: params.avatarUrl !== undefined ? params.avatarUrl : existing?.avatar_url ?? null,
        profile: sanitizedProfile,
        is_onboarded: isOnboarded,
        updated_at: new Date().toISOString(),
      };
      db.user_profiles[cleanUserId] = nextRecord;
      return nextRecord;
    });

    // Also persist to Supabase Auth user_metadata when userId is a Supabase UUID
    const supabase = getSupabaseAdminClient(this.env);
    if (supabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUserId)) {
      try {
        await supabase.auth.admin.updateUserById(cleanUserId, {
          user_metadata: {
            urjasaathi_household_profile: sanitizedProfile,
            urjasaathi_onboarded: isOnboarded,
          },
        });
      } catch {
        // Non-fatal if test UUID does not exist in remote Supabase Auth users table
      }
    }

    return saved;
  }

  /**
   * Retrieves a user's isolated AI conversation history.
   */
  public async getUserChatHistory(userId: string): Promise<any[]> {
    const cleanUserId = (userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
    return this.withDatabaseTransaction((db) => {
      const list = db.user_chat_history[cleanUserId];
      return Array.isArray(list) ? [...list] : [];
    });
  }

  /**
   * Saves a user's isolated AI conversation history.
   */
  public async saveUserChatHistory(userId: string, messages: any[]): Promise<any[]> {
    const cleanUserId = (userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
    const bounded = Array.isArray(messages) ? messages.slice(-40) : [];
    return this.withDatabaseTransaction((db) => {
      db.user_chat_history[cleanUserId] = bounded;
      return [...bounded];
    });
  }

  /**
   * Retrieves the authoritative mission completion state for a user without incrementing streak on load.
   */
  public async getUserAuthoritativeState(userId: string, now: Date = new Date()): Promise<AppState> {
    const cleanUserId = (userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
    const todayIST = getIndiaDateString(now);

    const supabase = getSupabaseAdminClient(this.env);
    if (supabase) {
      const [{ data: rows, error: rowsErr }, { data: progressRow, error: progErr }, profileRecord] =
        await Promise.all([
          supabase
            .from('mission_completions')
            .select('*')
            .eq('user_id', cleanUserId)
            .order('completion_date', { ascending: true }),
          supabase
            .from('user_progress')
            .select('*')
            .eq('user_id', cleanUserId)
            .maybeSingle(),
          this.getUserHouseholdProfile(cleanUserId),
        ]);

      if (rowsErr) {
        throw new Error(`Failed to fetch mission_completions from Supabase: ${rowsErr.message}`);
      }
      if (progErr) {
        throw new Error(`Failed to fetch user_progress from Supabase: ${progErr.message}`);
      }

      const completedMissions: Record<string, CompletedMissionLog> = {};
      for (const r of (rows || []) as MissionCompletionRow[]) {
        const key = buildMissionCompletionKey(r.user_id, r.mission_id, r.completion_date);
        completedMissions[key] = {
          completionKey: key,
          userId: r.user_id,
          missionId: r.mission_id,
          completionDate: r.completion_date,
          completedAt: r.created_at,
          points: Number(r.points_awarded) || 0,
          co2SavedKg: Number(r.co2_saved_kg) || 0,
          inrSaved: Number(r.inr_saved) || 0,
        };
      }

      let streakDays = Math.max(0, Number(progressRow?.streak_days) || 0);
      const lastActiveDate = progressRow?.last_active_date || '';
      if (lastActiveDate) {
        const diff = getDaysDifferenceIST(lastActiveDate, todayIST);
        if (diff > 1) {
          streakDays = 0;
        }
      } else {
        streakDays = 0;
      }

      return {
        userId: cleanUserId,
        profile: profileRecord?.profile || DEFAULT_PROFILE,
        isOnboarded: Boolean(profileRecord?.is_onboarded),
        completedMissions,
        streakDays,
        lastActiveDate,
        badges: ['LiFE Pioneer', 'AC Whisperer', 'GEDA Enthusiast'],
      };
    }

    return this.withDatabaseTransaction((db) => {
      return this.buildAppStateFromLedger(db, cleanUserId, now);
    });
  }

  private buildAppStateFromLedger(
    db: RelationalLedgerSchema,
    userId: string,
    now: Date = new Date()
  ): AppState {
    const todayIST = getIndiaDateString(now);
    const userRows = db.mission_completions.filter((r) => r.user_id === userId);
    const completedMissions: Record<string, CompletedMissionLog> = {};
    let latestDate = db.user_progress[userId]?.last_active_date || '';

    for (const r of userRows) {
      const key = buildMissionCompletionKey(r.user_id, r.mission_id, r.completion_date);
      completedMissions[key] = {
        completionKey: key,
        userId: r.user_id,
        missionId: r.mission_id,
        completionDate: r.completion_date,
        completedAt: r.created_at,
        points: Number(r.points_awarded) || 0,
        co2SavedKg: Number(r.co2_saved_kg) || 0,
        inrSaved: Number(r.inr_saved) || 0,
      };
      if (r.completion_date > latestDate) {
        latestDate = r.completion_date;
      }
    }

    let streakDays = Math.max(0, Number(db.user_progress[userId]?.streak_days) || 0);
    if (latestDate) {
      const diff = getDaysDifferenceIST(latestDate, todayIST);
      if (diff > 1) {
        streakDays = 0;
      }
    } else {
      streakDays = 0;
    }

    const storedProfile = db.user_profiles?.[userId];

    return {
      userId,
      profile: storedProfile?.profile ? { ...storedProfile.profile } : { ...DEFAULT_PROFILE },
      isOnboarded: Boolean(storedProfile?.is_onboarded),
      completedMissions,
      streakDays,
      lastActiveDate: latestDate,
      badges: ['LiFE Pioneer', 'AC Whisperer', 'GEDA Enthusiast'],
    };
  }

  /**
   * Lists all raw rows in `mission_completions` for a given user (for auditing & verification).
   */
  public async getMissionCompletionRows(userId: string): Promise<MissionCompletionRow[]> {
    const cleanUserId = (userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
    const supabase = getSupabaseAdminClient(this.env);
    if (supabase) {
      const { data, error } = await supabase
        .from('mission_completions')
        .select('*')
        .eq('user_id', cleanUserId)
        .order('id', { ascending: true });
      if (error) {
        throw new Error(`Supabase mission_completions query failed: ${error.message}`);
      }
      return (data || []) as MissionCompletionRow[];
    }

    return this.withDatabaseTransaction((db) =>
      db.mission_completions.filter((r) => r.user_id === cleanUserId)
    );
  }

  // ==========================================================================
  // REUSABLE PERSISTENT CREDENTIAL-RECORD STORAGE LAYER (QR Verification)
  // ==========================================================================

  /**
   * Generates a cryptographically random nonce (`crypto.randomBytes(16)`) and derives
   * the holder's verification token (`uvt_<32hexNonce>_<24hexHmac>`). Only the SHA-256
   * hash of the verification token (`th=<tokenHash>`) is persisted in the database.
   */
  public deriveVerificationTokenFromNonce(credentialId: string, nonce: string): string {
    const cleanNonce = (nonce || '').trim();
    const tag = crypto
      .createHmac('sha256', getHmacSecret(this.env))
      .update(`urja_vtok:${credentialId}:${cleanNonce}`)
      .digest('hex')
      .slice(0, 24);
    return `uvt_${cleanNonce}_${tag}`;
  }

  public computeTokenSha256(rawToken: string): string {
    return crypto
      .createHash('sha256')
      .update((rawToken || '').trim())
      .digest('hex');
  }

  private encodeQrMetadataPath(params: {
    credentialId: string;
    tokenHash: string;
    nonce: string;
    publicDisplayConsent: boolean;
    unlockedBadgeIds: string[];
  }): string {
    const search = new URLSearchParams();
    search.set('th', params.tokenHash);
    search.set('n', params.nonce);
    search.set('c', params.publicDisplayConsent ? '1' : '0');
    if (params.unlockedBadgeIds.length > 0) {
      search.set('b', params.unlockedBadgeIds.join(','));
    }
    return `/api/passport/credentials/${encodeURIComponent(params.credentialId)}/verify?${search.toString()}`;
  }

  private decodeQrMetadataPath(qrPath: string): {
    tokenHash: string | null;
    nonce: string | null;
    publicDisplayConsent: boolean;
    unlockedBadgeIds: string[];
  } {
    const raw = (qrPath || '').trim();
    const qIdx = raw.indexOf('?');
    if (qIdx === -1) {
      return {
        tokenHash: null,
        nonce: null,
        publicDisplayConsent: true,
        unlockedBadgeIds: ['pioneer'],
      };
    }
    const search = new URLSearchParams(raw.slice(qIdx + 1));
    const tokenHash = search.get('th');
    const nonce = search.get('n');
    const consentRaw = search.get('c');
    const badgesRaw = search.get('b');
    return {
      tokenHash: tokenHash && tokenHash.trim() ? tokenHash.trim() : null,
      nonce: nonce && nonce.trim() ? nonce.trim() : null,
      publicDisplayConsent: consentRaw !== '0',
      unlockedBadgeIds: badgesRaw
        ? badgesRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : ['pioneer'],
    };
  }

  /**
   * Issues or updates a persistent Green Impact Passport credential record derived
   * from the authoritative server-side mission completion ledger.
   * Keeps `payload_hash` as a pure 64-char HMAC-SHA256 hex digest and stores the
   * 64-char SHA-256 `tokenHash` in `qr_verification_path` metadata (`th=<tokenHash>`).
   */
  public async upsertCredentialRecord(params: {
    verifiedUserId: string;
    holderName?: string;
    district?: string;
    greenScore?: number;
    publicDisplayConsent?: boolean;
    unlockedBadgeIds?: string[];
    rotateToken?: boolean;
    now?: Date;
  }): Promise<{
    record: CredentialRecordRow;
    verificationToken: string;
    tokenHash: string;
    publicDisplayConsent: boolean;
    unlockedBadgeIds: string[];
    statusReport: PersistenceStatusReport;
  }> {
    const now = params.now || new Date();
    const userId = (params.verifiedUserId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
    const authoritativeState = await this.getUserAuthoritativeState(userId, now);
    const completionLogs = Object.values(authoritativeState.completedMissions);

    const totalPoints = completionLogs.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
    const co2SavedKg = Number(
      completionLogs.reduce((sum, item) => sum + (Number(item.co2SavedKg) || 0), 0).toFixed(2)
    );
    const inrSaved = Number(
      completionLogs.reduce((sum, item) => sum + (Number(item.inrSaved) || 0), 0).toFixed(2)
    );
    const missionsCompleted = completionLogs.length;

    const deterministicSuffix = crypto
      .createHash('sha256')
      .update(userId)
      .digest('hex')
      .slice(0, 8)
      .toUpperCase();
    const credentialId = `GEDA-LIFE-2026-${deterministicSuffix}`;
    const greenScore = Math.min(100, Math.max(0, Number(params.greenScore) || 74));

    const supabase = getSupabaseAdminClient(this.env);
    let existingRow: CredentialRecordRow | null = null;

    if (supabase) {
      const { data } = await supabase
        .from('credential_records')
        .select('*')
        .eq('credential_id', credentialId)
        .maybeSingle();
      if (data) {
        existingRow = data as CredentialRecordRow;
      }
    } else {
      existingRow = await this.withDatabaseTransaction(
        (db) => db.credential_records[credentialId] || null
      );
    }

    if (existingRow && existingRow.user_id && existingRow.user_id !== userId) {
      throw new Error('Forbidden: Cannot modify a Green Impact Passport owned by another user.');
    }

    const existingMeta = existingRow
      ? this.decodeQrMetadataPath(existingRow.qr_verification_path)
      : null;

    const nonce =
      !params.rotateToken && existingMeta?.nonce && /^[0-9a-f]+$/i.test(existingMeta.nonce)
        ? existingMeta.nonce
        : crypto.randomBytes(16).toString('hex');

    const publicDisplayConsent =
      typeof params.publicDisplayConsent === 'boolean'
        ? params.publicDisplayConsent
        : existingMeta
        ? existingMeta.publicDisplayConsent
        : true;

    const unlockedBadgeIds =
      params.unlockedBadgeIds && params.unlockedBadgeIds.length > 0
        ? params.unlockedBadgeIds
        : existingMeta?.unlockedBadgeIds || ['pioneer'];

    const verificationToken = this.deriveVerificationTokenFromNonce(credentialId, nonce);
    const tokenHash = this.computeTokenSha256(verificationToken);

    const payloadHmac = computeCredentialPayloadHash(
      {
        credential_id: credentialId,
        user_id: userId,
        green_score: greenScore,
        total_points: totalPoints,
        co2_saved_kg: co2SavedKg,
        inr_saved: inrSaved,
        missions_completed: missionsCompleted,
      },
      this.env
    );

    const qrVerificationPath = this.encodeQrMetadataPath({
      credentialId,
      tokenHash,
      nonce,
      publicDisplayConsent,
      unlockedBadgeIds,
    });

    const record: CredentialRecordRow = {
      credential_id: credentialId,
      user_id: userId,
      holder_name:
        (params.holderName || '').trim() ||
        existingRow?.holder_name ||
        'Verified Household Citizen',
      district: (params.district || '').trim() || existingRow?.district || 'Gujarat',
      green_score: greenScore,
      total_points: totalPoints,
      co2_saved_kg: co2SavedKg,
      inr_saved: inrSaved,
      missions_completed: missionsCompleted,
      streak_days: authoritativeState.streakDays,
      payload_hash: payloadHmac,
      qr_verification_path: qrVerificationPath,
      status: existingRow?.status === 'revoked' && !params.rotateToken ? 'revoked' : 'active',
      issued_at: existingRow?.issued_at || now.toISOString(),
      verified_count: existingRow ? Number(existingRow.verified_count) || 0 : 0,
      last_verified_at: existingRow ? existingRow.last_verified_at : null,
    };

    const statusReport = this.getStatus();
    if (supabase) {
      const { data, error } = await supabase
        .from('credential_records')
        .upsert(record, { onConflict: 'credential_id' })
        .select('*')
        .single();
      if (error) {
        throw new Error(`Supabase credential_records upsert failed: ${error.message}`);
      }
      return {
        record: data as CredentialRecordRow,
        verificationToken,
        tokenHash,
        publicDisplayConsent,
        unlockedBadgeIds,
        statusReport,
      };
    }

    return this.withDatabaseTransaction((db) => {
      db.credential_records[credentialId] = record;
      return {
        record: { ...record },
        verificationToken,
        tokenHash,
        publicDisplayConsent,
        unlockedBadgeIds,
        statusReport,
      };
    });
  }

  /**
   * Updates credential status (`active` | `revoked`), public display consent, or rotates the token.
   */
  public async updateCredentialLifecycle(params: {
    verifiedUserId: string;
    status?: 'active' | 'revoked';
    publicDisplayConsent?: boolean;
    rotateToken?: boolean;
  }): Promise<{
    record: CredentialRecordRow;
    verificationToken: string;
    tokenHash: string;
    publicDisplayConsent: boolean;
    unlockedBadgeIds: string[];
    statusReport: PersistenceStatusReport;
  }> {
    const upserted = await this.upsertCredentialRecord({
      verifiedUserId: params.verifiedUserId,
      publicDisplayConsent: params.publicDisplayConsent,
      rotateToken: params.rotateToken,
    });

    if (!params.status || params.status === upserted.record.status) {
      return upserted;
    }

    const updatedRecord: CredentialRecordRow = {
      ...upserted.record,
      status: params.status,
    };

    const supabase = getSupabaseAdminClient(this.env);
    if (supabase) {
      const { data, error } = await supabase
        .from('credential_records')
        .update({ status: params.status })
        .eq('credential_id', updatedRecord.credential_id)
        .select('*')
        .single();
      if (error) {
        throw new Error(`Supabase credential status update failed: ${error.message}`);
      }
      return {
        ...upserted,
        record: data as CredentialRecordRow,
      };
    }

    return this.withDatabaseTransaction((db) => {
      db.credential_records[updatedRecord.credential_id] = updatedRecord;
      return {
        ...upserted,
        record: { ...updatedRecord },
      };
    });
  }

  /**
   * Verifies a Green Impact Passport credential by cryptographic verification token (`uvt_...`)
   * or by `credential_id` (`GEDA-LIFE-...`), returning a privacy-filtered public verification report.
   * Never exposes private electricity bills (`inr_saved`), phone numbers, or internal `user_id`.
   */
  public async verifyPublicPassportToken(rawTokenOrId: string): Promise<{
    verified: boolean;
    verificationState: 'verified' | 'revoked' | 'invalid_token' | 'unknown_token';
    signatureValid: boolean;
    statusReport: PersistenceStatusReport;
    reason?: string;
    publicCredential: {
      passportId: string;
      credentialStatus: 'active' | 'revoked';
      holderDisplayName: string;
      publicDisplayConsent: boolean;
      district: string;
      greenScore: number;
      missionsCompleted: number;
      co2SavedKg: number;
      streakDays: number;
      unlockedBadgeIds: string[];
      issuedAt: string;
      verifiedCount: number;
      lastVerifiedAt: string | null;
      tokenHashPrefix: string;
      isDemoCredential: boolean;
    } | null;
  }> {
    const candidate = (rawTokenOrId || '').trim();
    const statusReport = this.getStatus();

    // 1. Validate structural format
    if (!candidate || candidate.length < 8 || candidate.length > 160 || /[^\w\-.:]/.test(candidate)) {
      return {
        verified: false,
        verificationState: 'invalid_token',
        signatureValid: false,
        statusReport,
        reason: 'Malformed or invalid passport verification token format.',
        publicCredential: null,
      };
    }

    const isTokenFormat = candidate.startsWith('uvt_');
    const isPassportIdFormat = candidate.startsWith('GEDA-LIFE-');

    if (!isTokenFormat && !isPassportIdFormat) {
      return {
        verified: false,
        verificationState: 'invalid_token',
        signatureValid: false,
        statusReport,
        reason: 'Invalid verification token prefix.',
        publicCredential: null,
      };
    }

    if (isTokenFormat) {
      const parts = candidate.split('_');
      if (parts.length !== 3 || parts[1].length < 8 || parts[2].length < 10) {
        return {
          verified: false,
          verificationState: 'invalid_token',
          signatureValid: false,
          statusReport,
          reason: 'Invalid cryptographic token structure.',
          publicCredential: null,
        };
      }
    }

    const candidateTokenHash = isTokenFormat ? this.computeTokenSha256(candidate) : null;
    const supabase = getSupabaseAdminClient(this.env);
    let matchedRow: CredentialRecordRow | null = null;

    if (supabase) {
      if (isTokenFormat && candidateTokenHash) {
        const { data } = await supabase
          .from('credential_records')
          .select('*')
          .like('qr_verification_path', `%th=${candidateTokenHash}%`)
          .maybeSingle();
        if (data) {
          matchedRow = data as CredentialRecordRow;
        }
      } else if (isPassportIdFormat) {
        const { data } = await supabase
          .from('credential_records')
          .select('*')
          .eq('credential_id', candidate)
          .maybeSingle();
        if (data) {
          matchedRow = data as CredentialRecordRow;
        }
      }
    } else {
      matchedRow = await this.withDatabaseTransaction((db) => {
        if (isTokenFormat && candidateTokenHash) {
          return (
            Object.values(db.credential_records).find((r) =>
              r.qr_verification_path.includes(`th=${candidateTokenHash}`)
            ) || null
          );
        }
        if (isPassportIdFormat) {
          return db.credential_records[candidate] || null;
        }
        return null;
      });
    }

    if (!matchedRow) {
      return {
        verified: false,
        verificationState: 'unknown_token',
        signatureValid: false,
        statusReport,
        reason: isTokenFormat
          ? 'Unknown or expired passport verification token.'
          : 'Unknown Passport ID.',
        publicCredential: null,
      };
    }

    const meta = this.decodeQrMetadataPath(matchedRow.qr_verification_path);
    const storedTokenHash = meta.tokenHash;

    const expectedPayloadHmac = computeCredentialPayloadHash(
      {
        credential_id: matchedRow.credential_id,
        user_id: matchedRow.user_id,
        green_score: Number(matchedRow.green_score),
        total_points: Number(matchedRow.total_points),
        co2_saved_kg: Number(matchedRow.co2_saved_kg),
        inr_saved: Number(matchedRow.inr_saved),
        missions_completed: Number(matchedRow.missions_completed),
      },
      this.env
    );

    const tokenMatches =
      !isTokenFormat || (storedTokenHash !== null && storedTokenHash === candidateTokenHash);
    const hmacMatches = matchedRow.payload_hash === expectedPayloadHmac;
    const signatureValid = Boolean(tokenMatches && hmacMatches);

    const holderDisplayName = meta.publicDisplayConsent
      ? matchedRow.holder_name
      : 'Verified Household Citizen (Public Name Withheld)';

    if (matchedRow.status === 'revoked') {
      return {
        verified: false,
        verificationState: 'revoked',
        signatureValid: false,
        statusReport,
        reason: 'This Green Impact Passport credential has been revoked and is no longer active.',
        publicCredential: {
          passportId: matchedRow.credential_id,
          credentialStatus: 'revoked',
          holderDisplayName,
          publicDisplayConsent: meta.publicDisplayConsent,
          district: matchedRow.district,
          greenScore: Number(matchedRow.green_score),
          missionsCompleted: Number(matchedRow.missions_completed),
          co2SavedKg: Number(matchedRow.co2_saved_kg),
          streakDays: Number(matchedRow.streak_days),
          unlockedBadgeIds: meta.unlockedBadgeIds,
          issuedAt: matchedRow.issued_at,
          verifiedCount: Number(matchedRow.verified_count) || 0,
          lastVerifiedAt: matchedRow.last_verified_at,
          tokenHashPrefix: (storedTokenHash || matchedRow.payload_hash).slice(0, 16),
          isDemoCredential: !statusReport.durableStorageAvailable,
        },
      };
    }

    if (!signatureValid) {
      return {
        verified: false,
        verificationState: 'invalid_token',
        signatureValid: false,
        statusReport,
        reason: 'Cryptographic payload hash mismatch.',
        publicCredential: null,
      };
    }

    // Increment verification counter for valid active credential
    const nextCount = (Number(matchedRow.verified_count) || 0) + 1;
    const verifiedAt = new Date().toISOString();

    if (supabase) {
      await supabase
        .from('credential_records')
        .update({ verified_count: nextCount, last_verified_at: verifiedAt })
        .eq('credential_id', matchedRow.credential_id);
    } else {
      await this.withDatabaseTransaction((db) => {
        if (db.credential_records[matchedRow!.credential_id]) {
          db.credential_records[matchedRow!.credential_id].verified_count = nextCount;
          db.credential_records[matchedRow!.credential_id].last_verified_at = verifiedAt;
        }
      });
    }

    return {
      verified: true,
      verificationState: 'verified',
      signatureValid: true,
      statusReport,
      publicCredential: {
        passportId: matchedRow.credential_id,
        credentialStatus: 'active',
        holderDisplayName,
        publicDisplayConsent: meta.publicDisplayConsent,
        district: matchedRow.district,
        greenScore: Number(matchedRow.green_score),
        missionsCompleted: Number(matchedRow.missions_completed),
        co2SavedKg: Number(matchedRow.co2_saved_kg),
        streakDays: Number(matchedRow.streak_days),
        unlockedBadgeIds: meta.unlockedBadgeIds,
        issuedAt: matchedRow.issued_at,
        verifiedCount: nextCount,
        lastVerifiedAt: verifiedAt,
        tokenHashPrefix: (storedTokenHash || matchedRow.payload_hash).slice(0, 16),
        isDemoCredential: !statusReport.durableStorageAvailable,
      },
    };
  }

  /**
   * Verifies a Green Impact Passport credential record by `credential_id` for QR scanning.
   * Recomputes the cryptographic `payload_hash` and increments `verified_count`.
   */
  public async verifyCredentialRecord(credentialId: string): Promise<{
    verified: boolean;
    signatureValid: boolean;
    record: CredentialRecordRow | null;
    statusReport: PersistenceStatusReport;
    reason?: string;
  }> {
    const cleanId = (credentialId || '').trim();
    const statusReport = this.getStatus();
    if (!cleanId) {
      return {
        verified: false,
        signatureValid: false,
        record: null,
        statusReport,
        reason: 'Missing credential_id',
      };
    }

    const supabase = getSupabaseAdminClient(this.env);
    if (supabase) {
      const { data, error } = await supabase
        .from('credential_records')
        .select('*')
        .eq('credential_id', cleanId)
        .maybeSingle();

      if (error || !data) {
        return {
          verified: false,
          signatureValid: false,
          record: null,
          statusReport,
          reason: error?.message || 'Credential record not found',
        };
      }

      const row = data as CredentialRecordRow;
      const expectedHash = computeCredentialPayloadHash(
        {
          credential_id: row.credential_id,
          user_id: row.user_id,
          green_score: Number(row.green_score),
          total_points: Number(row.total_points),
          co2_saved_kg: Number(row.co2_saved_kg),
          inr_saved: Number(row.inr_saved),
          missions_completed: Number(row.missions_completed),
        },
        this.env
      );

      const signatureValid = row.payload_hash === expectedHash && row.status === 'active';
      if (signatureValid) {
        const nextCount = (Number(row.verified_count) || 0) + 1;
        const verifiedAt = new Date().toISOString();
        await supabase
          .from('credential_records')
          .update({ verified_count: nextCount, last_verified_at: verifiedAt })
          .eq('credential_id', cleanId);
        row.verified_count = nextCount;
        row.last_verified_at = verifiedAt;
      }

      return {
        verified: signatureValid,
        signatureValid,
        record: row,
        statusReport,
        reason: signatureValid ? undefined : 'Credential signature mismatch or revoked',
      };
    }

    return this.withDatabaseTransaction((db) => {
      const row = db.credential_records[cleanId];
      if (!row) {
        return {
          verified: false,
          signatureValid: false,
          record: null,
          statusReport,
          reason: 'Credential record not found in ledger',
        };
      }

      const expectedHash = computeCredentialPayloadHash(
        {
          credential_id: row.credential_id,
          user_id: row.user_id,
          green_score: Number(row.green_score),
          total_points: Number(row.total_points),
          co2_saved_kg: Number(row.co2_saved_kg),
          inr_saved: Number(row.inr_saved),
          missions_completed: Number(row.missions_completed),
        },
        this.env
      );

      const signatureValid = row.payload_hash === expectedHash && row.status === 'active';
      if (signatureValid) {
        row.verified_count = (Number(row.verified_count) || 0) + 1;
        row.last_verified_at = new Date().toISOString();
      }

      return {
        verified: signatureValid,
        signatureValid,
        record: { ...row },
        statusReport,
        reason: signatureValid ? undefined : 'Credential signature mismatch or revoked',
      };
    });
  }
}
