/**
 * Sustainability & Solar Calculation Engine
 * Designed for Gujarat Energy Development Agency (GEDA) Mission LiFE Hackathon
 *
 * Methodological & Regulatory References:
 * 1. Central Electricity Authority (CEA), Ministry of Power, Govt. of India:
 *    - CO2 Baseline Database for the Indian Power Sector, Version 22.0 (Unified National Grid).
 *    - Official FY 2025-26 Weighted Average Emission Factor: 0.675 kg CO2/kWh (Primary Default Household Footprint Baseline).
 *    - Custom delivery-loss-adjusted estimate (0.82 kg CO2/kWh) is an engineering-derived model
 *      incorporating an assumed ~17.7% AT&C / delivery loss. (NOT an officially published CEA baseline figure).
 * 2. Gujarat Electricity Regulatory Commission (GERC):
 *    - GERC (Grid Interactive Distributed Renewable Energy Sources) Regulations, 2026, notified on 30 October 2026.
 *    - Surplus injection compensation: ₹2.25/kWh residential solar feed-in rate determined under GIDRES Regulations 2026.
 *      (Expressly distinguished from the DISCOM utility-wide Average Power Purchase Cost / APPC).
 * 3. Ministry of New and Renewable Energy (MNRE), Govt. of India:
 *    - PM Surya Ghar: Muft Bijli Yojana (Operational Guidelines & National Portal: pmsuryaghar.gov.in).
 * 4. Gujarat Energy Development Agency (GEDA):
 *    - Surya Gujarat Rooftop Solar Implementation Guidelines.
 */

export interface HouseholdProfile {
  name: string;
  city: string;
  district: string;
  familyMembers: number;
  monthlyKwh: number;
  monthlyBillInr: number;
  appliances: string[];
  rooftopAvailableSqFt: number;
  hasSolarInstalled?: boolean;
}

export interface SustainabilityMetrics {
  perCapitaKwh: number;
  monthlyCarbonKg: number;
  annualCarbonTonnes: number;
  treeOffsetEquivalent: number;
  greenScore: number;
  tier: {
    name: string;
    badge: string;
    color: string;
    titleGujarati: string;
  };
  benchmarkComparisonPct: number;
  potentialMonthlySavingKwh: number;
  potentialMonthlySavingInr: number;
  potentialCo2ReductionKg: number;
  methodologyNotes: {
    ceaOfficialEmissionFactorKgPerKwh: number;
    customDeliveryLossAdjustedFactorKgPerKwh: number;
    emissionBasis: string;
  };
}

export interface SolarCalculationInput {
  monthlyKwh: number;
  rooftopAreaSqFt: number;
  district: string;
  monthlyBillInr: number;
  unitRateInr?: number; // default ~6.25
  hasBatteryBackup?: boolean;
  systemLossesPercent?: number; // e.g. 17.5% default (cabling, dust/soiling, thermal, inverter)
  performanceRatio?: number; // e.g. 0.825 default (PR = 1 - systemLosses/100)
}

export interface SolarCalculationResult {
  suggestedCapacityKw: number;
  maxFeasibleCapacityKw: number;
  monthlyGenerationKwh: number;
  annualGenerationKwh: number;
  grossSystemCostInr: number;
  applicableSubsidyInr: number;
  netSystemCostInr: number;
  monthlySavingsInr: number;
  annualSavingsInr: number;
  paybackPeriodYears: number;
  twentyFiveYearSavingsInr: number;
  twentyFiveYearCo2ReductionTonnes: number;
  treeEquivalentLifetime: number;
  solarCoveragePercent: number;
  assumptions: {
    solarIrradiancePshPerDay: number;
    systemLossesPercent: number;
    performanceRatio: number;
    generationPerKwDailyKwh: number;
    generationPerKwMonthlyKwh: number;
    baseSystemCostPerKwInr: number;
    discomTariffRateInr: number;
    surplusInjectionCompensationInr: number;
    annualDegradationPct: number;
    regulatoryRegime: string;
  };
  eligibilityConditions: string[];
  sourceReferences: string[];
  disclaimer: string;
}

// 33 Districts of Gujarat
export const GUJARAT_DISTRICTS = [
  'Ahmedabad',
  'Amreli',
  'Anand',
  'Aravalli',
  'Banaskantha',
  'Bharuch',
  'Bhavnagar',
  'Botad',
  'Chhota Udepur',
  'Dahod',
  'Dang',
  'Devbhumi Dwarka',
  'Gandhinagar',
  'Gir Somnath',
  'Jamnagar',
  'Junagadh',
  'Kheda',
  'Kutch',
  'Mahisagar',
  'Mehsana',
  'Morbi',
  'Narmada',
  'Navsari',
  'Panchmahal',
  'Patan',
  'Porbandar',
  'Rajkot',
  'Sabarkantha',
  'Surat',
  'Surendranagar',
  'Tapi',
  'Vadodara',
  'Valsad',
] as const;

// Typical appliance wattage and monthly consumption estimates (kWh/month)
export const APPLIANCE_CATALOG = [
  { id: 'ac', name: 'Air Conditioner (1.5 Ton)', avgKwh: 140, icon: 'Wind', tag: 'High Load' },
  { id: 'refrigerator', name: 'Refrigerator (Double Door / Frost Free)', avgKwh: 45, icon: 'Refrigerator', tag: 'Constant' },
  { id: 'geyser', name: 'Electric Geyser / Water Heater', avgKwh: 60, icon: 'Flame', tag: 'High Load' },
  { id: 'washing_machine', name: 'Washing Machine', avgKwh: 20, icon: 'Shirt', tag: 'Medium' },
  { id: 'fans_lights', name: 'Ceiling Fans & Normal Lighting', avgKwh: 50, icon: 'Lightbulb', tag: 'Base' },
  { id: 'ev_charger', name: 'EV Two-Wheeler / Car Charger', avgKwh: 90, icon: 'Zap', tag: 'High Load' },
  { id: 'microwave_oven', name: 'Microwave / Induction Cooktop', avgKwh: 35, icon: 'UtensilsCrossed', tag: 'Medium' },
  { id: 'water_pump', name: 'Domestic Water Motor / Borewell Pump', avgKwh: 30, icon: 'Droplets', tag: 'Medium' },
  { id: 'desktop_tv', name: 'Smart TV & Desktop / Monitor', avgKwh: 25, icon: 'Tv', tag: 'Standby' },
];

/**
 * CEA Baseline Emission Factors:
 * CEA Version 22.0 official FY 2025-26 weighted average emission factor is 0.675 kg CO2/kWh for the National Grid.
 * This is the mandatory default baseline for household footprint calculations.
 */
export const CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH = 0.675;

/**
 * Custom Delivery-Loss-Adjusted Estimate:
 * An engineering-derived estimate incorporating ~17.7% Aggregate Technical & Commercial (AT&C) / T&D delivery losses:
 * 0.675 / (1 - 0.177) ≈ 0.82 kg CO2/kWh.
 * Explicitly documented as a custom modeling estimate and NOT an officially published CEA baseline figure.
 */
export const CUSTOM_DELIVERY_LOSS_ADJUSTED_FACTOR_KG_CO2_PER_KWH = 0.82;

// Standard tree sequestration factor: 20 kg CO2 per mature tree annually
export const CO2_PER_TREE_ANNUAL_KG = 20;

/**
 * Calculate comprehensive household sustainability baseline
 */
export function calculateSustainabilityMetrics(profile: HouseholdProfile): SustainabilityMetrics {
  const members = Math.max(1, profile.familyMembers || 1);
  const monthlyKwh = Math.max(10, profile.monthlyKwh || 100);
  const perCapitaKwh = Number((monthlyKwh / members).toFixed(1));

  // Carbon metrics using the CEA Version 22.0 FY 2025-26 weighted average baseline (0.675 kg CO2/kWh)
  const monthlyCarbonKg = Number((monthlyKwh * CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH).toFixed(1));
  const annualCarbonTonnes = Number(((monthlyCarbonKg * 12) / 1000).toFixed(2));
  const treeOffsetEquivalent = Math.round(monthlyCarbonKg / (CO2_PER_TREE_ANNUAL_KG / 12));

  // Benchmark in Gujarat: average urban person uses ~80 kWh/month
  const benchmarkMonthlyKwh = members * 80;
  const benchmarkComparisonPct = Math.round(((monthlyKwh - benchmarkMonthlyKwh) / benchmarkMonthlyKwh) * 100);

  // Score calculation (0 to 100)
  // 1. Consumption per capita component (up to 45 pts)
  let consumptionScore = 0;
  if (perCapitaKwh <= 45) consumptionScore = 45;
  else if (perCapitaKwh <= 75) consumptionScore = 38;
  else if (perCapitaKwh <= 100) consumptionScore = 30;
  else if (perCapitaKwh <= 140) consumptionScore = 20;
  else if (perCapitaKwh <= 200) consumptionScore = 12;
  else consumptionScore = 6;

  // 2. Appliance efficiency & eco-readiness component (up to 25 pts)
  const applianceCount = (profile.appliances || []).length;
  let applianceScore = 20;
  if (applianceCount > 6) applianceScore = 14;
  else if (applianceCount > 4) applianceScore = 18;
  if ((profile.appliances || []).includes('fans_lights')) applianceScore += 2;

  // 3. Solar Readiness component (up to 15 pts)
  let solarScore = 5;
  if (profile.hasSolarInstalled) solarScore = 15;
  else if (profile.rooftopAvailableSqFt >= 200) solarScore = 12;
  else if (profile.rooftopAvailableSqFt >= 100) solarScore = 8;

  // 4. Base LiFE participation points (15 pts)
  const habitScore = 15;

  let totalScore = consumptionScore + applianceScore + solarScore + habitScore;
  totalScore = Math.min(100, Math.max(15, Math.round(totalScore)));

  // Tier assignment
  let tier = {
    name: 'LiFE Aarambh (Bronze Explorer)',
    badge: '🥉',
    color: 'amber',
    titleGujarati: 'લાઈફ આરંભ',
  };

  if (totalScore >= 85) {
    tier = {
      name: 'Urja Ratna (Diamond Champion)',
      badge: '💎',
      color: 'emerald',
      titleGujarati: 'ઊર્જા રત્ન',
    };
  } else if (totalScore >= 70) {
    tier = {
      name: 'Urja Rakshak (Gold Guardian)',
      badge: '🥇',
      color: 'teal',
      titleGujarati: 'ઊર્જા રક્ષક',
    };
  } else if (totalScore >= 50) {
    tier = {
      name: 'Prakriti Mitra (Silver Advocate)',
      badge: '🥈',
      color: 'lime',
      titleGujarati: 'પ્રકૃતિ મિત્ર',
    };
  }

  // Potential savings if adopting Mission LiFE practices (approx 18% reduction)
  const potentialMonthlySavingKwh = Math.round(monthlyKwh * 0.18);
  const avgTariff = profile.monthlyBillInr > 0 ? profile.monthlyBillInr / monthlyKwh : 6.25;
  const potentialMonthlySavingInr = Math.round(potentialMonthlySavingKwh * avgTariff);
  const potentialCo2ReductionKg = Number((potentialMonthlySavingKwh * CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH).toFixed(1));

  return {
    perCapitaKwh,
    monthlyCarbonKg,
    annualCarbonTonnes,
    treeOffsetEquivalent,
    greenScore: totalScore,
    tier,
    benchmarkComparisonPct,
    potentialMonthlySavingKwh,
    potentialMonthlySavingInr,
    potentialCo2ReductionKg,
    methodologyNotes: {
      ceaOfficialEmissionFactorKgPerKwh: CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH,
      customDeliveryLossAdjustedFactorKgPerKwh: CUSTOM_DELIVERY_LOSS_ADJUSTED_FACTOR_KG_CO2_PER_KWH,
      emissionBasis: 'Official CEA Version 22.0 FY 2025-26 weighted average emission factor of 0.675 kg CO2/kWh is used as the default household footprint baseline. The optional 0.82 kg CO2/kWh figure represents a custom engineering estimate accounting for ~17.7% delivery/AT&C grid losses and is not a CEA-published figure.',
    },
  };
}

/**
 * Solar Rooftop Feasibility Calculator
 * Fully compliant with PM Surya Ghar: Muft Bijli Yojana &
 * GERC (Grid Interactive Distributed Renewable Energy Sources) Regulations, 2026 (notified 30 October 2026).
 */
export function calculateSolarFeasibility(input: SolarCalculationInput): SolarCalculationResult {
  const monthlyKwh = Math.max(30, input.monthlyKwh || 200);
  const rooftopAreaSqFt = Math.max(0, input.rooftopAreaSqFt || 0);
  const unitRateInr = input.unitRateInr && input.unitRateInr > 0 ? input.unitRateInr : 6.25;

  // 1 kW requires ~100 sq ft shadow-free area
  const maxFeasibleCapacityKw = Number((rooftopAreaSqFt / 100).toFixed(1));

  // Explicit Performance Ratio (PR) & Configurable System Losses
  // Default system losses: 17.5% (cabling 2%, soiling/dust 4%, temperature derating 8.5%, inverter 3%)
  const systemLossesPercent = input.systemLossesPercent !== undefined ? Math.max(5, Math.min(40, input.systemLossesPercent)) : 17.5;
  const performanceRatio = input.performanceRatio !== undefined
    ? Math.max(0.6, Math.min(0.95, input.performanceRatio))
    : Number((1 - systemLossesPercent / 100).toFixed(3)); // 0.825

  // Gujarat Solar Resource: ~5.10 to 5.25 Peak Sun Hours (PSH) per day
  const solarIrradiancePshPerDay = 5.2;

  // Generation formula:
  // Daily Generation (kWh/kW) = PSH × Performance Ratio
  // e.g. 5.2 PSH/day × 0.825 PR = 4.29 kWh/kW/day
  const generationPerKwDailyKwh = Number((solarIrradiancePshPerDay * performanceRatio).toFixed(2));
  // Monthly Generation per kW: ~4.29 × 30.42 days ≈ 130.5 kWh/kW/month (standardized to ~130 kWh)
  const unitsPerKwMonthly = Math.round(generationPerKwDailyKwh * 30.42);

  // Capacity needed to offset ~90% of household monthly consumption
  const idealCapacityNeededKw = Math.ceil((monthlyKwh * 0.9) / unitsPerKwMonthly);

  // Suggested capacity bounded by roof space and residential norms (1 kW to 10 kW)
  let suggestedCapacityKw = Math.max(1, idealCapacityNeededKw);
  if (maxFeasibleCapacityKw > 0) {
    suggestedCapacityKw = Math.min(suggestedCapacityKw, Math.floor(maxFeasibleCapacityKw));
    if (suggestedCapacityKw < 1 && maxFeasibleCapacityKw >= 0.8) {
      suggestedCapacityKw = 1;
    }
  }
  suggestedCapacityKw = Math.min(10, Math.max(1, suggestedCapacityKw));

  // Generation
  const monthlyGenerationKwh = Math.round(suggestedCapacityKw * unitsPerKwMonthly);
  const annualGenerationKwh = Math.round(monthlyGenerationKwh * 12);

  // Capital Cost benchmarks in Gujarat: ~₹58,000 per kW (excluding battery)
  const baseCostPerKw = 58000;
  const batteryAddition = input.hasBatteryBackup ? suggestedCapacityKw * 22000 : 0;
  const grossSystemCostInr = Math.round(suggestedCapacityKw * baseCostPerKw + batteryAddition);

  /**
   * PM Surya Ghar: Muft Bijli Yojana Central Financial Assistance (CFA) Rules:
   * - 1 kW: ₹30,000
   * - 2 kW: ₹60,000 (₹30,000/kW for first 2 kW)
   * - 3 kW & above: ₹78,000 (₹60,000 + ₹18,000 for 3rd kW, flat maximum residential cap)
   */
  let applicableSubsidyInr = 0;
  if (suggestedCapacityKw === 1) {
    applicableSubsidyInr = 30000;
  } else if (suggestedCapacityKw === 2) {
    applicableSubsidyInr = 60000;
  } else if (suggestedCapacityKw >= 3) {
    applicableSubsidyInr = 78000;
  }

  const netSystemCostInr = Math.max(0, grossSystemCostInr - applicableSubsidyInr);

  /**
   * GERC (Grid Interactive Distributed Renewable Energy Sources) Regulations, 2026:
   * Notified on 30 October 2026.
   * Residential net metering surplus injection compensation is explicitly set at ₹2.25/kWh.
   * NOTE: This regulatory feed-in rate is expressly distinguished from DISCOM Average Power Purchase Cost (APPC).
   */
  const surplusInjectionCompensationInr = 2.25;

  const usableSavedUnitsMonthly = Math.min(monthlyKwh, monthlyGenerationKwh);
  const surplusUnitsMonthly = Math.max(0, monthlyGenerationKwh - monthlyKwh);

  const monthlySavingsInr = Math.round(
    usableSavedUnitsMonthly * unitRateInr + surplusUnitsMonthly * surplusInjectionCompensationInr
  );
  const annualSavingsInr = Math.round(monthlySavingsInr * 12);

  // Payback period
  const paybackPeriodYears = annualSavingsInr > 0 ? Number((netSystemCostInr / annualSavingsInr).toFixed(1)) : 0;

  // 25-Year projections with 0.7% annual module degradation factor
  const degradationFactor25Yr = 22.5;
  const twentyFiveYearSavingsInr = Math.round(annualSavingsInr * degradationFactor25Yr);
  // Uses CEA Version 22.0 official 0.675 kg CO2/kWh factor for environmental accounting
  const twentyFiveYearCo2ReductionTonnes = Number(
    ((annualGenerationKwh * degradationFactor25Yr * CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH) / 1000).toFixed(1)
  );
  const treeEquivalentLifetime = Math.round((twentyFiveYearCo2ReductionTonnes * 1000) / (CO2_PER_TREE_ANNUAL_KG * 25));

  const solarCoveragePercent = Math.min(100, Math.round((monthlyGenerationKwh / monthlyKwh) * 100));

  const eligibilityConditions = [
    'Must be a domestic residential electricity consumer with an active meter in Gujarat (UGVCL, PGVCL, DGVCL, MGVCL, or Torrent Power).',
    'Adequate shadow-free rooftop ownership or certified right to access terrace space (~100 sq.ft per kW).',
    'Solar PV system must be procured and installed through registered empanelled vendors via the National Portal (pmsuryaghar.gov.in).',
    'Must use DCR (Domestic Content Requirement) certified solar cells & modules listed on ALMM (Approved List of Models and Manufacturers).',
    'Subsidy is disbursed directly via Direct Benefit Transfer (DBT) into the applicant’s Aadhaar-linked bank account following DISCOM inspection and net-meter commissioning.',
  ];

  const sourceReferences = [
    'GERC (Grid Interactive Distributed Renewable Energy Sources) Regulations, 2026, notified on 30 October 2026.',
    'Ministry of New and Renewable Energy (MNRE): PM Surya Ghar: Muft Bijli Yojana Operational Guidelines (2024).',
    'National Portal for Rooftop Solar: https://pmsuryaghar.gov.in',
    'Gujarat Energy Development Agency (GEDA): Surya Gujarat Residential Rooftop Solar Guidelines.',
    'Central Electricity Authority (CEA): CO2 Baseline Database for the Indian Power Sector, Version 22.0 (FY 2025-26 Weighted Average: 0.675 kg CO2/kWh).',
  ];

  return {
    suggestedCapacityKw,
    maxFeasibleCapacityKw,
    monthlyGenerationKwh,
    annualGenerationKwh,
    grossSystemCostInr,
    applicableSubsidyInr,
    netSystemCostInr,
    monthlySavingsInr,
    annualSavingsInr,
    paybackPeriodYears,
    twentyFiveYearSavingsInr,
    twentyFiveYearCo2ReductionTonnes,
    treeEquivalentLifetime,
    solarCoveragePercent,
    assumptions: {
      solarIrradiancePshPerDay,
      systemLossesPercent,
      performanceRatio,
      generationPerKwDailyKwh,
      generationPerKwMonthlyKwh: unitsPerKwMonthly,
      baseSystemCostPerKwInr: baseCostPerKw,
      discomTariffRateInr: unitRateInr,
      surplusInjectionCompensationInr,
      annualDegradationPct: 0.7,
      regulatoryRegime: 'GERC GIDRES Regulations, 2026 (Notified 30 Oct 2026) — ₹2.25/kWh surplus injection rate (distinct from APPC)',
    },
    eligibilityConditions,
    sourceReferences,
    disclaimer:
      'Disclaimer: All estimations are model-driven feasibility simulations based on Gujarat solar irradiance (~5.2 PSH/day, PR = 0.825), GERC Grid Interactive Distributed Renewable Energy Sources Regulations 2026 (₹2.25/kWh surplus injection compensation, distinct from APPC), and standard PM Surya Ghar DBT subsidy benchmarks. Actual generation varies based on roof orientation, tilt angle, local shading, seasonal dust, ambient temperature, and DISCOM meter approval. These figures do not represent guaranteed commercial or financial returns.',
  };
}
