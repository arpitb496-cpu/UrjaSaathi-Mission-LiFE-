import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_PROJECT_URL = 'https://wzkpbofwajdbaqqrviqw.supabase.co';

export interface AuthenticatedUserProfile {
  /** Authenticated Supabase User UUID - assigned as the internal user ID */
  id: string;
  /** Authenticated Google user's display name (never hardcoded) */
  name: string;
  /** Verified email address from Google OAuth */
  email: string;
  /** Whether Google / Supabase confirmed the email address */
  emailVerified: boolean;
  /** Google profile picture URL where available */
  avatarUrl: string | null;
  /** Authentication provider (e.g., 'google') */
  provider: string;
}

export interface AuthSessionState {
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'expired' | 'error';
  user: AuthenticatedUserProfile | null;
  accessToken: string | null;
  expiresAt: number | null;
  errorMessage: string | null;
  errorType?: 'cancelled' | 'invalid_config' | 'expired' | 'auth_error' | null;
}

export interface OAuthCallbackParseResult {
  hasCallbackParams: boolean;
  code: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  errorCategory: 'cancelled' | 'invalid_config' | 'auth_error' | null;
  userFriendlyError: string | null;
}

export interface PublicSupabaseAuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
  configurationError: string | null;
}

/**
 * Validates that a candidate key is a safe public Supabase anon key
 * and NEVER a secret service_role key.
 */
export function isPublicAnonKeySafe(candidateKey: string | undefined | null): {
  valid: boolean;
  reason?: string;
} {
  if (!candidateKey || typeof candidateKey !== 'string' || !candidateKey.trim()) {
    return { valid: false, reason: 'Public Supabase anon key (VITE_SUPABASE_ANON_KEY) is not configured.' };
  }

  const trimmed = candidateKey.trim();

  if (trimmed.startsWith('sb_secret_') || trimmed.includes('service_role')) {
    return {
      valid: false,
      reason: 'SECURITY VIOLATION: Service-role key detected in browser configuration. Only the public anon key is permitted.',
    };
  }

  const parts = trimmed.split('.');
  if (parts.length === 3) {
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const jsonStr =
        typeof Buffer !== 'undefined'
          ? Buffer.from(padded, 'base64').toString('utf8')
          : typeof atob === 'function'
          ? atob(padded)
          : '';
      if (jsonStr) {
        const payload = JSON.parse(jsonStr);
        if (payload?.role === 'service_role') {
          return {
            valid: false,
            reason: 'SECURITY VIOLATION: JWT with role=service_role is forbidden in browser code.',
          };
        }
      }
    } catch {
      return { valid: false, reason: 'Malformed Supabase JWT key format.' };
    }
  }

  return { valid: true };
}

/**
 * Resolves the browser-side public Supabase configuration.
 */
export function resolveBrowserSupabaseConfig(overrides?: {
  url?: string;
  anonKey?: string;
}): PublicSupabaseAuthConfig {
  const metaEnv =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env
      : {};

  const rawUrl =
    overrides?.url ??
    metaEnv.VITE_SUPABASE_URL ??
    DEFAULT_SUPABASE_PROJECT_URL;

  const rawAnonKey =
    overrides?.anonKey ??
    metaEnv.VITE_SUPABASE_ANON_KEY ??
    '';

  const cleanUrl = String(rawUrl || DEFAULT_SUPABASE_PROJECT_URL)
    .trim()
    .replace(/\/+$/, '');

  if (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://')) {
    return {
      supabaseUrl: DEFAULT_SUPABASE_PROJECT_URL,
      supabaseAnonKey: '',
      isConfigured: false,
      configurationError: 'Invalid VITE_SUPABASE_URL format.',
    };
  }

  const keyCheck = isPublicAnonKeySafe(rawAnonKey);
  if (!keyCheck.valid) {
    return {
      supabaseUrl: cleanUrl,
      supabaseAnonKey: '',
      isConfigured: false,
      configurationError: keyCheck.reason || 'Supabase anon key is missing.',
    };
  }

  return {
    supabaseUrl: cleanUrl,
    supabaseAnonKey: String(rawAnonKey).trim(),
    isConfigured: true,
    configurationError: null,
  };
}

let cachedBrowserClient: SupabaseClient | null = null;
let cachedConfigSignature = '';

/**
 * Returns or initializes the singleton browser Supabase client configured for PKCE OAuth.
 */
export function getBrowserSupabaseClient(overrides?: {
  url?: string;
  anonKey?: string;
}): {
  client: SupabaseClient | null;
  config: PublicSupabaseAuthConfig;
} {
  const config = resolveBrowserSupabaseConfig(overrides);
  if (!config.isConfigured || !config.supabaseAnonKey) {
    return { client: null, config };
  }

  const signature = `${config.supabaseUrl}::${config.supabaseAnonKey.slice(0, 16)}`;
  if (cachedBrowserClient && cachedConfigSignature === signature && !overrides) {
    return { client: cachedBrowserClient, config };
  }

  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: typeof window !== 'undefined',
      detectSessionInUrl: typeof window !== 'undefined',
      storageKey: 'urjasaathi_supabase_auth_token',
    },
  });

  if (!overrides) {
    cachedBrowserClient = client;
    cachedConfigSignature = signature;
  }

  return { client, config };
}

/**
 * Extracts a normalized AuthenticatedUserProfile from a verified Supabase User object.
 * Never invents or hardcodes names or districts.
 */
export function extractGoogleUserProfile(
  user: Pick<User, 'id' | 'email' | 'email_confirmed_at' | 'user_metadata' | 'app_metadata'> | null | undefined
): AuthenticatedUserProfile | null {
  if (!user || typeof user.id !== 'string' || !user.id.trim()) {
    return null;
  }

  const meta = (user.user_metadata || {}) as Record<string, any>;
  const appMeta = (user.app_metadata || {}) as Record<string, any>;

  const rawName =
    typeof meta.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim()
      : typeof meta.name === 'string' && meta.name.trim()
      ? meta.name.trim()
      : typeof meta.user_name === 'string' && meta.user_name.trim()
      ? meta.user_name.trim()
      : '';

  const rawEmail = typeof user.email === 'string' ? user.email.trim() : '';

  const emailVerified = Boolean(
    user.email_confirmed_at ||
      meta.email_verified === true ||
      meta.verified === true
  );

  const rawAvatar =
    typeof meta.avatar_url === 'string' && meta.avatar_url.trim()
      ? meta.avatar_url.trim()
      : typeof meta.picture === 'string' && meta.picture.trim()
      ? meta.picture.trim()
      : null;

  const provider =
    typeof appMeta.provider === 'string' && appMeta.provider.trim()
      ? appMeta.provider.trim()
      : Array.isArray(appMeta.providers) && appMeta.providers.includes('google')
      ? 'google'
      : 'google';

  return {
    id: user.id.trim(),
    name: rawName,
    email: rawEmail,
    emailVerified,
    avatarUrl: rawAvatar,
    provider,
  };
}

/**
 * Checks if a Supabase Session has expired.
 */
export function isSessionExpired(
  session: Pick<Session, 'expires_at'> | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!session) return true;
  if (typeof session.expires_at === 'number') {
    // expires_at is in Unix seconds
    return session.expires_at * 1000 <= nowMs;
  }
  return false;
}

/**
 * Parses URL query parameters and hash fragments from an OAuth redirect callback
 * to detect PKCE authorization codes, cancelled logins, or invalid OAuth configuration.
 */
export function parseOAuthCallbackParams(
  searchOrFullUrl: string,
  hashFragment: string = ''
): OAuthCallbackParseResult {
  let searchPart = searchOrFullUrl || '';
  let hashPart = hashFragment || '';

  if (searchPart.startsWith('http://') || searchPart.startsWith('https://')) {
    try {
      const parsedUrl = new URL(searchPart);
      searchPart = parsedUrl.search;
      if (!hashPart) {
        hashPart = parsedUrl.hash;
      }
    } catch {
      // Fallback to raw string parsing
    }
  }

  const searchParams = new URLSearchParams(searchPart.startsWith('?') ? searchPart.slice(1) : searchPart);
  const cleanHash = hashPart.startsWith('#') ? hashPart.slice(1) : hashPart;
  const hashParams = new URLSearchParams(cleanHash);

  const code = searchParams.get('code') || hashParams.get('code') || null;
  const error = searchParams.get('error') || hashParams.get('error') || null;
  const errorCode = searchParams.get('error_code') || hashParams.get('error_code') || null;
  const rawDescription =
    searchParams.get('error_description') || hashParams.get('error_description') || null;
  const errorDescription = rawDescription ? decodeURIComponent(rawDescription.replace(/\+/g, ' ')) : null;

  if (!code && !error && !errorCode && !errorDescription) {
    return {
      hasCallbackParams: false,
      code: null,
      error: null,
      errorCode: null,
      errorDescription: null,
      errorCategory: null,
      userFriendlyError: null,
    };
  }

  if (error || errorCode || errorDescription) {
    const combined = `${error || ''} ${errorCode || ''} ${errorDescription || ''}`.toLowerCase();

    if (
      error === 'access_denied' ||
      combined.includes('cancel') ||
      combined.includes('access_denied') ||
      combined.includes('user denied')
    ) {
      return {
        hasCallbackParams: true,
        code: null,
        error: error || 'access_denied',
        errorCode,
        errorDescription,
        errorCategory: 'cancelled',
        userFriendlyError:
          'Google Sign-In was cancelled before completion. You can sign in anytime using "Continue with Google".',
      };
    }

    if (
      combined.includes('provider is not enabled') ||
      combined.includes('unsupported provider') ||
      combined.includes('unauthorized_client') ||
      combined.includes('invalid_client') ||
      combined.includes('redirect_uri_mismatch') ||
      combined.includes('oauth') ||
      error === 'invalid_request' ||
      error === 'unauthorized_client'
    ) {
      return {
        hasCallbackParams: true,
        code: null,
        error: error || 'invalid_oauth_config',
        errorCode,
        errorDescription,
        errorCategory: 'invalid_config',
        userFriendlyError:
          errorDescription ||
          'Google OAuth is not yet enabled or is misconfigured in the Supabase project settings. See GOOGLE_OAUTH_SETUP.md for setup steps.',
      };
    }

    return {
      hasCallbackParams: true,
      code: null,
      error: error || 'oauth_error',
      errorCode,
      errorDescription,
      errorCategory: 'auth_error',
      userFriendlyError:
        errorDescription || 'Authentication could not be completed. Please try signing in again.',
    };
  }

  return {
    hasCallbackParams: true,
    code: code ? code.trim() : null,
    error: null,
    errorCode: null,
    errorDescription: null,
    errorCategory: null,
    userFriendlyError: null,
  };
}

/**
 * Initiates Google Sign-In via Supabase Auth OAuth with PKCE flow.
 */
export async function initiateGoogleSignIn(options?: {
  client?: Pick<SupabaseClient, 'auth'> | null;
  redirectOrigin?: string;
  skipBrowserRedirect?: boolean;
}): Promise<{
  status: 'redirecting' | 'error';
  url?: string | null;
  errorType?: 'cancelled' | 'invalid_config' | 'auth_error';
  errorMessage?: string;
}> {
  const client = options?.client !== undefined ? options.client : getBrowserSupabaseClient().client;
  if (!client) {
    return {
      status: 'error',
      errorType: 'invalid_config',
      errorMessage:
        'Supabase Auth client is not initialized because VITE_SUPABASE_ANON_KEY is missing or invalid. Please configure your public anon key.',
    };
  }

  const origin =
    options?.redirectOrigin ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const redirectTo = `${origin.replace(/\/+$/, '')}/auth/callback`;

  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: Boolean(options?.skipBrowserRedirect),
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      const isConfigIssue =
        msg.includes('provider is not enabled') ||
        msg.includes('unsupported provider') ||
        msg.includes('client_id') ||
        msg.includes('invalid api key') ||
        msg.includes('redirect');
      return {
        status: 'error',
        errorType: isConfigIssue ? 'invalid_config' : 'auth_error',
        errorMessage: isConfigIssue
          ? `Google OAuth configuration error: ${error.message}. Ensure the Google provider and callback URL are enabled in Supabase Auth.`
          : error.message || 'Unable to start Google Sign-In.',
      };
    }

    if (!data?.url) {
      return {
        status: 'error',
        errorType: 'invalid_config',
        errorMessage: 'Supabase Auth did not return an OAuth authorization URL.',
      };
    }

    return {
      status: 'redirecting',
      url: data.url,
    };
  } catch (err: any) {
    return {
      status: 'error',
      errorType: 'auth_error',
      errorMessage: err?.message || 'Unexpected error starting Google Sign-In.',
    };
  }
}

/**
 * Exchanges a PKCE authorization code from the OAuth callback URL for a verified Supabase session.
 */
export async function handleOAuthCallbackExchange(options: {
  searchOrUrl: string;
  hash?: string;
  client?: Pick<SupabaseClient, 'auth'> | null;
  nowMs?: number;
}): Promise<AuthSessionState> {
  const parsed = parseOAuthCallbackParams(options.searchOrUrl, options.hash);

  if (parsed.errorCategory) {
    return {
      status: 'error',
      user: null,
      accessToken: null,
      expiresAt: null,
      errorMessage: parsed.userFriendlyError || 'Google Sign-In failed.',
      errorType: parsed.errorCategory,
    };
  }

  const client = options.client !== undefined ? options.client : getBrowserSupabaseClient().client;
  if (!client) {
    return {
      status: 'error',
      user: null,
      accessToken: null,
      expiresAt: null,
      errorMessage: 'Supabase Auth client is not configured.',
      errorType: 'invalid_config',
    };
  }

  if (parsed.code) {
    try {
      const { data, error } = await client.auth.exchangeCodeForSession(parsed.code);
      if (error || !data?.session || !data?.user) {
        const errMsg = error?.message || 'Failed to exchange OAuth authorization code for a session.';
        const isConfig =
          errMsg.toLowerCase().includes('provider') ||
          errMsg.toLowerCase().includes('client') ||
          errMsg.toLowerCase().includes('code verifier');
        return {
          status: 'error',
          user: null,
          accessToken: null,
          expiresAt: null,
          errorMessage: errMsg,
          errorType: isConfig ? 'invalid_config' : 'auth_error',
        };
      }

      if (isSessionExpired(data.session, options.nowMs)) {
        await client.auth.signOut().catch(() => {});
        return {
          status: 'expired',
          user: null,
          accessToken: null,
          expiresAt: data.session.expires_at ?? null,
          errorMessage: 'Your session has expired. Please sign in with Google again.',
          errorType: 'expired',
        };
      }

      const profile = extractGoogleUserProfile(data.user);
      if (!profile) {
        return {
          status: 'error',
          user: null,
          accessToken: null,
          expiresAt: null,
          errorMessage: 'Authenticated user record is missing a valid UUID.',
          errorType: 'auth_error',
        };
      }

      return {
        status: 'authenticated',
        user: profile,
        accessToken: data.session.access_token,
        expiresAt: data.session.expires_at ?? null,
        errorMessage: null,
        errorType: null,
      };
    } catch (err: any) {
      return {
        status: 'error',
        user: null,
        accessToken: null,
        expiresAt: null,
        errorMessage: err?.message || 'PKCE code exchange failed.',
        errorType: 'auth_error',
      };
    }
  }

  return restoreSupabaseSession({ client, nowMs: options.nowMs });
}

/**
 * Restores an existing Supabase session on page refresh and verifies it has not expired.
 */
export async function restoreSupabaseSession(options?: {
  client?: Pick<SupabaseClient, 'auth'> | null;
  nowMs?: number;
}): Promise<AuthSessionState> {
  const client = options?.client !== undefined ? options.client : getBrowserSupabaseClient().client;
  if (!client) {
    return {
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      expiresAt: null,
      errorMessage: null,
      errorType: null,
    };
  }

  try {
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      return {
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        expiresAt: null,
        errorMessage: error ? error.message : null,
        errorType: error ? 'auth_error' : null,
      };
    }

    if (isSessionExpired(data.session, options?.nowMs)) {
      await client.auth.signOut().catch(() => {});
      return {
        status: 'expired',
        user: null,
        accessToken: null,
        expiresAt: data.session.expires_at ?? null,
        errorMessage: 'Your Google session has expired. Please sign in again to access your account.',
        errorType: 'expired',
      };
    }

    const profile = extractGoogleUserProfile(data.session.user);
    if (!profile) {
      return {
        status: 'unauthenticated',
        user: null,
        accessToken: null,
        expiresAt: null,
        errorMessage: null,
        errorType: null,
      };
    }

    return {
      status: 'authenticated',
      user: profile,
      accessToken: data.session.access_token,
      expiresAt: data.session.expires_at ?? null,
      errorMessage: null,
      errorType: null,
    };
  } catch (err: any) {
    return {
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      expiresAt: null,
      errorMessage: err?.message || null,
      errorType: 'auth_error',
    };
  }
}

/**
 * Signs out the current user from Supabase Auth and clears session state.
 */
export async function signOutSupabaseUser(options?: {
  client?: Pick<SupabaseClient, 'auth'> | null;
}): Promise<AuthSessionState> {
  const client = options?.client !== undefined ? options.client : getBrowserSupabaseClient().client;
  if (client) {
    try {
      await client.auth.signOut();
    } catch {
      // Ignore network failure during local sign-out cleanup
    }
  }

  return {
    status: 'unauthenticated',
    user: null,
    accessToken: null,
    expiresAt: null,
    errorMessage: null,
    errorType: null,
  };
}
