import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSustainabilityMetrics,
  calculateSolarFeasibility,
  CEA_BASE_GRID_EMISSION_FACTOR_KG_CO2_PER_KWH,
  EFFECTIVE_CONSUMER_EMISSION_FACTOR_KG_CO2_PER_KWH,
} from './sustainabilityMath';

test('calculateSustainabilityMetrics computes per-capita and carbon metrics properly', () => {
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
  // Monthly carbon = 300 * 0.82 = 246 kg
  assert.equal(metrics.monthlyCarbonKg, 246);
  // Annual carbon = (246 * 12) / 1000 = 2.95 tonnes
  assert.equal(metrics.annualCarbonTonnes, 2.95);
  // Green score should be bounded between 15 and 100
  assert.ok(metrics.greenScore >= 15 && metrics.greenScore <= 100);
  assert.ok(metrics.tier.name.length > 0);
  assert.ok(metrics.potentialMonthlySavingKwh > 0);
  assert.ok(metrics.potentialMonthlySavingInr > 0);
  assert.equal(metrics.methodologyNotes.ceaBaseEmissionFactorKgPerKwh, 0.72);
  assert.equal(metrics.methodologyNotes.effectiveConsumerFactorKgPerKwh, 0.82);
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
  assert.ok(metrics.greenScore < 70, 'High consumption should yield lower score');
  assert.equal(metrics.tier.name, 'LiFE Aarambh (Bronze Explorer)');
});

test('calculateSolarFeasibility recommends correct PM Surya Ghar subsidy and capacity', () => {
  const input3Kw = {
    monthlyKwh: 400,
    rooftopAreaSqFt: 400,
    district: 'Gandhinagar',
    monthlyBillInr: 2800,
    unitRateInr: 6.5,
  };

  const solar = calculateSolarFeasibility(input3Kw);
  assert.equal(solar.suggestedCapacityKw, 3);
  assert.equal(solar.applicableSubsidyInr, 78000); // 3kW subsidy under PM Surya Ghar
  assert.ok(solar.monthlyGenerationKwh >= 360);
  assert.ok(solar.paybackPeriodYears > 1 && solar.paybackPeriodYears < 7);
  assert.ok(solar.twentyFiveYearSavingsInr > 100000);
  assert.ok(solar.twentyFiveYearCo2ReductionTonnes > 20);
  assert.ok(solar.eligibilityConditions.length >= 4);
  assert.ok(solar.sourceReferences.length >= 4);
  assert.ok(solar.assumptions.solarIrradiancePshPerDay > 4.0);
});

test('calculateSolarFeasibility respects rooftop space constraints and 1kW subsidy', () => {
  const inputSmallRoof = {
    monthlyKwh: 500,
    rooftopAreaSqFt: 120,
    district: 'Rajkot',
    monthlyBillInr: 3500,
  };

  const solar = calculateSolarFeasibility(inputSmallRoof);
  assert.equal(solar.suggestedCapacityKw, 1);
  assert.equal(solar.applicableSubsidyInr, 30000); // 1kW subsidy
});

test('Grid emission factor conforms to audited CEA Ver 22.0 specifications', () => {
  assert.equal(CEA_BASE_GRID_EMISSION_FACTOR_KG_CO2_PER_KWH, 0.72);
  assert.equal(EFFECTIVE_CONSUMER_EMISSION_FACTOR_KG_CO2_PER_KWH, 0.82);
});
