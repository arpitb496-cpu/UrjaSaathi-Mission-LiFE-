import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import type { SolarCalculationResult } from './sustainabilityMath.ts';

export const PROTOTYPE_PASSPORT_DISCLAIMER =
  'This is a prototype digital sustainability credential created for the GEDA Mission LiFE Hackathon. It is not an officially issued GEDA or government certificate.';

export const SOLAR_REPORT_FILENAME = 'UrjaSaathi_Solar_Report.pdf';
export const PASSPORT_REPORT_FILENAME = 'UrjaSaathi_Green_Impact_Passport.pdf';
export const IMPACT_REPORT_FILENAME = 'UrjaSaathi_Impact_Report.pdf';

export interface ImpactReportMissionEntry {
  missionId: string;
  title: string;
  completionDate: string;
  points: number;
  co2SavedKg: number;
  inrSaved: number;
}

export interface ImpactReportMonthlyProgressEntry {
  month: string;
  actualKwh: number;
  targetKwh: number;
}

export interface ImpactReportPdfInput {
  holderName: string;
  district: string;
  familyMembers: number;
  monthlyKwh: number;
  monthlyBillInr: number;
  baselineMonthlyCarbonKg: number;
  potentialMonthlySavingKwh: number;
  potentialMonthlySavingInr: number;
  greenScore: number;
  tierName: string;
  streakDays: number;
  rewardPoints: number;
  totalElectricityInrSaved: number;
  totalCo2SavedKg: number;
  completedMissionsCount: number;
  completedMissions: ImpactReportMissionEntry[];
  monthlyProgress?: ImpactReportMonthlyProgressEntry[];
  generatedAt?: Date | string;
}

export interface SolarPdfInput {
  applicantName: string;
  district: string;
  monthlyKwh: number;
  monthlyBillInr?: number;
  rooftopAreaSqFt: number;
  hasBatteryBackup?: boolean;
  calculation: SolarCalculationResult;
  generatedAt?: Date | string;
}

export interface PassportBadgeItem {
  id: string;
  name: string;
  category: string;
  unlocked: boolean;
  description?: string;
}

export interface PassportPdfInput {
  holderName: string;
  publicDisplayConsent?: boolean;
  passportId: string;
  district: string;
  greenScore: number;
  tierName: string;
  completedMissionsCount: number;
  completedMissionTitles?: string[];
  co2SavedKg: number;
  treeEquivalent: number;
  streakDays: number;
  badges: PassportBadgeItem[];
  issueDate: Date | string;
  verificationUrl: string;
  persistenceMode: 'supabase_postgres' | 'local_demo_fallback';
  durableStorageAvailable: boolean;
  credentialStatus?: 'active' | 'revoked';
}

/**
 * Sanitizes text for StandardFonts (WinAnsiEncoding) in pdf-lib so special Unicode
 * symbols like ₹, CO₂, or emojis never throw encoding errors.
 */
export function sanitizePdfText(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/₹/g, 'INR ')
    .replace(/₂/g, '2')
    .replace(/²/g, '^2')
    .replace(/[•·]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim();
}

export function formatInrPdf(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  return `INR ${rounded.toLocaleString('en-IN')}`;
}

export function formatIstDate(dateInput?: Date | string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function isLocalUrlOrHost(value: string): boolean {
  const clean = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .toLowerCase();
  return (
    clean.startsWith('localhost') ||
    clean.startsWith('127.0.0.1') ||
    clean.startsWith('0.0.0.0')
  );
}

function normalizeCandidateBaseUrl(raw?: string): string | null {
  if (!raw) return null;
  let trimmed = raw
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/^[A-Za-z_][A-Za-z0-9_]*=/, '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\/+$/, '');
  if (!trimmed) return null;
  if (
    trimmed.includes('YOUR-DEPLOYED-DOMAIN') ||
    trimmed.includes('example.com') ||
    trimmed.includes('<') ||
    trimmed.includes('>')
  ) {
    return null;
  }

  // If a domain was provided without protocol (e.g. "urjasaathi.vercel.app"), prefix https://
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
    const isLocalHost = isLocalUrlOrHost(trimmed);
    trimmed = `${isLocalHost ? 'http' : 'https'}://${trimmed}`;
  }

  // Upgrade non-local http:// URLs to https:// for production security
  if (trimmed.startsWith('http://')) {
    const hostPart = trimmed.slice('http://'.length);
    if (!isLocalUrlOrHost(hostPart)) {
      trimmed = `https://${hostPart}`;
    }
  }

  return trimmed;
}

/**
 * Resolves the canonical base URL for QR verification links.
 * Prioritizes APP_BASE_URL / deployed HTTPS domains and avoids encoding localhost in production.
 */
export function resolveVerificationBaseUrl(options?: {
  env?: Record<string, string | undefined>;
  requestProtocol?: string;
  requestHost?: string;
  browserOrigin?: string;
}): string {
  const env = options?.env || (typeof process !== 'undefined' ? process.env : {});
  const viteBaseUrl =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env.VITE_APP_BASE_URL
      : undefined;

  const candidates = [
    env.APP_BASE_URL,
    env.VITE_APP_BASE_URL,
    viteBaseUrl,
    env.PUBLIC_APP_URL,
    env.APP_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
  ];

  let localEnvFallback: string | null = null;

  for (const raw of candidates) {
    const normalized = normalizeCandidateBaseUrl(raw);
    if (normalized) {
      if (!isLocalUrlOrHost(normalized)) {
        return normalized;
      }
      if (!localEnvFallback) {
        localEnvFallback = normalized;
      }
    }
  }

  if (options?.requestHost) {
    const host = options.requestHost.trim();
    const isLocal = isLocalUrlOrHost(host);
    const proto = isLocal ? options.requestProtocol || 'http' : 'https';
    if (!isLocal) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  if (options?.browserOrigin) {
    const normalizedOrigin = normalizeCandidateBaseUrl(options.browserOrigin);
    if (normalizedOrigin && !isLocalUrlOrHost(normalizedOrigin)) {
      return normalizedOrigin;
    }
  }

  if (localEnvFallback) {
    return localEnvFallback;
  }

  if (options?.browserOrigin) {
    const normalizedOrigin = normalizeCandidateBaseUrl(options.browserOrigin);
    if (normalizedOrigin) {
      return normalizedOrigin;
    }
  }

  if (options?.requestHost) {
    const proto = options.requestProtocol || 'http';
    return `${proto}://${options.requestHost.trim()}`.replace(/\/+$/, '');
  }

  return 'https://urjasaathi.geda-life.org';
}

/**
 * Generates a real ISO/IEC 18004 QR Code as a PNG Data URL (`data:image/png;base64,...`).
 */
export async function generateQrCodeDataUrl(verificationUrl: string): Promise<string> {
  const cleanUrl = (verificationUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Verification URL is required to generate a QR code.');
  }
  return QRCode.toDataURL(cleanUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
}

/**
 * Generates raw PNG bytes (`Uint8Array`) for a QR code encoding `verificationUrl`.
 */
export async function generateQrCodePngBytes(verificationUrl: string): Promise<Uint8Array> {
  const dataUrl = await generateQrCodeDataUrl(verificationUrl);
  const base64Part = dataUrl.split(',')[1];
  if (!base64Part) {
    throw new Error('Failed to encode QR code PNG bytes.');
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64Part, 'base64'));
  }
  const binary = atob(base64Part);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Wraps long text into lines that fit within `maxWidth` at `fontSize`.
 */
function wrapTextLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const clean = sanitizePdfText(text);
  if (!clean) return [''];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * PART A: Generates a real downloadable Solar Feasibility PDF (`application/pdf`)
 * containing all required user inputs, financial breakdown, assumptions, and disclosures.
 */
export async function generateSolarFeasibilityPdf(input: SolarPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('UrjaSaathi Solar Feasibility Summary Report');
  pdfDoc.setAuthor('UrjaSaathi - GEDA Mission LiFE Platform');
  pdfDoc.setSubject(`Rooftop Solar Feasibility Report for ${sanitizePdfText(input.applicantName)}`);
  pdfDoc.setCreator('UrjaSaathi Document Engine');

  const page: PDFPage = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
  const { width, height } = page.getSize();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const applicantName = sanitizePdfText(input.applicantName || 'Household Applicant');
  const district = sanitizePdfText(input.district || 'Ahmedabad');
  const reportDate = formatIstDate(input.generatedAt);
  const calc = input.calculation;

  // 1. Top Header Banner (UrjaSaathi Branding)
  page.drawRectangle({
    x: 0,
    y: height - 88,
    width,
    height: 88,
    color: rgb(0.08, 0.33, 0.18), // #14532D
  });

  page.drawText('URJASAATHI', {
    x: 36,
    y: height - 34,
    size: 18,
    font: fontBold,
    color: rgb(0.64, 0.9, 0.21), // #A3E635
  });

  page.drawText('GEDA Mission LiFE & PM Surya Ghar: Rooftop Solar Feasibility Report', {
    x: 36,
    y: height - 54,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(
    sanitizePdfText(`Report Generation Date: ${reportDate}  |  Jurisdiction: ${district}, Gujarat`),
    {
      x: 36,
      y: height - 72,
      size: 9,
      font: fontRegular,
      color: rgb(0.82, 0.98, 0.89),
    }
  );

  let cursorY = height - 112;

  // Helper to draw a section title bar
  const drawSectionHeader = (title: string) => {
    page.drawRectangle({
      x: 36,
      y: cursorY - 18,
      width: width - 72,
      height: 22,
      color: rgb(0.93, 0.98, 0.95),
    });
    page.drawText(sanitizePdfText(title), {
      x: 44,
      y: cursorY - 11,
      size: 10,
      font: fontBold,
      color: rgb(0.08, 0.33, 0.18),
    });
    cursorY -= 28;
  };

  // Helper to draw a two-column key-value row
  const drawKeyValueGrid = (rows: Array<[string, string, string, string]>) => {
    for (const [k1, v1, k2, v2] of rows) {
      page.drawText(sanitizePdfText(k1), {
        x: 44,
        y: cursorY,
        size: 9,
        font: fontRegular,
        color: rgb(0.35, 0.4, 0.45),
      });
      page.drawText(sanitizePdfText(v1), {
        x: 175,
        y: cursorY,
        size: 9.5,
        font: fontBold,
        color: rgb(0.08, 0.12, 0.18),
      });

      if (k2) {
        page.drawText(sanitizePdfText(k2), {
          x: 315,
          y: cursorY,
          size: 9,
          font: fontRegular,
          color: rgb(0.35, 0.4, 0.45),
        });
        page.drawText(sanitizePdfText(v2), {
          x: 455,
          y: cursorY,
          size: 9.5,
          font: fontBold,
          color: rgb(0.08, 0.12, 0.18),
        });
      }

      page.drawLine({
        start: { x: 44, y: cursorY - 5 },
        end: { x: width - 44, y: cursorY - 5 },
        thickness: 0.4,
        color: rgb(0.88, 0.91, 0.94),
      });
      cursorY -= 18;
    }
    cursorY -= 6;
  };

  // SECTION 1: Applicant & Household Inputs
  drawSectionHeader('1. Applicant Profile & Household Electricity Inputs');
  drawKeyValueGrid([
    [
      'Applicant Name:',
      applicantName,
      'Gujarat District:',
      `${district}, Gujarat`,
    ],
    [
      'Monthly Consumption:',
      `${input.monthlyKwh} kWh / month`,
      'Available Rooftop Area:',
      `${input.rooftopAreaSqFt} sq. ft`,
    ],
    [
      'Current Monthly Bill:',
      input.monthlyBillInr !== undefined
        ? formatInrPdf(input.monthlyBillInr)
        : formatInrPdf(Math.round(input.monthlyKwh * calc.assumptions.discomTariffRateInr)),
      'System Configuration:',
      input.hasBatteryBackup ? 'Hybrid PV + Battery Backup' : 'On-Grid Net-Metered PV',
    ],
  ]);

  // SECTION 2: Recommended System Sizing & Energy Yield
  drawSectionHeader('2. Recommended Solar PV Capacity & Generation Forecast');
  drawKeyValueGrid([
    [
      'Recommended Capacity:',
      `${calc.suggestedCapacityKw} kW Rooftop PV`,
      'Estimated Monthly Gen:',
      `${calc.monthlyGenerationKwh} kWh / month`,
    ],
    [
      'Estimated Annual Gen:',
      `${calc.annualGenerationKwh} kWh / year`,
      'Solar Bill Offset:',
      `${calc.solarCoveragePercent}% Coverage`,
    ],
    [
      'Shadow-Free Area Needed:',
      `${Math.round(calc.suggestedCapacityKw * 100)} sq. ft`,
      'Solar Panels Count:',
      `${Math.max(1, Math.ceil((calc.suggestedCapacityKw * 1000) / 540))} Panels (540 Wp Mono-PERC)`,
    ],
  ]);

  // SECTION 3: Capital Cost, PM Surya Ghar Subsidy & ROI
  drawSectionHeader('3. Financial Breakdown, PM Surya Ghar Subsidy & Payback Economics');
  drawKeyValueGrid([
    [
      'Gross Estimated Cost:',
      formatInrPdf(calc.grossSystemCostInr),
      'PM Surya Ghar Subsidy:',
      `- ${formatInrPdf(calc.applicableSubsidyInr)}`,
    ],
    [
      'Net Estimated Investment:',
      formatInrPdf(calc.netSystemCostInr),
      'Est. Annual Savings:',
      `${formatInrPdf(calc.annualSavingsInr)} / year`,
    ],
    [
      'Est. Monthly Savings:',
      `${formatInrPdf(calc.monthlySavingsInr)} / month`,
      'Estimated Payback Period:',
      `${calc.paybackPeriodYears} Years`,
    ],
    [
      '25-Year Cumulative Gain:',
      formatInrPdf(calc.twentyFiveYearSavingsInr),
      '25-Year CO2 Averted:',
      `${calc.twentyFiveYearCo2ReductionTonnes} Tonnes CO2`,
    ],
  ]);

  // SECTION 4: Performance Ratio, System-Loss & Tariff Assumptions
  drawSectionHeader('4. Performance Ratio, System-Loss & Tariff Assumptions');
  drawKeyValueGrid([
    [
      'Performance Ratio (PR):',
      `${calc.assumptions.performanceRatio} (${(calc.assumptions.performanceRatio * 100).toFixed(1)}%)`,
      'Total System Losses:',
      `${calc.assumptions.systemLossesPercent}%`,
    ],
    [
      'Solar Insolation:',
      `${calc.assumptions.solarIrradiancePshPerDay} PSH / day`,
      'Monthly Specific Yield:',
      `${calc.assumptions.generationPerKwMonthlyKwh} kWh / kW / mo`,
    ],
    [
      'Applicable DISCOM Tariff:',
      `INR ${calc.assumptions.discomTariffRateInr} / kWh`,
      'Surplus Export Tariff:',
      `INR ${calc.assumptions.surplusInjectionCompensationInr} / kWh (GERC 2026)`,
    ],
    [
      'Benchmark Capital Cost:',
      `${formatInrPdf(calc.assumptions.baseSystemCostPerKwInr)} / kW`,
      'Annual PV Degradation:',
      `${calc.assumptions.annualDegradationPct}% / year`,
    ],
  ]);

  // SECTION 5: Regulatory Disclosures & Limitations
  drawSectionHeader('5. Regulatory Disclosures, Subsidy Conditions & Limitations');

  const disclaimerLines = wrapTextLines(
    `Technical & Regulatory Disclosure: ${calc.disclaimer}`,
    fontRegular,
    8.5,
    width - 88
  );
  for (const line of disclaimerLines) {
    page.drawText(line, {
      x: 44,
      y: cursorY,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.25, 0.3, 0.35),
    });
    cursorY -= 12;
  }

  cursorY -= 4;
  page.drawText('PM Surya Ghar: Muft Bijli Yojana Eligibility & Limitations:', {
    x: 44,
    y: cursorY,
    size: 8.5,
    font: fontBold,
    color: rgb(0.1, 0.25, 0.18),
  });
  cursorY -= 12;

  for (const cond of calc.eligibilityConditions.slice(0, 4)) {
    const condLines = wrapTextLines(`- ${cond}`, fontRegular, 8, width - 96);
    for (const line of condLines) {
      page.drawText(line, {
        x: 48,
        y: cursorY,
        size: 8,
        font: fontRegular,
        color: rgb(0.25, 0.3, 0.35),
      });
      cursorY -= 11;
    }
  }

  // Footer
  page.drawLine({
    start: { x: 36, y: 46 },
    end: { x: width - 36, y: 46 },
    thickness: 0.6,
    color: rgb(0.8, 0.85, 0.82),
  });

  page.drawText(
    sanitizePdfText(
      `Generated by UrjaSaathi Solar Feasibility Engine on ${reportDate} | Non-binding Engineering Estimate for ${applicantName} (${district})`
    ),
    {
      x: 36,
      y: 32,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.55),
    }
  );

  pdfDoc.setKeywords([
    'URJASAATHI',
    `Applicant: ${applicantName}`,
    `District: ${district}, Gujarat`,
    `Consumption: ${input.monthlyKwh} kWh / month`,
    `Rooftop: ${input.rooftopAreaSqFt} sq. ft`,
    `Capacity: ${calc.suggestedCapacityKw} kW Rooftop PV`,
    `MonthlyGen: ${calc.monthlyGenerationKwh} kWh / month`,
    `GrossCost: INR ${calc.grossSystemCostInr.toLocaleString('en-IN')}`,
    `Subsidy: INR ${calc.applicableSubsidyInr.toLocaleString('en-IN')}`,
    `NetInvestment: INR ${calc.netSystemCostInr.toLocaleString('en-IN')}`,
    `AnnualSavings: INR ${calc.annualSavingsInr.toLocaleString('en-IN')} / year`,
    `Payback: ${calc.paybackPeriodYears} Years`,
    `PR: ${calc.assumptions.performanceRatio}`,
    `Losses: ${calc.assumptions.systemLossesPercent}%`,
    `Tariff: INR ${calc.assumptions.discomTariffRateInr} / kWh`,
    `Date: ${reportDate}`,
    sanitizePdfText(calc.disclaimer),
  ]);

  return pdfDoc.save({ useObjectStreams: false });
}

/**
 * PART B: Generates a real downloadable Green Impact Passport PDF (`application/pdf`)
 * with embedded PNG QR verification code, holder profile, badges, and exact prototype disclosure.
 */
export async function generateGreenPassportPdf(input: PassportPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`UrjaSaathi Green Impact Passport - ${sanitizePdfText(input.passportId)}`);
  pdfDoc.setAuthor('UrjaSaathi - GEDA Mission LiFE Hackathon Prototype');
  pdfDoc.setSubject(`Green Impact Passport for ${sanitizePdfText(input.holderName)}`);
  pdfDoc.setCreator('UrjaSaathi Credential Engine');

  const page: PDFPage = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
  const { width, height } = page.getSize();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const holderName = sanitizePdfText(input.holderName || 'Household Citizen');
  const passportId = sanitizePdfText(input.passportId);
  const district = sanitizePdfText(input.district || 'Gujarat');
  const issueDateStr = formatIstDate(input.issueDate);
  const verificationUrl = sanitizePdfText(input.verificationUrl);

  // Embed real QR code PNG image
  const qrPngBytes = await generateQrCodePngBytes(input.verificationUrl);
  const qrImage = await pdfDoc.embedPng(qrPngBytes);

  // 1. Top Header Banner (UrjaSaathi Branding)
  page.drawRectangle({
    x: 0,
    y: height - 96,
    width,
    height: 96,
    color: rgb(0.08, 0.33, 0.18), // #14532D
  });

  page.drawText('URJASAATHI', {
    x: 36,
    y: height - 34,
    size: 19,
    font: fontBold,
    color: rgb(0.64, 0.9, 0.21),
  });

  page.drawText('GREEN IMPACT PASSPORT - DIGITAL SUSTAINABILITY CREDENTIAL', {
    x: 36,
    y: height - 54,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(
    sanitizePdfText(
      `Passport ID: ${passportId}   |   Issue Date: ${issueDateStr}   |   Status: ${(
        input.credentialStatus || 'active'
      ).toUpperCase()}`
    ),
    {
      x: 36,
      y: height - 74,
      size: 9,
      font: fontMono,
      color: rgb(0.85, 0.98, 0.9),
    }
  );

  // 2. Mandatory Exact Prototype Disclosure Banner at Top
  page.drawRectangle({
    x: 36,
    y: height - 144,
    width: width - 72,
    height: 36,
    color: rgb(0.99, 0.96, 0.88),
    borderColor: rgb(0.9, 0.72, 0.3),
    borderWidth: 0.8,
  });

  const disclaimerLines = wrapTextLines(
    PROTOTYPE_PASSPORT_DISCLAIMER,
    fontBold,
    8.5,
    width - 92
  );
  let discY = height - 122;
  for (const line of disclaimerLines) {
    page.drawText(line, {
      x: 46,
      y: discY,
      size: 8.5,
      font: fontBold,
      color: rgb(0.45, 0.28, 0.04),
    });
    discY -= 12;
  }

  let cursorY = height - 166;

  // 3. Passport Holder & QR Verification Card
  page.drawRectangle({
    x: 36,
    y: cursorY - 148,
    width: width - 72,
    height: 148,
    color: rgb(0.96, 0.99, 0.97),
    borderColor: rgb(0.68, 0.86, 0.76),
    borderWidth: 1,
  });

  page.drawText('PASSPORT HOLDER & CREDENTIAL DETAILS', {
    x: 48,
    y: cursorY - 20,
    size: 10,
    font: fontBold,
    color: rgb(0.08, 0.33, 0.18),
  });

  const detailRows: Array<[string, string]> = [
    ['Passport Holder Name:', holderName],
    ['Unique Passport ID:', passportId],
    ['District & State:', `${district}, Gujarat, India`],
    ['Green Score & Tier:', `${input.greenScore} / 100 (${sanitizePdfText(input.tierName)})`],
    ['Issue Date:', issueDateStr],
    [
      'Verification Mode:',
      input.durableStorageAvailable
        ? 'Durable Server Record (Supabase PostgreSQL)'
        : 'Demo Credential (Local Storage Fallback)',
    ],
  ];

  let infoY = cursorY - 40;
  for (const [label, val] of detailRows) {
    page.drawText(label, {
      x: 48,
      y: infoY,
      size: 9,
      font: fontRegular,
      color: rgb(0.35, 0.42, 0.45),
    });
    page.drawText(sanitizePdfText(val), {
      x: 175,
      y: infoY,
      size: 9.5,
      font: fontBold,
      color: rgb(0.07, 0.12, 0.16),
    });
    infoY -= 17;
  }

  // Draw Embedded Real QR Code on Right Side of Holder Card
  const qrBoxSize = 104;
  const qrX = width - 48 - qrBoxSize;
  const qrY = cursorY - 128;

  page.drawRectangle({
    x: qrX - 4,
    y: qrY - 4,
    width: qrBoxSize + 8,
    height: qrBoxSize + 8,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.75, 0.82, 0.79),
    borderWidth: 0.8,
  });

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrBoxSize,
    height: qrBoxSize,
  });

  page.drawText('SCAN TO VERIFY', {
    x: qrX + 14,
    y: qrY - 14,
    size: 7.5,
    font: fontBold,
    color: rgb(0.08, 0.33, 0.18),
  });

  cursorY -= 168;

  // 4. Recorded Environmental Contribution & Completed Missions Summary
  page.drawRectangle({
    x: 36,
    y: cursorY - 22,
    width: width - 72,
    height: 22,
    color: rgb(0.08, 0.33, 0.18),
  });
  page.drawText('RECORDED ENVIRONMENTAL CONTRIBUTION & COMPLETED MISSIONS', {
    x: 46,
    y: cursorY - 15,
    size: 9.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  cursorY -= 32;

  const metricBoxes = [
    { label: 'GREEN SCORE', value: `${input.greenScore} / 100`, sub: sanitizePdfText(input.tierName) },
    { label: 'COMPLETED MISSIONS', value: `${input.completedMissionsCount} Missions`, sub: `${input.streakDays} Day Active Streak` },
    { label: 'CO2 AVERTED', value: `${input.co2SavedKg} kg CO2`, sub: 'CEA Ver 22.0 Grid Factor' },
    { label: 'TREE EQUIVALENT', value: `${input.treeEquivalent} Trees`, sub: 'Annual Absorption Offset' },
  ];

  const boxWidth = (width - 72 - 24) / 4;
  metricBoxes.forEach((box, idx) => {
    const bx = 36 + idx * (boxWidth + 8);
    page.drawRectangle({
      x: bx,
      y: cursorY - 54,
      width: boxWidth,
      height: 54,
      color: rgb(0.95, 0.98, 0.96),
      borderColor: rgb(0.8, 0.88, 0.83),
      borderWidth: 0.7,
    });
    page.drawText(box.label, {
      x: bx + 8,
      y: cursorY - 15,
      size: 7,
      font: fontBold,
      color: rgb(0.3, 0.45, 0.38),
    });
    page.drawText(sanitizePdfText(box.value), {
      x: bx + 8,
      y: cursorY - 32,
      size: 11,
      font: fontBold,
      color: rgb(0.06, 0.28, 0.15),
    });
    page.drawText(sanitizePdfText(box.sub), {
      x: bx + 8,
      y: cursorY - 46,
      size: 7,
      font: fontRegular,
      color: rgb(0.4, 0.48, 0.44),
    });
  });

  cursorY -= 70;

  if (input.completedMissionTitles && input.completedMissionTitles.length > 0) {
    const missionListText = `Completed Mission Actions: ${input.completedMissionTitles.join(', ')}`;
    const missionLines = wrapTextLines(missionListText, fontRegular, 8.5, width - 88);
    for (const line of missionLines.slice(0, 3)) {
      page.drawText(line, {
        x: 44,
        y: cursorY,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.2, 0.28, 0.24),
      });
      cursorY -= 12;
    }
    cursorY -= 6;
  }

  // 5. Achievement Badges Section
  page.drawRectangle({
    x: 36,
    y: cursorY - 22,
    width: width - 72,
    height: 22,
    color: rgb(0.93, 0.98, 0.95),
  });
  const unlockedCount = input.badges.filter((b) => b.unlocked).length;
  page.drawText(
    sanitizePdfText(`ACHIEVEMENT BADGES (${unlockedCount}/${input.badges.length} UNLOCKED)`),
    {
      x: 46,
      y: cursorY - 15,
      size: 9.5,
      font: fontBold,
      color: rgb(0.08, 0.33, 0.18),
    }
  );
  cursorY -= 32;

  for (const badge of input.badges.slice(0, 8)) {
    const statusLabel = badge.unlocked ? '[UNLOCKED]' : '[LOCKED]';
    page.drawText(statusLabel, {
      x: 44,
      y: cursorY,
      size: 8.5,
      font: fontBold,
      color: badge.unlocked ? rgb(0.04, 0.5, 0.28) : rgb(0.55, 0.58, 0.62),
    });
    page.drawText(
      sanitizePdfText(`${badge.name} (${badge.category}) - ${badge.description || ''}`),
      {
        x: 112,
        y: cursorY,
        size: 8.5,
        font: badge.unlocked ? fontBold : fontRegular,
        color: badge.unlocked ? rgb(0.1, 0.18, 0.14) : rgb(0.5, 0.54, 0.58),
      }
    );
    cursorY -= 15;
  }

  cursorY -= 10;

  // 6. Verification URL & Cryptographic Record Box
  page.drawRectangle({
    x: 36,
    y: cursorY - 52,
    width: width - 72,
    height: 52,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.82, 0.86, 0.92),
    borderWidth: 0.7,
  });

  page.drawText('QR VERIFICATION URL & CREDENTIAL TRANSPARENCY', {
    x: 46,
    y: cursorY - 15,
    size: 8,
    font: fontBold,
    color: rgb(0.15, 0.25, 0.38),
  });

  page.drawText(sanitizePdfText(`Verification URL: ${verificationUrl}`), {
    x: 46,
    y: cursorY - 29,
    size: 8,
    font: fontMono,
    color: rgb(0.08, 0.33, 0.18),
  });

  page.drawText(
    sanitizePdfText(
      `Public Display Consent: ${
        input.publicDisplayConsent !== false ? 'Holder Name Permitted' : 'Anonymized on Public Scan'
      } | Private bills & phone numbers are never exposed.`
    ),
    {
      x: 46,
      y: cursorY - 43,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.46),
    }
  );

  // 7. Bottom Footer with Mandatory Prototype Disclaimer Repeat
  page.drawLine({
    start: { x: 36, y: 54 },
    end: { x: width - 36, y: 54 },
    thickness: 0.6,
    color: rgb(0.8, 0.85, 0.82),
  });

  page.drawText(PROTOTYPE_PASSPORT_DISCLAIMER, {
    x: 36,
    y: 40,
    size: 7.5,
    font: fontBold,
    color: rgb(0.35, 0.25, 0.1),
  });

  page.drawText(
    sanitizePdfText(
      `UrjaSaathi Digital Credential | Passport ID: ${passportId} | Issued: ${issueDateStr}`
    ),
    {
      x: 36,
      y: 27,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.55),
    }
  );

  pdfDoc.setKeywords([
    'URJASAATHI',
    `Holder: ${holderName}`,
    `PassportID: ${passportId}`,
    `District: ${district}`,
    `GreenScore: ${input.greenScore} / 100`,
    `Missions: ${input.completedMissionsCount} Missions`,
    `CO2: ${input.co2SavedKg} kg CO2`,
    `Badges: ${input.badges.map((b) => b.name).join(', ')}`,
    `IssueDate: ${issueDateStr}`,
    `VerificationURL: ${verificationUrl}`,
    PROTOTYPE_PASSPORT_DISCLAIMER,
  ]);

  return pdfDoc.save({ useObjectStreams: false });
}

/**
 * Generates a dedicated Household Energy & Sustainability Impact Report PDF (`UrjaSaathi_Impact_Report.pdf`)
 * for the My Impact and My Energy sections (distinct from the Green Impact Passport).
 */
export async function generateImpactReportPdf(input: ImpactReportPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('UrjaSaathi Household Energy & Sustainability Impact Report');
  pdfDoc.setAuthor('UrjaSaathi - GEDA Mission LiFE Platform');
  pdfDoc.setSubject(`Household Energy & Impact Report for ${sanitizePdfText(input.holderName)}`);
  pdfDoc.setCreator('UrjaSaathi Analytics Engine');

  const page: PDFPage = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
  const { width, height } = page.getSize();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const holderName = sanitizePdfText(input.holderName || 'Household Citizen');
  const district = sanitizePdfText(input.district || 'Ahmedabad');
  const familyMembers = Math.max(1, Number(input.familyMembers) || 1);
  const reportDate = formatIstDate(input.generatedAt);
  const perCapitaKwh = Math.round(input.monthlyKwh / familyMembers);
  const targetMonthlyKwh = familyMembers * 75;
  const effectiveTariff = Number(
    (input.monthlyBillInr / Math.max(1, input.monthlyKwh)).toFixed(2)
  );
  const estimatedKwhSavedFromMissions = Number(
    (input.totalCo2SavedKg / 0.675).toFixed(1)
  );

  // 1. Top Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 88,
    width,
    height: 88,
    color: rgb(0.08, 0.33, 0.18),
  });

  page.drawText('URJASAATHI', {
    x: 36,
    y: height - 34,
    size: 18,
    font: fontBold,
    color: rgb(0.64, 0.9, 0.21),
  });

  page.drawText('HOUSEHOLD ENERGY USAGE & SUSTAINABILITY IMPACT REPORT', {
    x: 36,
    y: height - 54,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(
    sanitizePdfText(
      `Report Generation Date: ${reportDate}  |  Household: ${holderName} (${district}, Gujarat)`
    ),
    {
      x: 36,
      y: height - 72,
      size: 9,
      font: fontRegular,
      color: rgb(0.82, 0.98, 0.89),
    }
  );

  let cursorY = height - 110;

  const drawSectionHeader = (title: string) => {
    page.drawRectangle({
      x: 36,
      y: cursorY - 17,
      width: width - 72,
      height: 21,
      color: rgb(0.93, 0.98, 0.95),
    });
    page.drawText(sanitizePdfText(title), {
      x: 44,
      y: cursorY - 10,
      size: 9.5,
      font: fontBold,
      color: rgb(0.08, 0.33, 0.18),
    });
    cursorY -= 26;
  };

  const drawKeyValueGrid = (rows: Array<[string, string, string, string]>) => {
    for (const [k1, v1, k2, v2] of rows) {
      page.drawText(sanitizePdfText(k1), {
        x: 44,
        y: cursorY,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.35, 0.4, 0.45),
      });
      page.drawText(sanitizePdfText(v1), {
        x: 175,
        y: cursorY,
        size: 9,
        font: fontBold,
        color: rgb(0.08, 0.12, 0.18),
      });

      if (k2) {
        page.drawText(sanitizePdfText(k2), {
          x: 315,
          y: cursorY,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.35, 0.4, 0.45),
        });
        page.drawText(sanitizePdfText(v2), {
          x: 450,
          y: cursorY,
          size: 9,
          font: fontBold,
          color: rgb(0.08, 0.12, 0.18),
        });
      }

      page.drawLine({
        start: { x: 44, y: cursorY - 4 },
        end: { x: width - 44, y: cursorY - 4 },
        thickness: 0.4,
        color: rgb(0.88, 0.91, 0.94),
      });
      cursorY -= 16;
    }
    cursorY -= 4;
  };

  // SECTION 1: Household Energy Usage
  drawSectionHeader('1. Recorded Household Energy Usage & Baseline Profile');
  drawKeyValueGrid([
    [
      'Household Name:',
      holderName,
      'Gujarat District:',
      `${district}, Gujarat`,
    ],
    [
      'Monthly Energy Usage:',
      `${input.monthlyKwh} kWh / month`,
      'Per-Capita Usage:',
      `${perCapitaKwh} kWh / person (${familyMembers} members)`,
    ],
    [
      'Monthly Electricity Bill:',
      formatInrPdf(input.monthlyBillInr),
      'Effective Tariff Blend:',
      `INR ${effectiveTariff} / kWh`,
    ],
    [
      'Baseline Carbon Footprint:',
      `${input.baselineMonthlyCarbonKg} kg CO2 / month`,
      'Household Green Score:',
      `${input.greenScore} / 100 (${sanitizePdfText(input.tierName)})`,
    ],
  ]);

  // SECTION 2: Electricity Savings, Carbon Savings & Reward Points
  drawSectionHeader('2. Recorded Electricity Savings, Carbon Offset & Reward Points');
  drawKeyValueGrid([
    [
      'Recorded Bill Savings:',
      `${formatInrPdf(input.totalElectricityInrSaved)} saved`,
      'Est. Electricity Saved:',
      `${estimatedKwhSavedFromMissions} kWh from missions`,
    ],
    [
      'Recorded Carbon Saved:',
      `${input.totalCo2SavedKg} kg CO2 averted`,
      'Reward Points Earned:',
      `${input.rewardPoints} LiFE Points`,
    ],
    [
      'Completed Missions:',
      `${input.completedMissionsCount} Missions`,
      'Active Daily Streak:',
      `${input.streakDays} Days`,
    ],
    [
      'Potential Monthly Savings:',
      `${formatInrPdf(input.potentialMonthlySavingInr)} / month`,
      'Potential Energy Reduction:',
      `${input.potentialMonthlySavingKwh} kWh / month`,
    ],
  ]);

  // SECTION 3: Completed Missions Ledger
  drawSectionHeader('3. Completed Missions Ledger (Actual Recorded Actions)');
  if (input.completedMissions && input.completedMissions.length > 0) {
    for (const m of input.completedMissions.slice(0, 6)) {
      const lineText = `- ${m.title} | Date: ${m.completionDate} (IST) | +${m.points} Points | ${m.co2SavedKg} kg CO2 | ${formatInrPdf(m.inrSaved)} saved`;
      page.drawText(sanitizePdfText(lineText), {
        x: 44,
        y: cursorY,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.12, 0.2, 0.16),
      });
      cursorY -= 14;
    }
  } else {
    page.drawText(
      'No completed missions recorded yet (0 Missions, 0 Points, 0 kg CO2 saved).',
      {
        x: 44,
        y: cursorY,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.35, 0.4, 0.45),
      }
    );
    cursorY -= 14;
  }
  cursorY -= 6;

  // SECTION 4: Monthly Progress Tracking
  drawSectionHeader('4. Monthly Progress & Consumption Benchmark Tracking');
  const progressEntries: ImpactReportMonthlyProgressEntry[] =
    input.monthlyProgress && input.monthlyProgress.length > 0
      ? input.monthlyProgress
      : [
          {
            month: 'Current Month',
            actualKwh: input.monthlyKwh,
            targetKwh: targetMonthlyKwh,
          },
        ];

  const progressSummary = progressEntries
    .map((p) => `${p.month}: Actual ${p.actualKwh} kWh vs Target ${p.targetKwh} kWh`)
    .join('  |  ');

  for (const line of wrapTextLines(progressSummary, fontRegular, 8.5, width - 88)) {
    page.drawText(line, {
      x: 44,
      y: cursorY,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.15, 0.22, 0.28),
    });
    cursorY -= 13;
  }

  const varianceKwh = input.monthlyKwh - targetMonthlyKwh;
  const progressStatus =
    varianceKwh <= 0
      ? `Monthly Progress Status: ${Math.abs(varianceKwh)} kWh below Mission LiFE household target (${targetMonthlyKwh} kWh/mo).`
      : `Monthly Progress Status: ${varianceKwh} kWh above Mission LiFE household target (${targetMonthlyKwh} kWh/mo); adopt cooling & standby missions to close gap.`;
  page.drawText(sanitizePdfText(progressStatus), {
    x: 44,
    y: cursorY,
    size: 8.5,
    font: fontBold,
    color: rgb(0.08, 0.33, 0.18),
  });
  cursorY -= 18;

  // SECTION 5: Carbon Savings Methodology & Calculation Assumptions
  drawSectionHeader('5. Carbon Savings Methodology & Calculation Assumptions');
  const methodologyBullets = [
    'Carbon Savings Methodology: Central Electricity Authority (CEA) CO2 Baseline Database Version 22.0 (FY 2025-26) official weighted average emission factor of 0.675 kg CO2 / kWh (CO2 Saved = kWh Saved x 0.675). Engineering delivery-loss sensitivity (~17.7% AT&C) corresponds to ~0.82 kg CO2 / kWh.',
    `Calculation Assumptions: Appliance Energy Usage (kWh) = (Watts x Daily Hours x Days) / 1000. Gujarat domestic tariff benchmark = INR 6.25 / kWh (GERC telescopic slab blend). Household Mission LiFE benchmark = 75 kWh per capita / month (${targetMonthlyKwh} kWh / month for ${familyMembers} members).`,
    'Reward Ledger Integrity: Mission completions are uniquely recorded by (user_id, mission_id, completion_date) in Asia/Kolkata timezone.',
  ];

  for (const bullet of methodologyBullets) {
    const lines = wrapTextLines(`- ${bullet}`, fontRegular, 8, width - 88);
    for (const line of lines) {
      page.drawText(line, {
        x: 44,
        y: cursorY,
        size: 8,
        font: fontRegular,
        color: rgb(0.25, 0.3, 0.35),
      });
      cursorY -= 11;
    }
    cursorY -= 3;
  }

  // Footer
  page.drawLine({
    start: { x: 36, y: 44 },
    end: { x: width - 36, y: 44 },
    thickness: 0.6,
    color: rgb(0.8, 0.85, 0.82),
  });

  page.drawText(
    sanitizePdfText(
      `UrjaSaathi Impact Report (${IMPACT_REPORT_FILENAME}) | Generated on ${reportDate} for ${holderName} (${district}, Gujarat)`
    ),
    {
      x: 36,
      y: 30,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.55),
    }
  );

  pdfDoc.setKeywords([
    'URJASAATHI_IMPACT_REPORT',
    `Household: ${holderName}`,
    `District: ${district}, Gujarat`,
    `MonthlyEnergyUsage: ${input.monthlyKwh} kWh / month`,
    `ElectricitySavings: INR ${input.totalElectricityInrSaved}`,
    `CarbonMethodology: CEA Version 22.0 (0.675 kg CO2 / kWh)`,
    `CompletedMissions: ${input.completedMissionsCount} Missions`,
    `RewardPoints: ${input.rewardPoints} LiFE Points`,
    `MonthlyProgress: Actual ${input.monthlyKwh} kWh vs Target ${targetMonthlyKwh} kWh`,
    `ReportGenerationDate: ${reportDate}`,
  ]);

  return pdfDoc.save({ useObjectStreams: false });
}

/**
 * Triggers a direct browser file download for a generated PDF Uint8Array
 * without opening window.print(). Supports desktop and mobile browsers.
 */
export function triggerBrowserPdfDownload(
  pdfBytes: Uint8Array,
  filename: string
): { sizeBytes: number; mimeType: string; filename: string } {
  if (!pdfBytes || pdfBytes.byteLength === 0) {
    throw new Error('Generated PDF is empty (0 bytes).');
  }

  // Verify %PDF- header
  const header = String.fromCharCode(
    pdfBytes[0] || 0,
    pdfBytes[1] || 0,
    pdfBytes[2] || 0,
    pdfBytes[3] || 0,
    pdfBytes[4] || 0
  );
  if (header !== '%PDF-') {
    throw new Error('Generated file is not a valid PDF binary.');
  }

  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const mimeType = 'application/pdf';

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeFilename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      try {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } catch {
        // ignore cleanup errors
      }
    }, 2500);
  }

  return {
    sizeBytes: pdfBytes.byteLength,
    mimeType,
    filename: safeFilename,
  };
}
