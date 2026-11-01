import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSustainabilityMetrics,
  calculateSolarFeasibility,
  CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH,
  CUSTOM_DELIVERY_LOSS_ADJUSTED_FACTOR_KG_CO2_PER_KWH,
} from './sustainabilityMath';

test('calculateSustainabilityMetrics computes baseline carbon using CEA Ver 22.0 FY 2025-26 0.675 kg factor', () => {
  const profile = {
    name: 'Ramesh Patel',
    city: 'Ahmedabad',
    district: 'Ahmedabad',
    familyMembers: 4,
    monthlyKwh: 300,
    monthlyBillInr: 2100,
    appliances: ['ac', 'refrigerator', 'fans_lights'],
    rooftopAvailableSqFt: 350,
  };

  const metrics = calculateSustainabilityMetrics(profile);

  // Per capita = 300 / 4 = 75
  assert.equal(metrics.perCapitaKwh, 75);
  // Monthly carbon baseline = 300 * 0.675 = 202.5 kg CO2
  assert.equal(metrics.monthlyCarbonKg, 202.5);
  // Annual carbon = (202.5 * 12) / 1000 = 2.43 tonnes
  assert.equal(metrics.annualCarbonTonnes, 2.43);
  // Green score bounded [15, 100]
  assert.ok(metrics.greenScore >= 15 && metrics.greenScore <= 100);
  assert.ok(metrics.tier.name.length > 0);
  assert.ok(metrics.potentialMonthlySavingKwh > 0);
  assert.ok(metrics.potentialMonthlySavingInr > 0);

  // Verify methodology notes clearly attribute 0.675 as CEA official and 0.82 as custom delivery-loss model
  assert.equal(metrics.methodologyNotes.ceaOfficialEmissionFactorKgPerKwh, 0.675);
  assert.equal(metrics.methodologyNotes.customDeliveryLossAdjustedFactorKgPerKwh, 0.82);
  assert.ok(!metrics.methodologyNotes.emissionBasis.includes('0.82 kg CO2/kWh is a CEA-published'));
});

test('calculateSustainabilityMetrics handles high consumption edge cases cleanly', () => {
  const highUsage = {
    name: 'Large Villa',
    city: 'Surat',
    district: 'Surat',
    familyMembers: 2,
    monthlyKwh: 1200,
    monthlyBillInr: 9600,
    appliances: ['ac', 'geyser', 'refrigerator', 'washing_machine', 'water_pump', 'ev_charger'],
    rooftopAvailableSqFt: 80,
  };

  const metrics = calculateSustainabilityMetrics(highUsage);
  assert.equal(metrics.perCapitaKwh, 600);
  assert.equal(metrics.monthlyCarbonKg, 810); // 1200 * 0.675
  assert.ok(metrics.greenScore < 70, 'High consumption should yield lower score');
  assert.equal(metrics.tier.name, 'LiFE Aarambh (Bronze Explorer)');
});

test('calculateSolarFeasibility incorporates explicit performance ratio and GERC 2026 regulations', () => {
  const input3Kw = {
    monthlyKwh: 400,
    rooftopAreaSqFt: 400,
    district: 'Gandhinagar',
    monthlyBillInr: 2800,
    unitRateInr: 6.5,
    systemLossesPercent: 17.5,
  };

  const solar = calculateSolarFeasibility(input3Kw);
  assert.equal(solar.suggestedCapacityKw, 3);
  assert.equal(solar.applicableSubsidyInr, 78000); // PM Surya Ghar 3kW CFA cap

  // Explicit Performance Ratio check
  assert.equal(solar.assumptions.performanceRatio, 0.825);
  assert.equal(solar.assumptions.systemLossesPercent, 17.5);
  assert.ok(solar.monthlyGenerationKwh >= 360);

  // GERC Grid Interactive Distributed Renewable Energy Sources Regulations 2026 surplus rate check
  assert.equal(solar.assumptions.surplusInjectionCompensationInr, 2.25);
  assert.ok(solar.assumptions.regulatoryRegime.includes('GERC GIDRES Regulations, 2026'));
  assert.ok(solar.assumptions.regulatoryRegime.includes('distinct from APPC'));

  assert.ok(solar.paybackPeriodYears > 1 && solar.paybackPeriodYears < 7);
  assert.ok(solar.twentyFiveYearSavingsInr > 100000);
  assert.ok(solar.twentyFiveYearCo2ReductionTonnes > 15);
  assert.ok(solar.sourceReferences.some((ref) => ref.includes('GERC (Grid Interactive Distributed Renewable Energy Sources) Regulations, 2026')));
});

test('calculateSolarFeasibility supports custom configurable system losses', () => {
  const customLossInput = {
    monthlyKwh: 300,
    rooftopAreaSqFt: 300,
    district: 'Ahmedabad',
    monthlyBillInr: 2000,
    systemLossesPercent: 20, // 20% losses -> PR = 0.80
  };

  const solar = calculateSolarFeasibility(customLossInput);
  assert.equal(solar.assumptions.systemLossesPercent, 20);
  assert.equal(solar.assumptions.performanceRatio, 0.8);
  // Daily generation = 5.2 * 0.8 = 4.16 kWh/kW/day
  assert.equal(solar.assumptions.generationPerKwDailyKwh, 4.16);
});

test('Baseline emission factor strictly adheres to CEA Version 22.0 FY 2025-26 weighted average', () => {
  assert.equal(CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH, 0.675);
  assert.equal(CUSTOM_DELIVERY_LOSS_ADJUSTED_FACTOR_KG_CO2_PER_KWH, 0.82);
});
