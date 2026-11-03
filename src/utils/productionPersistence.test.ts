import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DurablePersistenceEngine,
  UniqueConstraintViolationError,
  createSignedSessionToken,
  getPersistenceStatus,
  verifyServerUserIdentity,
} from '../db/supabasePersistence.ts';
import { calculateUserAggregates } from './storage.ts';

const TEST_DAY_1_IST = new Date('2026-11-02T06:30:00.000Z'); // 2026-11-02 12:00 IST
const TEST_DAY_2_IST = new Date('2026-11-03T06:30:00.000Z'); // 2026-11-03 12:00 IST

const TEST_MISSION = {
  id: 'm-solar-clean',
  title: 'Clean Solar Panels & Check Inverter',
  points: 50,
  co2SavedKg: 2.4,
  inrSaved: 45,
};

describe('Production Persistence Hardening Suite (Supabase, Unique Constraints, Server Restarts & QR Credentials)', () => {
  let tempDir: string;
  let tempLedgerFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'urjasaathi-persistence-test-'));
    tempLedgerFile = path.join(tempDir, 'test_ledger.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('1. Honest Supabase Configuration Reporting: reports unconfigured state clearly without faking database persistence', () => {
    const unconfigured = getPersistenceStatus({
      NODE_ENV: 'test',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    });

    assert.equal(unconfigured.supabaseConfigured, false);
    assert.equal(unconfigured.durableStorageAvailable, false);
    assert.equal(unconfigured.persistenceMode, 'local_demo_fallback');
    assert.ok(unconfigured.persistenceWarning && unconfigured.persistenceWarning.includes('SUPABASE_URL'));

    const configured = getPersistenceStatus({
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://xyzcompanyproject.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role_secret_key_value',
    });

    assert.equal(configured.supabaseConfigured, true);
    assert.equal(configured.durableStorageAvailable, true);
    assert.equal(configured.persistenceMode, 'supabase_postgres');
    assert.equal(configured.persistenceWarning, null);
  });

  it('2. Server-Side Identity Verification: rejects tampered tokens and ignores spoofed user_id in request body', async () => {
    const env = {
      NODE_ENV: 'test',
      URJASAATHI_SESSION_SECRET: 'test-super-secret-hmac-signing-key-2026',
    };

    const validToken = createSignedSessionToken('verified-citizen-42', env);

    // Attempt to spoof another user's ID in the request body while authenticated as verified-citizen-42
    const identity = await verifyServerUserIdentity({
      sessionHeader: validToken,
      untrustedBodyUserId: 'spoofed-attacker-999',
      env,
    });

    assert.equal(identity.authenticated, true);
    assert.equal(identity.userId, 'verified-citizen-42');
    assert.equal(identity.bodyUserIdIgnored, true);

    // Tampered token must be rejected with authenticated: false
    const tampered = await verifyServerUserIdentity({
      authorizationHeader: `Bearer ${validToken}tampered`,
      untrustedBodyUserId: 'spoofed-attacker-999',
      env,
    });

    assert.equal(tampered.authenticated, false);
    assert.equal(tampered.userId, '');
  });

  it('3. Duplicate Clicks Prevention: repeated mission completion attempts on same Asia/Kolkata date award points only once', async () => {
    const engine = new DurablePersistenceEngine({
      ledgerFilePath: tempLedgerFile,
      env: { NODE_ENV: 'test' },
    });

    const first = await engine.completeMissionAtomically({
      verifiedUserId: 'citizen-dup-test',
      mission: TEST_MISSION,
      now: TEST_DAY_1_IST,
    });

    assert.equal(first.status, 'completed');
    assert.equal(first.duplicate, false);
    assert.equal(first.pointsAwarded, 50);
    assert.equal(first.streakDays, 1);
    assert.equal(first.streakIncremented, true);

    const second = await engine.completeMissionAtomically({
      verifiedUserId: 'citizen-dup-test',
      mission: TEST_MISSION,
      now: TEST_DAY_1_IST,
    });

    assert.equal(second.status, 'already_completed');
    assert.equal(second.duplicate, true);
    assert.equal(second.pointsAwarded, 0);
    assert.equal(second.streakDays, 1);
    assert.equal(second.streakIncremented, false);

    const rows = await engine.getMissionCompletionRows('citizen-dup-test');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].points_awarded, 50);
  });

  it('4. Simultaneous Requests Across Separate Serverless Instances (No In-Memory Lock Dependency)', async () => {
    // Instantiate two completely separate DurablePersistenceEngine objects (no shared JS memory)
    // pointing to the same durable storage ledger to simulate concurrent Vercel serverless instances.
    const instanceA = new DurablePersistenceEngine({
      ledgerFilePath: tempLedgerFile,
      env: { NODE_ENV: 'test' },
    });
    const instanceB = new DurablePersistenceEngine({
      ledgerFilePath: tempLedgerFile,
      env: { NODE_ENV: 'test' },
    });

    const [resA, resB] = await Promise.all([
      instanceA.completeMissionAtomically({
        verifiedUserId: 'citizen-concurrent-test',
        mission: TEST_MISSION,
        now: TEST_DAY_1_IST,
      }),
      instanceB.completeMissionAtomically({
        verifiedUserId: 'citizen-concurrent-test',
        mission: TEST_MISSION,
        now: TEST_DAY_1_IST,
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, ['already_completed', 'completed']);
    assert.equal(resA.pointsAwarded + resB.pointsAwarded, 50);

    const rows = await instanceA.getMissionCompletionRows('citizen-concurrent-test');
    assert.equal(rows.length, 1);
  });

  it('5. Server Restart Persistence: state survives full server restart and blocks post-restart duplicate claims', async () => {
    // Server process #1 completes mission on Day 1
    const serverBeforeRestart = new DurablePersistenceEngine({
      ledgerFilePath: tempLedgerFile,
      env: { NODE_ENV: 'test' },
    });

    const beforeRes = await serverBeforeRestart.completeMissionAtomically({
      verifiedUserId: 'citizen-restart-test',
      mission: TEST_MISSION,
      now: TEST_DAY_1_IST,
    });
    assert.equal(beforeRes.status, 'completed');
    assert.equal(beforeRes.pointsAwarded, 50);
    assert.equal(beforeRes.streakDays, 1);

    // Simulate full server restart by creating a brand-new engine instance with fresh memory
    const serverAfterRestart = new DurablePersistenceEngine({
      ledgerFilePath: tempLedgerFile,
      env: { NODE_ENV: 'test' },
    });

    const loadedState = await serverAfterRestart.getUserAuthoritativeState(
      'citizen-restart-test',
      TEST_DAY_1_IST
    );
    const agg = calculateUserAggregates(loadedState);
    assert.equal(agg.totalPoints, 50);
    assert.equal(loadedState.streakDays, 1);

    // Clicking the same mission after server restart on the same day must still be blocked
    const retryAfterRestart = await serverAfterRestart.completeMissionAtomically({
      verifiedUserId: 'citizen-restart-test',
      mission: TEST_MISSION,
      now: TEST_DAY_1_IST,
    });
    assert.equal(retryAfterRestart.status, 'already_completed');
    assert.equal(retryAfterRestart.pointsAwarded, 0);
    assert.equal(retryAfterRestart.streakDays, 1);

    // Next calendar day in Asia/Kolkata after another restart increments streak to 2
    const serverNextDay = new DurablePersistenceEngine({
      ledgerFilePath: tempLedgerFile,
      env: { NODE_ENV: 'test' },
    });
    const nextDayRes = await serverNextDay.completeMissionAtomically({
      verifiedUserId: 'citizen-restart-test',
      mission: TEST_MISSION,
      now: TEST_DAY_2_IST,
    });
    assert.equal(nextDayRes.status, 'completed');
    assert.equal(nextDayRes.pointsAwarded, 50);
    assert.equal(nextDayRes.streakDays, 2);
  });

  it('6. Duplicate Database Insertion Rejection: enforces UNIQUE (user_id, mission_id, completion_date) with code 23505', async () => {
    const engine = new DurablePersistenceEngine({
      ledgerFilePath: tempLedgerFile,
      env: { NODE_ENV: 'test' },
    });

    const inserted = await engine.insertMissionCompletionRow({
      user_id: 'db-unique-user',
      mission_id: 'm-ac-24',
      completion_date: '2026-11-02',
      points_awarded: 25,
      co2_saved_kg: 2.8,
      inr_saved: 22,
    });
    assert.equal(inserted.user_id, 'db-unique-user');
    assert.equal(inserted.completion_date, '2026-11-02');

    // Attempting a second database insert for the same (user_id, mission_id, completion_date) MUST throw 23505
    await assert.rejects(
      async () => {
        await engine.insertMissionCompletionRow({
          user_id: 'db-unique-user',
          mission_id: 'm-ac-24',
          completion_date: '2026-11-02',
          points_awarded: 25,
        });
      },
      (err: any) => {
        assert.ok(err instanceof UniqueConstraintViolationError);
        assert.equal(err.code, '23505');
        assert.equal(err.constraint, 'uq_mission_completions_user_mission_date');
        return true;
      }
    );

    // Inserting the same mission on a different completion_date (next day in Asia/Kolkata) succeeds
    const nextDayInsert = await engine.insertMissionCompletionRow({
      user_id: 'db-unique-user',
      mission_id: 'm-ac-24',
      completion_date: '2026-11-03',
      points_awarded: 25,
    });
    assert.equal(nextDayInsert.completion_date, '2026-11-03');
  });

  it('7. Supabase PostgreSQL Migration Schema Verification: validates SQL DDL and atomic RPC definition', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase',
      'migrations',
      '20261102000001_production_persistence.sql'
    );
    assert.equal(fs.existsSync(migrationPath), true);
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.mission_completions'));
    assert.ok(sqlContent.includes('user_id TEXT NOT NULL'));
    assert.ok(sqlContent.includes('mission_id TEXT NOT NULL'));
    assert.ok(sqlContent.includes('completion_date DATE NOT NULL'));
    assert.ok(sqlContent.includes('points_awarded INTEGER NOT NULL'));
    assert.ok(sqlContent.includes('created_at TIMESTAMPTZ NOT NULL'));
    assert.ok(sqlContent.includes('CONSTRAINT uq_mission_completions_user_mission_date'));
    assert.ok(sqlContent.includes('UNIQUE (user_id, mission_id, completion_date)'));
    assert.ok(sqlContent.includes('CREATE OR REPLACE FUNCTION public.complete_mission_atomic'));
    assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.credential_records'));
  });

  it('8. Reusable Green Impact Passport QR Credential Storage Layer: issues, persists across restarts, and verifies HMAC hash', async () => {
    const env = {
      NODE_ENV: 'test',
      URJASAATHI_SESSION_SECRET: 'qr-passport-secret-key-2026-geda',
    };

    const engine1 = new DurablePersistenceEngine({
      ledgerFilePath: tempLedgerFile,
      env,
    });

    await engine1.completeMissionAtomically({
      verifiedUserId: 'citizen-qr-user',
      mission: TEST_MISSION,
      now: TEST_DAY_1_IST,
    });

    const { record } = await engine1.upsertCredentialRecord({
      verifiedUserId: 'citizen-qr-user',
      holderName: 'Aarav Patel',
      district: 'Ahmedabad',
      greenScore: 84,
      now: TEST_DAY_1_IST,
    });

    assert.ok(record.credential_id.startsWith('GEDA-LIFE-2026-'));
    assert.equal(record.total_points, 50);
    assert.equal(record.missions_completed, 1);
    assert.equal(record.streak_days, 1);
    assert.ok(record.payload_hash.length === 64);

    // Simulate server restart and verify QR credential on a new engine instance
    const engine2 = new DurablePersistenceEngine({
      ledgerFilePath: tempLedgerFile,
      env,
    });

    const verification = await engine2.verifyCredentialRecord(record.credential_id);
    assert.equal(verification.verified, true);
    assert.equal(verification.signatureValid, true);
    assert.equal(verification.record?.verified_count, 1);
    assert.equal(verification.record?.holder_name, 'Aarav Patel');
  });

  it('9. Supabase SECURITY DEFINER Audit: verifies fixed empty search_path, schema qualification, REVOKE/GRANT privileges, and RLS lockdown', async () => {
    const { auditSupabaseMigrationSecurity } = await import('../db/supabasePersistence.ts');
    const report = auditSupabaseMigrationSecurity();

    assert.equal(report.passed, true, `Security advisor failed with findings: ${report.findings.join('; ')}`);
    assert.equal(report.fixedSearchPathEmpty, true);
    assert.equal(report.allObjectsSchemaQualified, true);
    assert.equal(report.revokedFromPublicAnonAuthenticated, true);
    assert.equal(report.grantedToServiceRoleOnly, true);
    assert.equal(report.rlsEnabledAndForcedOnAllTables, true);
    assert.equal(report.credentialRecordsLockedDown, true);
    assert.equal(report.noPermissivePublicPolicies, true);
    assert.deepEqual(report.findings, []);
  });

  it('10. Service-Role Client Enforcement: rejects anon and authenticated JWT keys from configuring the privileged Supabase admin client', async () => {
    const { isTrustedServiceRoleKey } = await import('../db/supabasePersistence.ts');

    const anonPayload = Buffer.from(JSON.stringify({ role: 'anon', iss: 'supabase' })).toString('base64url');
    const authenticatedPayload = Buffer.from(
      JSON.stringify({ role: 'authenticated', iss: 'supabase' })
    ).toString('base64url');
    const serviceRolePayload = Buffer.from(
      JSON.stringify({ role: 'service_role', iss: 'supabase' })
    ).toString('base64url');

    const fakeAnonJwt = `eyJhbGciOiJIUzI1NiJ9.${anonPayload}.signature_part_123456`;
    const fakeAuthJwt = `eyJhbGciOiJIUzI1NiJ9.${authenticatedPayload}.signature_part_123456`;
    const validServiceJwt = `eyJhbGciOiJIUzI1NiJ9.${serviceRolePayload}.signature_part_123456`;

    assert.equal(isTrustedServiceRoleKey(fakeAnonJwt), false);
    assert.equal(isTrustedServiceRoleKey(fakeAuthJwt), false);
    assert.equal(isTrustedServiceRoleKey('sb_publishable_1234567890123456789012345'), false);
    assert.equal(isTrustedServiceRoleKey(validServiceJwt), true);

    const statusWithAnonKey = getPersistenceStatus({
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://xyzcompanyproject.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: fakeAnonJwt,
    });
    assert.equal(statusWithAnonKey.supabaseConfigured, false);
  });

  it('11. Frontend & Build Secret Hygiene Audit: confirms no service-role key or session secret exists in frontend code or build assets', () => {
    const frontendFiles = [
      path.resolve(process.cwd(), 'src', 'App.tsx'),
      path.resolve(process.cwd(), 'src', 'main.tsx'),
      path.resolve(process.cwd(), 'src', 'utils', 'storage.ts'),
      path.resolve(process.cwd(), 'src', 'components', 'MissionsView.tsx'),
      path.resolve(process.cwd(), 'src', 'components', 'PassportView.tsx'),
      path.resolve(process.cwd(), 'src', 'components', 'DashboardView.tsx'),
    ];

    for (const file of frontendFiles) {
      const content = fs.readFileSync(file, 'utf8');
      assert.equal(
        content.includes('SUPABASE_SERVICE_ROLE_KEY'),
        false,
        `Frontend file ${path.basename(file)} must not reference SUPABASE_SERVICE_ROLE_KEY`
      );
      assert.equal(
        content.includes('URJASAATHI_SESSION_SECRET'),
        false,
        `Frontend file ${path.basename(file)} must not reference URJASAATHI_SESSION_SECRET`
      );
      assert.equal(
        content.includes('db/supabasePersistence'),
        false,
        `Frontend file ${path.basename(file)} must not import server-only supabasePersistence module`
      );
    }
  });
});
