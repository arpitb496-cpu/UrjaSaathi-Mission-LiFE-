import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { PDFDocument } from 'pdf-lib';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { calculateSolarFeasibility } from './sustainabilityMath.ts';
import {
  generateSolarFeasibilityPdf,
  generateGreenPassportPdf,
  generateImpactReportPdf,
  generateQrCodePngBytes,
  generateQrCodeDataUrl,
  resolveVerificationBaseUrl,
  triggerBrowserPdfDownload,
  PROTOTYPE_PASSPORT_DISCLAIMER,
  SOLAR_REPORT_FILENAME,
  PASSPORT_REPORT_FILENAME,
  IMPACT_REPORT_FILENAME,
} from './pdfGenerator.ts';
import { DurablePersistenceEngine } from '../db/supabasePersistence.ts';

function createTempLedgerPath(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `urja-pdf-qr-${prefix}-`));
  return path.join(dir, 'ledger.json');
}

/**
 * Decompresses FlateDecode PDF page content streams and decodes hex `<...> Tj`
 * text operators back into plain text, combined with uncompressed PDF objects.
 */
function extractReadablePdfText(pdfBytes: Uint8Array): string {
  const buf = Buffer.from(pdfBytes);
  const rawLatin1 = buf.toString('latin1');
  const chunks: string[] = [rawLatin1];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(rawLatin1)) !== null) {
    try {
      const streamBytes = Buffer.from(match[1], 'latin1');
      const inflated = zlib.inflateSync(streamBytes).toString('latin1');
      chunks.push(inflated);

      // Decode `<HEX> Tj` operators emitted by pdf-lib StandardFonts
      const hexRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
      let hexMatch: RegExpExecArray | null;
      while ((hexMatch = hexRegex.exec(inflated)) !== null) {
        chunks.push(Buffer.from(hexMatch[1], 'hex').toString('latin1'));
      }
    } catch {
      // Non-Flate stream (e.g., raw or image stream segment)
    }
  }

  return chunks.join('\n');
}

// ============================================================================
// TESTS 1, 3, 4: SOLAR FEASIBILITY PDF GENERATION, PARSING & LIVE USER DATA
// ============================================================================
test('1, 3 & 4. Solar Feasibility PDF generates valid application/pdf binary with live user inputs and opens cleanly', async () => {
  const dynamicInputs = {
    applicantName: 'Kiranbhai Solanki',
    district: 'Bhavnagar',
    monthlyKwh: 625,
    monthlyBillInr: 4125,
    rooftopAreaSqFt: 750,
    unitRateInr: 6.6,
    hasBatteryBackup: true,
    systemLossesPercent: 15.5,
  };

  const calc = calculateSolarFeasibility(dynamicInputs);
  const generatedDate = new Date('2026-11-03T10:30:00.000Z');

  const pdfBytes = await generateSolarFeasibilityPdf({
    applicantName: dynamicInputs.applicantName,
    district: dynamicInputs.district,
    monthlyKwh: dynamicInputs.monthlyKwh,
    monthlyBillInr: dynamicInputs.monthlyBillInr,
    rooftopAreaSqFt: dynamicInputs.rooftopAreaSqFt,
    hasBatteryBackup: dynamicInputs.hasBatteryBackup,
    calculation: calc,
    generatedAt: generatedDate,
  });

  // Verify non-empty PDF binary header
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.byteLength > 2500, 'Solar PDF must be non-empty (> 2.5 KB)');
  const header = Buffer.from(pdfBytes.slice(0, 5)).toString('utf8');
  assert.equal(header, '%PDF-');

  // Verify PDF opens and parses cleanly with PDFDocument.load
  const loadedDoc = await PDFDocument.load(pdfBytes);
  assert.equal(loadedDoc.getPageCount(), 1);
  assert.equal(loadedDoc.getTitle(), 'UrjaSaathi Solar Feasibility Summary Report');

  // Inspect decompressed PDF page content streams and metadata for actual dynamic calculator values
  const rawPdfText = extractReadablePdfText(pdfBytes);
  assert.ok(rawPdfText.includes('URJASAATHI'), 'Must include UrjaSaathi branding');
  assert.ok(rawPdfText.includes('Kiranbhai Solanki'), 'Must include live applicant name');
  assert.ok(rawPdfText.includes('Bhavnagar, Gujarat'), 'Must include live Gujarat district');
  assert.ok(rawPdfText.includes('625 kWh / month'), 'Must include live monthly consumption');
  assert.ok(rawPdfText.includes('750 sq. ft'), 'Must include live rooftop area');
  assert.ok(
    rawPdfText.includes(`${calc.suggestedCapacityKw} kW Rooftop PV`),
    'Must include recommended solar capacity'
  );
  assert.ok(
    rawPdfText.includes(`${calc.monthlyGenerationKwh} kWh / month`),
    'Must include estimated monthly generation'
  );
  assert.ok(
    rawPdfText.includes(`INR ${calc.grossSystemCostInr.toLocaleString('en-IN')}`),
    'Must include gross system cost'
  );
  assert.ok(
    rawPdfText.includes(`INR ${calc.applicableSubsidyInr.toLocaleString('en-IN')}`),
    'Must include PM Surya Ghar subsidy'
  );
  assert.ok(
    rawPdfText.includes(`INR ${calc.netSystemCostInr.toLocaleString('en-IN')}`),
    'Must include net estimated investment'
  );
  assert.ok(
    rawPdfText.includes(`INR ${calc.annualSavingsInr.toLocaleString('en-IN')} / year`),
    'Must include estimated annual savings'
  );
  assert.ok(
    rawPdfText.includes(`${calc.paybackPeriodYears} Years`),
    'Must include estimated payback period'
  );
  assert.ok(
    rawPdfText.includes(`${calc.assumptions.performanceRatio}`),
    'Must include performance ratio'
  );
  assert.ok(
    rawPdfText.includes(`${calc.assumptions.systemLossesPercent}%`),
    'Must include system-loss assumptions'
  );
  assert.ok(
    rawPdfText.includes(`INR ${calc.assumptions.discomTariffRateInr} / kWh`),
    'Must include applicable tariff assumptions'
  );
  assert.ok(
    rawPdfText.includes('GERC'),
    'Must include regulatory disclosures'
  );
});

// ============================================================================
// TESTS 2, 3, 4: GREEN IMPACT PASSPORT PDF GENERATION, EMBEDDED QR & DISCLAIMER
// ============================================================================
test('2, 3 & 4. Green Impact Passport PDF generates valid application/pdf with actual user data, embedded QR, and exact prototype disclosure', async () => {
  const verificationUrl = 'https://urjasaathi.geda-life.org/verify/uvt_testnonce123456_testhmactag987654321';

  const pdfBytes = await generateGreenPassportPdf({
    holderName: 'Meera Trivedi',
    publicDisplayConsent: true,
    passportId: 'GEDA-LIFE-2026-99AA88BB',
    district: 'Rajkot',
    greenScore: 91,
    tierName: 'Surya Ratna (Solar Jewel)',
    completedMissionsCount: 6,
    completedMissionTitles: ['Set AC to 24°C', 'Eliminate Vampire Standby Load'],
    co2SavedKg: 48.5,
    treeEquivalent: 29,
    streakDays: 14,
    badges: [
      {
        id: 'pioneer',
        name: 'Mission LiFE Pioneer',
        category: 'Foundation',
        unlocked: true,
        description: 'Completed onboarding and established household carbon baseline.',
      },
      {
        id: 'ac_master',
        name: 'AC 24°C Maestro',
        category: 'Cooling',
        unlocked: true,
        description: 'Maintained AC at 24°C during peak hours.',
      },
      {
        id: 'carbon_guardian',
        name: '100 kg CO2 Guardian',
        category: 'Impact',
        unlocked: false,
        description: 'Averted over 100 kg of CO2.',
      },
    ],
    issueDate: new Date('2026-11-03T12:00:00.000Z'),
    verificationUrl,
    persistenceMode: 'supabase_postgres',
    durableStorageAvailable: true,
    credentialStatus: 'active',
  });

  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.byteLength > 3500, 'Passport PDF must be non-empty and include embedded PNG QR');
  const header = Buffer.from(pdfBytes.slice(0, 5)).toString('utf8');
  assert.equal(header, '%PDF-');

  const loadedDoc = await PDFDocument.load(pdfBytes);
  assert.equal(loadedDoc.getPageCount(), 1);

  const rawPdfText = extractReadablePdfText(pdfBytes);
  assert.ok(rawPdfText.includes('URJASAATHI'), 'Must include UrjaSaathi branding');
  assert.ok(rawPdfText.includes('Meera Trivedi'), 'Must include passport holder actual profile name');
  assert.ok(rawPdfText.includes('GEDA-LIFE-2026-99AA88BB'), 'Must include unique passport ID');
  assert.ok(rawPdfText.includes('91 / 100'), 'Must include Green Score');
  assert.ok(rawPdfText.includes('6 Missions'), 'Must include Completed Missions');
  assert.ok(rawPdfText.includes('48.5 kg CO2'), 'Must include environmental contribution');
  assert.ok(rawPdfText.includes('Mission LiFE Pioneer'), 'Must include achievement badges');
  assert.ok(rawPdfText.includes(verificationUrl), 'Must include verification URL');
  assert.ok(
    rawPdfText.includes(PROTOTYPE_PASSPORT_DISCLAIMER),
    'Must include exact prototype disclaimer verbatim'
  );
});

// ============================================================================
// TESTS 5 & 6: REAL QR CODE GENERATION & OPTICAL SCANNER DECODING (jsQR)
// ============================================================================
test('5 & 6. Generated QR image is a genuine ISO/IEC 18004 QR code that optically decodes to the exact verification URL', async () => {
  const targetUrl =
    'https://urjasaathi.geda-life.org/verify/uvt_9f8e7d6c5b4a3210_AbCdEfGhIjKlMnOpQrStUv';

  const dataUrl = await generateQrCodeDataUrl(targetUrl);
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));

  const pngBytes = await generateQrCodePngBytes(targetUrl);
  const decodedPng = PNG.sync.read(Buffer.from(pngBytes));
  assert.ok(decodedPng.width >= 200);
  assert.ok(decodedPng.height >= 200);

  // Run optical QR scanner (jsQR) over the raw RGBA pixel matrix
  const qrScanResult = jsQR(
    new Uint8ClampedArray(decodedPng.data),
    decodedPng.width,
    decodedPng.height
  );

  assert.ok(qrScanResult, 'jsQR optical scanner must detect a valid QR code in the PNG');
  assert.equal(qrScanResult.data, targetUrl, 'Decoded QR payload must match exact verification URL');
});

// ============================================================================
// TESTS 7, 8, 9, 10: TOKEN LIFECYCLE (VALID, INVALID, UNKNOWN, REVOKED, CONSENT)
// ============================================================================
test('7, 8, 9 & 10. Server-side persistence verifies valid tokens, hashes secrets, respects public name consent, and handles invalid, unknown, and revoked tokens', async () => {
  const ledgerPath = createTempLedgerPath('lifecycle');
  const engine = new DurablePersistenceEngine({
    ledgerFilePath: ledgerPath,
    env: {
      URJASAATHI_SESSION_SECRET: 'test-session-secret-key-for-passport-qr-2026',
    },
  });

  // Complete a mission first so the user has recorded contributions
  await engine.completeMissionAtomically({
    verifiedUserId: 'usr_citizen_vadodara',
    mission: {
      id: 'm-ac-24',
      title: 'Set AC to 24°C',
      points: 50,
      co2SavedKg: 12.4,
      inrSaved: 185,
    },
    now: new Date('2026-11-03T09:00:00.000Z'),
  });

  // Issue passport credential with publicDisplayConsent = true
  const issued = await engine.upsertCredentialRecord({
    verifiedUserId: 'usr_citizen_vadodara',
    holderName: 'Dhaval Joshi',
    district: 'Vadodara',
    greenScore: 88,
    publicDisplayConsent: true,
    unlockedBadgeIds: ['pioneer', 'ac_master'],
  });

  assert.ok(issued.verificationToken.startsWith('uvt_'));
  assert.equal(issued.tokenHash.length, 64);

  // Verify raw token is NOT stored in payload_hash or qr_verification_path; only SHA-256 tokenHash is stored
  assert.equal(issued.record.payload_hash.length, 64);
  assert.ok(
    !issued.record.payload_hash.includes(issued.verificationToken) &&
      !issued.record.qr_verification_path.includes(issued.verificationToken),
    'Raw verification token must never be stored in the database row'
  );
  assert.ok(
    issued.record.qr_verification_path.includes(`th=${issued.tokenHash}`),
    'SHA-256 tokenHash must be stored in credential record metadata'
  );

  // 7. Valid passport token verification
  const validVerify = await engine.verifyPublicPassportToken(issued.verificationToken);
  assert.equal(validVerify.verified, true);
  assert.equal(validVerify.verificationState, 'verified');
  assert.equal(validVerify.signatureValid, true);
  assert.ok(validVerify.publicCredential);
  assert.equal(validVerify.publicCredential.passportId, issued.record.credential_id);
  assert.equal(validVerify.publicCredential.holderDisplayName, 'Dhaval Joshi');
  assert.equal(validVerify.publicCredential.greenScore, 88);
  assert.equal(validVerify.publicCredential.missionsCompleted, 1);
  assert.equal(validVerify.publicCredential.co2SavedKg, 12.4);
  assert.deepEqual(validVerify.publicCredential.unlockedBadgeIds, ['pioneer', 'ac_master']);

  // Ensure private household bills (inr_saved) and internal user_id are NEVER exposed in publicCredential
  assert.equal('inr_saved' in (validVerify.publicCredential as any), false);
  assert.equal('inrSaved' in (validVerify.publicCredential as any), false);
  assert.equal('user_id' in (validVerify.publicCredential as any), false);
  assert.equal('userId' in (validVerify.publicCredential as any), false);

  // Test public-display consent = false (anonymizes holder name on public verification)
  await engine.updateCredentialLifecycle({
    verifiedUserId: 'usr_citizen_vadodara',
    publicDisplayConsent: false,
  });
  const consentHiddenVerify = await engine.verifyPublicPassportToken(issued.verificationToken);
  assert.equal(consentHiddenVerify.verified, true);
  assert.equal(
    consentHiddenVerify.publicCredential?.holderDisplayName,
    'Verified Household Citizen (Public Name Withheld)'
  );

  // 8. Invalid passport token
  const malformedVerify = await engine.verifyPublicPassportToken('bad_token_123');
  assert.equal(malformedVerify.verified, false);
  assert.equal(malformedVerify.verificationState, 'invalid_token');
  assert.equal(malformedVerify.publicCredential, null);

  // 9. Unknown passport token & Unknown passport ID
  const unknownTokenVerify = await engine.verifyPublicPassportToken(
    'uvt_0000000000000000_UnknownTag123456789012'
  );
  assert.equal(unknownTokenVerify.verified, false);
  assert.equal(unknownTokenVerify.verificationState, 'unknown_token');

  const unknownIdVerify = await engine.verifyPublicPassportToken('GEDA-LIFE-2026-00000000');
  assert.equal(unknownIdVerify.verified, false);
  assert.equal(unknownIdVerify.verificationState, 'unknown_token');

  // 10. Revoked passport
  await engine.updateCredentialLifecycle({
    verifiedUserId: 'usr_citizen_vadodara',
    status: 'revoked',
  });
  const revokedVerify = await engine.verifyPublicPassportToken(issued.verificationToken);
  assert.equal(revokedVerify.verified, false);
  assert.equal(revokedVerify.verificationState, 'revoked');
  assert.equal(revokedVerify.publicCredential?.credentialStatus, 'revoked');
});

// ============================================================================
// TEST 11: DEPLOYMENT COMPATIBILITY (APP_BASE_URL & NO LOCALHOST IN PROD)
// ============================================================================
test('11. QR verification URL resolution uses APP_BASE_URL or deployed HTTPS host and avoids localhost in production', () => {
  // Explicit APP_BASE_URL takes top precedence even if requestHost is localhost
  const fromEnv = resolveVerificationBaseUrl({
    env: { APP_BASE_URL: 'https://urjasaathi-gujarat.vercel.app/' },
    requestProtocol: 'http',
    requestHost: 'localhost:3000',
  });
  assert.equal(fromEnv, 'https://urjasaathi-gujarat.vercel.app');

  // Vercel production env variable fallback
  const fromVercel = resolveVerificationBaseUrl({
    env: { VERCEL_PROJECT_PRODUCTION_URL: 'urjasaathi-prod.vercel.app' },
    requestProtocol: 'http',
    requestHost: 'localhost:3000',
  });
  assert.equal(fromVercel, 'https://urjasaathi-prod.vercel.app');

  // Deployed Cloud Run / custom HTTPS host header
  const fromForwardedHost = resolveVerificationBaseUrl({
    env: {},
    requestProtocol: 'https',
    requestHost: 'ais-pre-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app',
  });
  assert.equal(
    fromForwardedHost,
    'https://ais-pre-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app'
  );
});

// ============================================================================
// TEST 12: REAL DOWNLOAD FUNCTIONALITY & MOBILE BROWSER COMPATIBILITY
// ============================================================================
test('12. Download helper validates non-empty %PDF- binary, sets application/pdf MIME type, and uses correct filenames', async () => {
  assert.equal(SOLAR_REPORT_FILENAME, 'UrjaSaathi_Solar_Report.pdf');
  assert.equal(PASSPORT_REPORT_FILENAME, 'UrjaSaathi_Green_Impact_Passport.pdf');
  assert.equal(IMPACT_REPORT_FILENAME, 'UrjaSaathi_Impact_Report.pdf');

  const calc = calculateSolarFeasibility({
    monthlyKwh: 320,
    rooftopAreaSqFt: 400,
    district: 'Surat',
    monthlyBillInr: 2000,
  });
  const solarPdf = await generateSolarFeasibilityPdf({
    applicantName: 'Ananya Shah',
    district: 'Surat',
    monthlyKwh: 320,
    rooftopAreaSqFt: 400,
    calculation: calc,
  });

  const result = triggerBrowserPdfDownload(solarPdf, SOLAR_REPORT_FILENAME);
  assert.equal(result.filename, 'UrjaSaathi_Solar_Report.pdf');
  assert.equal(result.mimeType, 'application/pdf');
  assert.ok(result.sizeBytes > 2500);

  // Rejects empty or non-PDF buffers
  assert.throws(() => triggerBrowserPdfDownload(new Uint8Array(0), SOLAR_REPORT_FILENAME));
  assert.throws(() =>
    triggerBrowserPdfDownload(new Uint8Array([1, 2, 3, 4, 5]), SOLAR_REPORT_FILENAME)
  );
});

// ============================================================================
// TEST 13: SEPARATE IMPACT REPORT PDF vs GREEN IMPACT PASSPORT PDF
// ============================================================================
test('13. generateImpactReportPdf generates UrjaSaathi_Impact_Report.pdf with actual recorded energy usage, savings, missions, points, monthly progress, methodology, assumptions, and date (separate from Green Impact Passport)', async () => {
  const impactBytes = await generateImpactReportPdf({
    holderName: 'Rameshbhai Patel',
    district: 'Ahmedabad',
    familyMembers: 4,
    monthlyKwh: 280,
    monthlyBillInr: 1750,
    baselineMonthlyCarbonKg: 189,
    potentialMonthlySavingKwh: 56,
    potentialMonthlySavingInr: 350,
    greenScore: 84,
    tierName: 'Urja Rakshak (Energy Guardian)',
    streakDays: 3,
    rewardPoints: 130,
    totalElectricityInrSaved: 265,
    totalCo2SavedKg: 18.2,
    completedMissionsCount: 2,
    completedMissions: [
      {
        missionId: 'm-ac-24',
        title: 'Set AC to 24°C',
        completionDate: '2026-11-02',
        points: 50,
        co2SavedKg: 12.4,
        inrSaved: 185,
      },
      {
        missionId: 'm-phantom-power',
        title: 'Eliminate Vampire Standby Load',
        completionDate: '2026-11-03',
        points: 80,
        co2SavedKg: 5.8,
        inrSaved: 80,
      },
    ],
    monthlyProgress: [
      { month: 'Recorded Baseline', actualKwh: 280, targetKwh: 300 },
      { month: 'After Recorded Missions', actualKwh: 253, targetKwh: 300 },
    ],
    generatedAt: new Date('2026-11-03T06:30:00.000Z'),
  });

  assert.ok(impactBytes instanceof Uint8Array);
  assert.ok(impactBytes.byteLength > 2500, 'Impact Report PDF must be non-empty');
  const header = Buffer.from(impactBytes.slice(0, 5)).toString('utf8');
  assert.equal(header, '%PDF-');

  const loadedImpactDoc = await PDFDocument.load(impactBytes);
  assert.equal(loadedImpactDoc.getPageCount(), 1);
  assert.equal(
    loadedImpactDoc.getTitle(),
    'UrjaSaathi Household Energy & Sustainability Impact Report'
  );

  const impactDownload = triggerBrowserPdfDownload(impactBytes, IMPACT_REPORT_FILENAME);
  assert.equal(impactDownload.filename, 'UrjaSaathi_Impact_Report.pdf');
  assert.equal(impactDownload.mimeType, 'application/pdf');

  const rawImpactText = extractReadablePdfText(impactBytes);
  // Verify distinctness from Green Impact Passport
  assert.ok(
    rawImpactText.includes('HOUSEHOLD ENERGY USAGE & SUSTAINABILITY IMPACT REPORT'),
    'Must carry Impact Report title header'
  );
  assert.ok(
    !rawImpactText.includes('GREEN IMPACT PASSPORT - DIGITAL SUSTAINABILITY CREDENTIAL'),
    'Impact Report must not generate the Green Impact Passport header'
  );

  // Verify all required recorded sections and values
  assert.ok(rawImpactText.includes('Rameshbhai Patel'), 'Must include actual household name');
  assert.ok(rawImpactText.includes('280 kWh / month'), 'Must include household energy usage');
  assert.ok(rawImpactText.includes('INR 265 saved'), 'Must include recorded electricity savings');
  assert.ok(rawImpactText.includes('18.2 kg CO2 averted'), 'Must include recorded carbon savings');
  assert.ok(
    rawImpactText.includes('CEA') && rawImpactText.includes('0.675 kg CO2 / kWh'),
    'Must include carbon savings methodology'
  );
  assert.ok(rawImpactText.includes('2 Missions'), 'Must include completed missions count');
  assert.ok(
    rawImpactText.includes('Set AC to 24') &&
      rawImpactText.includes('Eliminate Vampire Standby Load'),
    'Must include completed mission records'
  );
  assert.ok(rawImpactText.includes('130 LiFE Points'), 'Must include reward points');
  assert.ok(
    rawImpactText.includes('Recorded Baseline: Actual 280 kWh vs Target 300 kWh'),
    'Must include monthly progress'
  );
  assert.ok(
    rawImpactText.includes('Calculation Assumptions:') &&
      rawImpactText.includes('(Watts x Daily Hours x Days) / 1000'),
    'Must include calculation assumptions'
  );
  assert.ok(
    rawImpactText.includes('Report Generation Date:') && rawImpactText.includes('2026'),
    'Must include report generation date'
  );
});

