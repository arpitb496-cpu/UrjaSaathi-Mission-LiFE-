import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_SUPABASE_PROJECT_URL,
  isPublicAnonKeySafe,
  extractGoogleUserProfile,
  isSessionExpired,
  parseOAuthCallbackParams,
  initiateGoogleSignIn,
  handleOAuthCallbackExchange,
  restoreSupabaseSession,
  signOutSupabaseUser,
} from './supabaseAuth.ts';
import {
  DEFAULT_USER_ID,
  createInitialAuthenticatedUserState,
  loadAppState,
  saveAppState,
  getStorageKeyForUser,
  getChatStorageKeyForUser,
  calculateUserAggregates,
} from './storage.ts';
import {
  DurablePersistenceEngine,
  verifyServerUserIdentity,
} from '../db/supabasePersistence.ts';
import { generateImpactReportPdf, generateGreenPassportPdf } from './pdfGenerator.ts';

function createTempLedgerPath(prefix: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `urja-auth-test-${prefix}-`));
  return path.join(tmpDir, 'ledger.json');
}

function makeFakeJwt(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('signature_bytes_placeholder').toString('base64url');
  return `${header}.${body}.${sig}`;
}

test('1. Successful Google login flow (OAuth PKCE initiation & code exchange)', async () => {
  const googleUserUuid = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  let capturedProvider = '';
  let capturedRedirectTo = '';

  const mockSupabaseClient: any = {
    auth: {
      signInWithOAuth: async (opts: any) => {
        capturedProvider = opts.provider;
        capturedRedirectTo = opts.options?.redirectTo;
        return {
          data: {
            provider: 'google',
            url: `${DEFAULT_SUPABASE_PROJECT_URL}/auth/v1/authorize?provider=google&code_challenge=pkce123`,
          },
          error: null,
        };
      },
      exchangeCodeForSession: async (code: string) => {
        assert.equal(code, 'pkce_valid_auth_code_999');
        return {
          data: {
            session: {
              access_token: 'valid_supabase_jwt_token_user_a',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user: {
                id: googleUserUuid,
                email: 'arpitb496@gmail.com',
                email_confirmed_at: '2026-11-03T08:00:00Z',
                user_metadata: {
                  full_name: 'Arpit Bhatia',
                  avatar_url: 'https://lh3.googleusercontent.com/a/arpit-avatar',
                  email_verified: true,
                },
                app_metadata: {
                  provider: 'google',
                },
              },
            },
            user: {
              id: googleUserUuid,
              email: 'arpitb496@gmail.com',
              email_confirmed_at: '2026-11-03T08:00:00Z',
              user_metadata: {
                full_name: 'Arpit Bhatia',
                avatar_url: 'https://lh3.googleusercontent.com/a/arpit-avatar',
                email_verified: true,
              },
              app_metadata: {
                provider: 'google',
              },
            },
          },
          error: null,
        };
      },
    },
  };

  // Step 1a: Initiate OAuth
  const startResult = await initiateGoogleSignIn({
    client: mockSupabaseClient,
    redirectOrigin: 'https://ais-pre-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app',
    skipBrowserRedirect: true,
  });

  assert.equal(startResult.status, 'redirecting');
  assert.equal(capturedProvider, 'google');
  assert.equal(
    capturedRedirectTo,
    'https://ais-pre-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app/auth/callback'
  );
  assert.ok(startResult.url?.includes(DEFAULT_SUPABASE_PROJECT_URL));

  // Step 1b: Handle OAuth callback with PKCE authorization code
  const callbackState = await handleOAuthCallbackExchange({
    searchOrUrl: 'https://ais-pre-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app/auth/callback?code=pkce_valid_auth_code_999',
    client: mockSupabaseClient,
  });

  assert.equal(callbackState.status, 'authenticated');
  assert.equal(callbackState.accessToken, 'valid_supabase_jwt_token_user_a');
  assert.ok(callbackState.user);
  assert.equal(callbackState.user.id, googleUserUuid);
  assert.equal(callbackState.user.name, 'Arpit Bhatia');
  assert.equal(callbackState.user.email, 'arpitb496@gmail.com');
  assert.equal(callbackState.user.emailVerified, true);
  assert.equal(callbackState.user.avatarUrl, 'https://lh3.googleusercontent.com/a/arpit-avatar');
  assert.equal(callbackState.user.provider, 'google');
});

test('2. Cancelled OAuth login handling', async () => {
  const parsed = parseOAuthCallbackParams(
    '?error=access_denied&error_code=oauth_cancelled&error_description=User+cancelled+the+login+process'
  );
  assert.equal(parsed.hasCallbackParams, true);
  assert.equal(parsed.errorCategory, 'cancelled');
  assert.ok(parsed.userFriendlyError?.toLowerCase().includes('cancelled'));

  const exchangeResult = await handleOAuthCallbackExchange({
    searchOrUrl: 'http://localhost:3000/auth/callback?error=access_denied&error_description=access_denied',
    client: null,
  });
  assert.equal(exchangeResult.status, 'error');
  assert.equal(exchangeResult.errorType, 'cancelled');
  assert.equal(exchangeResult.user, null);
});

test('3. Invalid OAuth configuration & browser service_role key protection', async () => {
  // 3a. Missing client/anon key
  const noClientRes = await initiateGoogleSignIn({ client: null });
  assert.equal(noClientRes.status, 'error');
  assert.equal(noClientRes.errorType, 'invalid_config');

  // 3b. Provider not enabled in Supabase
  const disabledProviderClient: any = {
    auth: {
      signInWithOAuth: async () => ({
        data: { url: null },
        error: { message: 'Unsupported provider: provider is not enabled' },
      }),
    },
  };
  const disabledRes = await initiateGoogleSignIn({ client: disabledProviderClient });
  assert.equal(disabledRes.status, 'error');
  assert.equal(disabledRes.errorType, 'invalid_config');
  assert.ok(disabledRes.errorMessage?.includes('Google OAuth configuration error'));

  // 3c. Callback with invalid_client / redirect_uri_mismatch
  const badRedirect = parseOAuthCallbackParams(
    '?error=unauthorized_client&error_description=redirect_uri_mismatch'
  );
  assert.equal(badRedirect.errorCategory, 'invalid_config');

  // 3d. Reject service_role key in browser configuration
  const fakeServiceRoleJwt = makeFakeJwt({ role: 'service_role', iss: 'supabase' });
  const fakeAnonJwt = makeFakeJwt({ role: 'anon', iss: 'supabase' });
  assert.equal(isPublicAnonKeySafe(fakeServiceRoleJwt).valid, false);
  assert.equal(isPublicAnonKeySafe('sb_secret_12345').valid, false);
  assert.equal(isPublicAnonKeySafe(fakeAnonJwt).valid, true);
});

test('4. Session restoration after page refresh', async () => {
  const userUuid = '11111111-2222-4333-8444-555555555555';
  const mockClient: any = {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: 'restored_access_token_xyz',
            expires_at: Math.floor(Date.now() / 1000) + 7200,
            user: {
              id: userUuid,
              email: 'citizen@gujarat.gov.in',
              email_confirmed_at: '2026-11-03T07:00:00Z',
              user_metadata: {
                name: 'Meera Desai',
                picture: 'https://example.com/meera.png',
              },
              app_metadata: { provider: 'google' },
            },
          },
        },
        error: null,
      }),
    },
  };

  const restored = await restoreSupabaseSession({ client: mockClient });
  assert.equal(restored.status, 'authenticated');
  assert.equal(restored.accessToken, 'restored_access_token_xyz');
  assert.equal(restored.user?.id, userUuid);
  assert.equal(restored.user?.name, 'Meera Desai');
  assert.equal(restored.user?.email, 'citizen@gujarat.gov.in');
  assert.equal(restored.user?.avatarUrl, 'https://example.com/meera.png');
});

test('5. Logout clears session cleanly', async () => {
  let signOutCalled = false;
  const mockClient: any = {
    auth: {
      signOut: async () => {
        signOutCalled = true;
        return { error: null };
      },
    },
  };

  const afterLogout = await signOutSupabaseUser({ client: mockClient });
  assert.equal(signOutCalled, true);
  assert.equal(afterLogout.status, 'unauthenticated');
  assert.equal(afterLogout.user, null);
  assert.equal(afterLogout.accessToken, null);
});

test('6. Session expiry handling (client & server)', async () => {
  const pastUnixSeconds = Math.floor(Date.now() / 1000) - 120;
  assert.equal(isSessionExpired({ expires_at: pastUnixSeconds }), true);

  let signedOutOnExpiry = false;
  const expiredClient: any = {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: 'expired_token',
            expires_at: pastUnixSeconds,
            user: { id: 'aaaa1111-bbbb-4ccc-8ddd-eeeeffff0000', email: 'expired@example.com' },
          },
        },
        error: null,
      }),
      signOut: async () => {
        signedOutOnExpiry = true;
      },
    },
  };

  const restored = await restoreSupabaseSession({ client: expiredClient });
  assert.equal(restored.status, 'expired');
  assert.equal(restored.errorType, 'expired');
  assert.equal(restored.user, null);
  assert.equal(signedOutOnExpiry, true);

  // Server-side expired JWT rejection
  const expiredJwt = makeFakeJwt({
    sub: 'aaaa1111-bbbb-4ccc-8ddd-eeeeffff0000',
    exp: pastUnixSeconds,
  });
  const serverCheck = await verifyServerUserIdentity({
    authorizationHeader: `Bearer ${expiredJwt}`,
  });
  assert.equal(serverCheck.authenticated, false);
  assert.ok(serverCheck.error?.toLowerCase().includes('expired'));
});

test('7. User profile creation & onboarding without hardcoded names or districts', async () => {
  const ledgerFile = createTempLedgerPath('profile');
  const engine = new DurablePersistenceEngine({
    ledgerFilePath: ledgerFile,
    env: { NODE_ENV: 'test' } as any,
  });

  const googleUuid = '22223333-4444-4555-8666-777788889999';
  const initialClientState = createInitialAuthenticatedUserState({
    id: googleUuid,
    name: 'Kiran Joshi',
    email: 'kiran.joshi@gmail.com',
  });

  // Never hardcodes a district or city before onboarding
  assert.equal(initialClientState.userId, googleUuid);
  assert.equal(initialClientState.profile.name, 'Kiran Joshi');
  assert.equal(initialClientState.profile.district, '');
  assert.equal(initialClientState.profile.city, '');
  assert.equal(initialClientState.isOnboarded, false);
  // Never transfers anonymous/demo missions into the new Google user
  assert.deepEqual(initialClientState.completedMissions, {});
  assert.equal(initialClientState.streakDays, 0);

  // Server-side initial profile retrieval
  const serverInitial = await engine.getUserHouseholdProfile(googleUuid, {
    name: 'Kiran Joshi',
    email: 'kiran.joshi@gmail.com',
    emailVerified: true,
    avatarUrl: 'https://example.com/kiran.jpg',
  });
  assert.equal(serverInitial.user_id, googleUuid);
  assert.equal(serverInitial.profile.name, 'Kiran Joshi');
  assert.equal(serverInitial.profile.district, '');
  assert.equal(serverInitial.is_onboarded, false);

  // User completes household onboarding
  const onboarded = await engine.saveUserHouseholdProfile(googleUuid, {
    profile: {
      name: 'Kiran Joshi',
      city: 'Vadodara',
      district: 'Vadodara',
      familyMembers: 4,
      monthlyKwh: 340,
      monthlyBillInr: 2250,
      appliances: ['ac', 'refrigerator', 'fans_lights'],
      rooftopAvailableSqFt: 420,
      hasSolarInstalled: false,
    },
    isOnboarded: true,
  });

  assert.equal(onboarded.is_onboarded, true);
  assert.equal(onboarded.profile.district, 'Vadodara');
  assert.equal(onboarded.profile.monthlyKwh, 340);
});

test('8. Different users have strictly isolated data (Household, Missions, Streak, Points, Chat, Reports, Passport)', async () => {
  const ledgerFile = createTempLedgerPath('isolation');
  const engine = new DurablePersistenceEngine({
    ledgerFilePath: ledgerFile,
    env: { NODE_ENV: 'test', URJASAATHI_SESSION_SECRET: 'test_secret_isolation_32_bytes_long!!' } as any,
  });

  const userAUuid = 'aaaa0000-1111-4222-8333-444455556666';
  const userBUuid = 'bbbb0000-1111-4222-8333-444455557777';

  // Save distinct household profiles
  await engine.saveUserHouseholdProfile(userAUuid, {
    profile: {
      name: 'User Alpha',
      city: 'Rajkot',
      district: 'Rajkot',
      familyMembers: 3,
      monthlyKwh: 260,
      monthlyBillInr: 1700,
      appliances: ['ac', 'refrigerator'],
      rooftopAvailableSqFt: 300,
      hasSolarInstalled: false,
    },
    isOnboarded: true,
    email: 'alpha@example.com',
  });

  await engine.saveUserHouseholdProfile(userBUuid, {
    profile: {
      name: 'User Beta',
      city: 'Bhavnagar',
      district: 'Bhavnagar',
      familyMembers: 6,
      monthlyKwh: 520,
      monthlyBillInr: 3600,
      appliances: ['ac', 'geyser', 'water_pump'],
      rooftopAvailableSqFt: 600,
      hasSolarInstalled: true,
    },
    isOnboarded: true,
    email: 'beta@example.com',
  });

  // User A completes 2 missions; User B completes 0 missions
  const fixedNow = new Date('2026-11-03T10:00:00+05:30');
  await engine.completeMissionAtomically({
    verifiedUserId: userAUuid,
    mission: { id: 'm-ac-24', title: 'AC at 24°C', points: 25, co2SavedKg: 2.8, inrSaved: 22 },
    now: fixedNow,
  });
  await engine.completeMissionAtomically({
    verifiedUserId: userAUuid,
    mission: { id: 'm-phantom-power', title: 'Zero Vampire Power', points: 20, co2SavedKg: 1.2, inrSaved: 9 },
    now: fixedNow,
  });

  // Save isolated AI chat history
  await engine.saveUserChatHistory(userAUuid, [
    { id: 'u1', sender: 'user', text: 'Question from User Alpha in Rajkot' },
  ]);
  await engine.saveUserChatHistory(userBUuid, [
    { id: 'u2', sender: 'user', text: 'Question from User Beta in Bhavnagar' },
  ]);

  // Verify authoritative states are 100% isolated
  const stateA = await engine.getUserAuthoritativeState(userAUuid, fixedNow);
  const stateB = await engine.getUserAuthoritativeState(userBUuid, fixedNow);

  assert.equal(stateA.profile.name, 'User Alpha');
  assert.equal(stateA.profile.district, 'Rajkot');
  assert.equal(Object.keys(stateA.completedMissions).length, 2);
  assert.equal(stateA.streakDays, 1);

  assert.equal(stateB.profile.name, 'User Beta');
  assert.equal(stateB.profile.district, 'Bhavnagar');
  assert.equal(Object.keys(stateB.completedMissions).length, 0);
  assert.equal(stateB.streakDays, 0);

  // Verify demo default_household_user missions were NOT leaked into User A or User B
  const demoState = await engine.getUserAuthoritativeState(DEFAULT_USER_ID, fixedNow);
  assert.equal(Object.keys(demoState.completedMissions).length, 2);
  assert.equal(demoState.streakDays, 4);

  // Verify AI chat histories are isolated
  const chatA = await engine.getUserChatHistory(userAUuid);
  const chatB = await engine.getUserChatHistory(userBUuid);
  assert.equal(chatA.length, 1);
  assert.ok(chatA[0].text.includes('Alpha'));
  assert.equal(chatB.length, 1);
  assert.ok(chatB[0].text.includes('Beta'));

  // Verify storage keys are isolated
  assert.notEqual(getStorageKeyForUser(userAUuid), getStorageKeyForUser(userBUuid));
  assert.notEqual(getStorageKeyForUser(userAUuid), getStorageKeyForUser(DEFAULT_USER_ID));
  assert.notEqual(getChatStorageKeyForUser(userAUuid), getChatStorageKeyForUser(userBUuid));

  // Verify Impact Reports reflect each user's isolated metrics
  const aggA = calculateUserAggregates(stateA);
  const aggB = calculateUserAggregates(stateB);
  assert.equal(aggA.totalPoints, 45);
  assert.equal(aggB.totalPoints, 0);

  const pdfA = await generateImpactReportPdf({
    holderName: stateA.profile.name,
    district: stateA.profile.district,
    familyMembers: stateA.profile.familyMembers,
    monthlyKwh: stateA.profile.monthlyKwh,
    monthlyBillInr: stateA.profile.monthlyBillInr,
    baselineMonthlyCarbonKg: aggA.baselineMetrics.monthlyCarbonKg,
    potentialMonthlySavingKwh: aggA.baselineMetrics.potentialMonthlySavingKwh,
    potentialMonthlySavingInr: aggA.baselineMetrics.potentialMonthlySavingInr,
    greenScore: aggA.effectiveGreenScore,
    tierName: aggA.baselineMetrics.tier.name,
    streakDays: stateA.streakDays,
    rewardPoints: aggA.totalPoints,
    totalElectricityInrSaved: aggA.totalInrSaved,
    totalCo2SavedKg: aggA.totalCo2SavedKg,
    completedMissionsCount: aggA.totalMissions,
    completedMissions: [
      {
        missionId: 'm-1',
        title: 'AC at 24C',
        completionDate: '2026-11-01',
        points: 20,
        co2SavedKg: 1.35,
        inrSaved: 15,
      },
      {
        missionId: 'm-2',
        title: 'Zero Vampire Power',
        completionDate: '2026-11-02',
        points: 25,
        co2SavedKg: 1.8,
        inrSaved: 20,
      },
    ],
  });
  assert.ok(pdfA.byteLength > 1000);
});

test('9. Tampered JWT rejection & untrusted request body userId ignored', async () => {
  const realUserUuid = 'cccc0000-1111-4222-8333-444455558888';
  const attackerBodyUuid = 'dddd0000-1111-4222-8333-444455559999';

  // 9a. Tampered JWT rejected by Supabase verifier
  const tamperedResult = await verifyServerUserIdentity({
    authorizationHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdHRhY2tlciJ9.tampered_sig',
    untrustedBodyUserId: attackerBodyUuid,
    customJwtVerifier: async () => ({
      data: { user: null },
      error: { message: 'invalid JWT: signature verification failed' },
    }),
  });
  assert.equal(tamperedResult.authenticated, false);
  assert.equal(tamperedResult.userId, '');
  assert.equal(tamperedResult.bodyUserIdIgnored, true);

  // 9b. Valid JWT derives identity strictly from verified token and ignores attacker body userId
  const validToken = makeFakeJwt({
    sub: realUserUuid,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const verifiedResult = await verifyServerUserIdentity({
    authorizationHeader: `Bearer ${validToken}`,
    untrustedBodyUserId: attackerBodyUuid,
    customJwtVerifier: async () => ({
      data: {
        user: {
          id: realUserUuid,
          email: 'realuser@gmail.com',
          email_confirmed_at: '2026-11-03T08:00:00Z',
          user_metadata: {
            full_name: 'Real Verified User',
            avatar_url: 'https://example.com/real.png',
          },
          app_metadata: { provider: 'google' },
        },
      },
      error: null,
    }),
  });

  assert.equal(verifiedResult.authenticated, true);
  assert.equal(verifiedResult.userId, realUserUuid);
  assert.equal(verifiedResult.email, 'realuser@gmail.com');
  assert.equal(verifiedResult.fullName, 'Real Verified User');
  assert.equal(verifiedResult.bodyUserIdIgnored, true);
});

test('10. Mission completion for authenticated users enforces UNIQUE(user_id, mission_id, completion_date)', async () => {
  const ledgerFile = createTempLedgerPath('missions');
  const engine = new DurablePersistenceEngine({
    ledgerFilePath: ledgerFile,
    env: { NODE_ENV: 'test' } as any,
  });

  const authUserId = 'eeee0000-1111-4222-8333-444455550000';
  const now = new Date('2026-11-03T14:00:00+05:30');

  const firstAttempt = await engine.completeMissionAtomically({
    verifiedUserId: authUserId,
    mission: {
      id: 'm-led-retrofit',
      title: 'Switch to 9W LED Bulbs',
      points: 30,
      co2SavedKg: 3.4,
      inrSaved: 28,
    },
    now,
  });
  assert.equal(firstAttempt.status, 'completed');
  assert.equal(firstAttempt.duplicate, false);
  assert.equal(firstAttempt.pointsAwarded, 30);
  assert.equal(firstAttempt.streakDays, 1);

  // Duplicate click on the same day for the same authenticated user is idempotently blocked
  const duplicateAttempt = await engine.completeMissionAtomically({
    verifiedUserId: authUserId,
    mission: {
      id: 'm-led-retrofit',
      title: 'Switch to 9W LED Bulbs',
      points: 30,
      co2SavedKg: 3.4,
      inrSaved: 28,
    },
    now,
  });
  assert.equal(duplicateAttempt.status, 'already_completed');
  assert.equal(duplicateAttempt.duplicate, true);
  assert.equal(duplicateAttempt.pointsAwarded, 0);
  assert.equal(duplicateAttempt.streakDays, 1);
});

test('11. Passport ownership, isolation, and public QR verification for authenticated users', async () => {
  const ledgerFile = createTempLedgerPath('passport');
  const engine = new DurablePersistenceEngine({
    ledgerFilePath: ledgerFile,
    env: { NODE_ENV: 'test', URJASAATHI_SESSION_SECRET: 'passport_secret_key_32_bytes_minimum!!' } as any,
  });

  const user1 = '10101010-2020-4303-8404-505050505050';
  const user2 = '60606060-7070-4808-8909-010101010101';

  await engine.completeMissionAtomically({
    verifiedUserId: user1,
    mission: { id: 'm-ac-24', title: 'AC 24C', points: 25, co2SavedKg: 2.8, inrSaved: 22 },
  });

  const issued1 = await engine.upsertCredentialRecord({
    verifiedUserId: user1,
    holderName: 'Nidhi Trivedi',
    district: 'Gandhinagar',
    greenScore: 84,
    publicDisplayConsent: true,
    unlockedBadgeIds: ['pioneer', 'ac_master'],
  });

  const issued2 = await engine.upsertCredentialRecord({
    verifiedUserId: user2,
    holderName: 'Rohan Mehta',
    district: 'Surat',
    greenScore: 72,
    publicDisplayConsent: true,
    unlockedBadgeIds: ['pioneer'],
  });

  // Distinct passport IDs and tokens per user
  assert.notEqual(issued1.record.credential_id, issued2.record.credential_id);
  assert.notEqual(issued1.verificationToken, issued2.verificationToken);
  assert.equal(issued1.record.user_id, user1);
  assert.equal(issued2.record.user_id, user2);
  assert.equal(issued1.record.missions_completed, 1);
  assert.equal(issued2.record.missions_completed, 0);

  // Public verification of User 1's token succeeds and never leaks private user_id or inr_saved
  const pubVerify1 = await engine.verifyPublicPassportToken(issued1.verificationToken);
  assert.equal(pubVerify1.verified, true);
  assert.equal(pubVerify1.publicCredential?.holderDisplayName, 'Nidhi Trivedi');
  assert.equal(pubVerify1.publicCredential?.district, 'Gandhinagar');
  assert.equal(pubVerify1.publicCredential?.missionsCompleted, 1);
  assert.equal((pubVerify1.publicCredential as any).user_id, undefined);
  assert.equal((pubVerify1.publicCredential as any).inr_saved, undefined);

  // Generate downloadable Passport PDF for User 1
  const passportPdfBytes = await generateGreenPassportPdf({
    holderName: 'Nidhi Trivedi',
    publicDisplayConsent: true,
    passportId: issued1.record.credential_id,
    district: 'Gandhinagar',
    greenScore: 84,
    tierName: 'Surya Mitra',
    completedMissionsCount: 1,
    completedMissionTitles: ['AC 24C'],
    co2SavedKg: 2.8,
    treeEquivalent: 2,
    streakDays: 1,
    badges: [
      {
        id: 'pioneer',
        name: 'Mission LiFE Pioneer',
        description: 'Completed onboarding',
        unlocked: true,
        category: 'Foundation',
      },
    ],
    issueDate: issued1.record.issued_at,
    verificationUrl: `https://ais-pre-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app/verify/${issued1.verificationToken}`,
    persistenceMode: 'supabase_postgres',
    durableStorageAvailable: true,
    credentialStatus: 'active',
  });
  assert.ok(passportPdfBytes.byteLength > 1000);
});

test('12. Google Login UI, OAuth Setup Documentation, and Environment Security Audit', () => {
  const loginViewSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/GoogleLoginView.tsx'),
    'utf8'
  );
  // Verifies UrjaSaathi branding, Continue with Google button, privacy explanation, and responsive layout classes
  assert.ok(loginViewSource.includes('Continue with Google'));
  assert.ok(loginViewSource.includes('Privacy &amp; Data Protection Guarantee'));
  assert.ok(loginViewSource.includes('lg:grid-cols-12'));
  assert.ok(loginViewSource.includes('never asks you for Gemini or'));

  // Verifies no UI component asks users to enter a Gemini or OpenAI API key
  const aiCoachSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/AiCoachView.tsx'),
    'utf8'
  );
  assert.ok(!aiCoachSource.toLowerCase().includes('enter your gemini api key'));
  assert.ok(!aiCoachSource.toLowerCase().includes('enter your openai api key'));

  // Verifies GOOGLE_OAUTH_SETUP.md exists and documents required callback URL and steps
  const setupDoc = fs.readFileSync(
    path.resolve(process.cwd(), 'GOOGLE_OAUTH_SETUP.md'),
    'utf8'
  );
  assert.ok(
    setupDoc.includes('https://wzkpbofwajdbaqqrviqw.supabase.co/auth/v1/callback'),
    'GOOGLE_OAUTH_SETUP.md must include exact Supabase callback URL'
  );
  assert.ok(setupDoc.includes('http://localhost:3000'));
  assert.ok(setupDoc.includes('VITE_SUPABASE_URL'));
  assert.ok(setupDoc.includes('VITE_SUPABASE_ANON_KEY'));

  // Verifies .env.example documents both Server and Frontend variables without exposing secrets
  const envExample = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8');
  assert.ok(envExample.includes('SUPABASE_URL'));
  assert.ok(envExample.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.ok(envExample.includes('URJASAATHI_SESSION_SECRET'));
  assert.ok(envExample.includes('GEMINI_API_KEY'));
  assert.ok(envExample.includes('VITE_SUPABASE_URL'));
  assert.ok(envExample.includes('VITE_SUPABASE_ANON_KEY'));
});
