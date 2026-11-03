import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import vercelApp from '../../api/index.ts';
import serverApp from '../../server.ts';
import { resolveVerificationBaseUrl } from './pdfGenerator.ts';
import { DurablePersistenceEngine } from '../db/supabasePersistence.ts';

function startEphemeralServer(appInstance: any): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind ephemeral server port'));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((resClose, rejClose) => {
            server.close((err) => (err ? rejClose(err) : resClose()));
          }),
      });
    });
  });
}

test('Vercel Configuration: vercel.json and /api/index.ts entrypoint are properly structured', () => {
  const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
  assert.equal(fs.existsSync(vercelJsonPath), true, 'vercel.json must exist at repository root');

  const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  assert.equal(Array.isArray(config.rewrites), true);

  const apiRewrite = config.rewrites.find((r: any) => r.destination === '/api/index');
  assert.ok(apiRewrite, 'vercel.json must route /api/* requests to /api/index');

  const spaRewrite = config.rewrites.find((r: any) => r.destination === '/index.html');
  assert.ok(spaRewrite, 'vercel.json must route SPA paths (such as /verify/:token) to /index.html');

  // Verify Express app is exported identically from both server.ts and api/index.ts
  assert.equal(typeof vercelApp, 'function');
  assert.equal(vercelApp, serverApp);
});

test('Vercel ESM Module Resolution: api/index.ts and the complete server dependency graph use explicit .ts extensions on all relative imports', () => {
  const serverGraphFiles = [
    'api/index.ts',
    'server.ts',
    'src/db/supabasePersistence.ts',
    'src/utils/pdfGenerator.ts',
    'src/utils/energyMathChat.ts',
    'src/utils/sustainabilityMath.ts',
    'src/utils/storage.ts',
    'src/data/missionsData.ts',
  ];

  // Verify api/index.ts explicitly imports '../server.ts'
  const apiIndexSource = fs.readFileSync(path.resolve(process.cwd(), 'api/index.ts'), 'utf8');
  assert.match(apiIndexSource, /from\s+['"]\.\.\/server\.ts['"]/);

  // Verify every file in the server dependency graph has no extensionless relative imports
  const relativeImportRegex = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/g;
  for (const relPath of serverGraphFiles) {
    const absPath = path.resolve(process.cwd(), relPath);
    assert.equal(fs.existsSync(absPath), true, `${relPath} must exist`);
    const content = fs.readFileSync(absPath, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = relativeImportRegex.exec(content)) !== null) {
      const specifier = match[1];
      assert.match(
        specifier,
        /\.(ts|tsx|js|mjs|json)$/,
        `Relative import "${specifier}" in ${relPath} must include an explicit file extension for Vercel ESM runtime`
      );
    }
  }
});

test('Vercel Production Domain Resolution: APP_BASE_URL and VERCEL_PROJECT_PRODUCTION_URL enforce HTTPS', () => {
  // 1. Explicit APP_BASE_URL with https://
  assert.equal(
    resolveVerificationBaseUrl({
      env: { APP_BASE_URL: 'https://urjasaathi-mission-life.vercel.app/' },
    }),
    'https://urjasaathi-mission-life.vercel.app'
  );

  // 2. APP_BASE_URL provided without scheme or with http:// on non-local domain upgrades to https://
  assert.equal(
    resolveVerificationBaseUrl({
      env: { APP_BASE_URL: 'urjasaathi-mission-life.vercel.app' },
    }),
    'https://urjasaathi-mission-life.vercel.app'
  );
  assert.equal(
    resolveVerificationBaseUrl({
      env: { APP_BASE_URL: 'http://urjasaathi-mission-life.vercel.app/' },
    }),
    'https://urjasaathi-mission-life.vercel.app'
  );

  // 3. Automatic fallback to VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL when APP_BASE_URL is placeholder
  assert.equal(
    resolveVerificationBaseUrl({
      env: {
        APP_BASE_URL: 'https://YOUR-DEPLOYED-DOMAIN',
        VERCEL_PROJECT_PRODUCTION_URL: 'urjasaathi-prod.vercel.app',
      },
    }),
    'https://urjasaathi-prod.vercel.app'
  );

  // 4. Request host header fallback behind Vercel proxy uses https
  assert.equal(
    resolveVerificationBaseUrl({
      env: {},
      requestProtocol: 'https',
      requestHost: 'urjasaathi-edge.vercel.app',
    }),
    'https://urjasaathi-edge.vercel.app'
  );
});

test('Vercel Read-Only Filesystem Safety: DurablePersistenceEngine uses os.tmpdir() when VERCEL=1 in demo fallback mode', async () => {
  const engine = new DurablePersistenceEngine({
    env: {
      VERCEL: '1',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    } as any,
  });

  const state = await engine.getUserAuthoritativeState('vercel-tmp-test-user', new Date());
  assert.ok(state);
  assert.equal(typeof state.streakDays, 'number');

  const expectedTmpPrefix = path.join(os.tmpdir(), 'urjasaathi-data');
  assert.equal(fs.existsSync(expectedTmpPrefix), true);
});

test('Vercel Express Serverless Function: All 9 required production API endpoints and /api/reports/impact-pdf respond accurately', async () => {
  const { baseUrl, close } = await startEphemeralServer(vercelApp);

  try {
    // 1. GET /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`, {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'urjasaathi-mission-life.vercel.app',
      },
    });
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'ok');
    assert.equal(typeof healthData.supabaseConfigured, 'boolean');
    assert.equal(typeof healthData.durableStorageAvailable, 'boolean');
    assert.ok(
      healthData.persistenceMode === 'supabase_postgres' ||
        healthData.persistenceMode === 'local_demo_fallback'
    );
    assert.equal(typeof healthData.appBaseUrl, 'string');
    assert.equal(healthData.appBaseUrl.startsWith('https://'), true);

    // 2. POST /api/gemini/chat (deterministic math / appliance calculation works even without external network)
    const chatRes = await fetch(`${baseUrl}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '1500W geyser for 2 hours daily monthly cost at ₹6.25/kWh',
        profile: {
          name: 'Aarav Patel',
          district: 'Ahmedabad',
          monthlyKwh: 320,
          monthlyBillInr: 2000,
          familyMembers: 4,
          appliances: ['ac', 'geyser', 'fridge'],
          rooftopAvailableSqFt: 400,
          hasSolarInstalled: false,
        },
        history: [],
      }),
    });
    assert.equal(chatRes.status, 200);
    const chatData = await chatRes.json();
    assert.equal(typeof chatData.response, 'string');
    assert.ok(chatData.response.length > 20);

    // 3. POST /api/gemini/coach
    const coachRes = await fetch(`${baseUrl}/api/gemini/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          name: 'Aarav Patel',
          district: 'Ahmedabad',
          monthlyKwh: 320,
          monthlyBillInr: 2000,
          familyMembers: 4,
          appliances: ['ac', 'geyser', 'fridge'],
          rooftopAvailableSqFt: 400,
          hasSolarInstalled: false,
        },
      }),
    });
    assert.equal(coachRes.status, 200);
    const coachData = await coachRes.json();
    assert.equal(typeof coachData.summary, 'string');
    assert.equal(Array.isArray(coachData.recommendations), true);
    assert.ok(coachData.recommendations.length > 0);

    // 4. GET /api/missions/state
    const stateRes = await fetch(`${baseUrl}/api/missions/state`);
    assert.equal(stateRes.status, 200);
    const stateData = await stateRes.json();
    assert.ok(stateData.state);
    assert.equal(typeof stateData.sessionToken, 'string');
    const sessionToken = stateData.sessionToken;

    // 5. POST /api/missions/complete
    const completeRes = await fetch(`${baseUrl}/api/missions/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-UrjaSaathi-Session': sessionToken,
      },
      body: JSON.stringify({
        mission: {
          id: 'm-ac-24',
          title: 'Set AC to 24°C Optimal Comfort',
          points: 25,
          co2SavedKg: 2.8,
          inrSaved: 22,
        },
      }),
    });
    assert.equal(completeRes.status, 200);
    const completeData = await completeRes.json();
    assert.ok(
      completeData.status === 'completed' || completeData.status === 'already_completed'
    );

    // 6. POST /api/passport/credentials/issue
    const issueRes = await fetch(`${baseUrl}/api/passport/credentials/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-UrjaSaathi-Session': sessionToken,
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'urjasaathi-mission-life.vercel.app',
      },
      body: JSON.stringify({
        holderName: 'Aarav Patel',
        district: 'Ahmedabad',
        greenScore: 82,
        publicDisplayConsent: true,
        unlockedBadgeIds: ['pioneer', 'ac_master'],
      }),
    });
    assert.equal(issueRes.status, 200);
    const issueData = await issueRes.json();
    assert.equal(typeof issueData.verificationToken, 'string');
    assert.equal(issueData.verificationUrl.startsWith('https://'), true);
    assert.equal(issueData.qrDataUrl.startsWith('data:image/png;base64,'), true);

    // 7. GET /api/passport/verify/:token
    const verifyRes = await fetch(
      `${baseUrl}/api/passport/verify/${encodeURIComponent(issueData.verificationToken)}`
    );
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.verified, true);
    assert.equal(verifyData.verificationState, 'verified');
    assert.equal(verifyData.signatureValid, true);
    assert.equal(verifyData.publicCredential.holderDisplayName, 'Aarav Patel');

    // 8. POST /api/reports/solar-pdf
    const solarPdfRes = await fetch(`${baseUrl}/api/reports/solar-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicantName: 'Aarav Patel',
        district: 'Ahmedabad',
        monthlyKwh: 320,
        monthlyBillInr: 2000,
        rooftopAreaSqFt: 400,
      }),
    });
    assert.equal(solarPdfRes.status, 200);
    assert.equal(solarPdfRes.headers.get('content-type'), 'application/pdf');
    assert.match(
      solarPdfRes.headers.get('content-disposition') || '',
      /UrjaSaathi_Solar_Report\.pdf/
    );
    const solarPdfBuf = Buffer.from(await solarPdfRes.arrayBuffer());
    assert.equal(solarPdfBuf.subarray(0, 5).toString('ascii'), '%PDF-');

    // 9. POST /api/reports/passport-pdf
    const passportPdfRes = await fetch(`${baseUrl}/api/reports/passport-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-UrjaSaathi-Session': sessionToken,
      },
      body: JSON.stringify({
        holderName: 'Aarav Patel',
        district: 'Ahmedabad',
        greenScore: 82,
        tierName: 'Grid Guardian',
        publicDisplayConsent: true,
      }),
    });
    assert.equal(passportPdfRes.status, 200);
    assert.equal(passportPdfRes.headers.get('content-type'), 'application/pdf');
    assert.match(
      passportPdfRes.headers.get('content-disposition') || '',
      /UrjaSaathi_Green_Impact_Passport\.pdf/
    );
    const passportPdfBuf = Buffer.from(await passportPdfRes.arrayBuffer());
    assert.equal(passportPdfBuf.subarray(0, 5).toString('ascii'), '%PDF-');

    // 10. POST /api/reports/impact-pdf
    const impactPdfRes = await fetch(`${baseUrl}/api/reports/impact-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-UrjaSaathi-Session': sessionToken,
      },
      body: JSON.stringify({
        holderName: 'Aarav Patel',
        district: 'Ahmedabad',
        familyMembers: 4,
        monthlyKwh: 320,
        monthlyBillInr: 2000,
        greenScore: 82,
        tierName: 'Grid Guardian',
      }),
    });
    assert.equal(impactPdfRes.status, 200);
    assert.equal(impactPdfRes.headers.get('content-type'), 'application/pdf');
    assert.match(
      impactPdfRes.headers.get('content-disposition') || '',
      /UrjaSaathi_Impact_Report\.pdf/
    );
    const impactPdfBuf = Buffer.from(await impactPdfRes.arrayBuffer());
    assert.equal(impactPdfBuf.subarray(0, 5).toString('ascii'), '%PDF-');
  } finally {
    await close();
  }
});
