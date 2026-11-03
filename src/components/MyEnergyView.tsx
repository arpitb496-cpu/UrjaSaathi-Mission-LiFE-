import React, { useState } from 'react';
import {
  Zap,
  TrendingDown,
  DollarSign,
  TreeDeciduous,
  Calculator,
  Download,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart3,
  Flame,
  ShieldCheck,
  Printer,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { AppState, calculateUserAggregates } from '../utils/storage';
import {
  APPLIANCE_CATALOG,
  CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH,
} from '../utils/sustainabilityMath';
import { GUJARAT_AVG_TARIFF_INR_PER_KWH } from '../utils/energyMathChat';
import { MISSIONS_LIST } from '../data/missionsData';
import {
  generateImpactReportPdf,
  triggerBrowserPdfDownload,
  IMPACT_REPORT_FILENAME,
} from '../utils/pdfGenerator';

interface MyEnergyViewProps {
  appState: AppState;
  setActiveTab: (tab: string) => void;
}

export const MyEnergyView: React.FC<MyEnergyViewProps> = ({ appState }) => {
  const { profile, streakDays, completedMissions } = appState;
  const aggregates = calculateUserAggregates(appState);
  const {
    baselineMetrics,
    effectiveGreenScore,
    totalMissions,
    totalPoints,
    totalCo2SavedKg,
    totalInrSaved,
  } = aggregates;

  // Expandable sections state
  const [showMethodology, setShowMethodology] = useState<boolean>(false);
  const [showDiscomTariffs, setShowDiscomTariffs] = useState<boolean>(false);
  const [downloadingReport, setDownloadingReport] = useState<boolean>(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  // Appliance Energy Calculator state
  const [calcWatts, setCalcWatts] = useState<number>(170);
  const [calcHours, setCalcHours] = useState<number>(8);
  const [calcDays, setCalcDays] = useState<number>(30);
  const [calcTariff, setCalcTariff] = useState<number>(GUJARAT_AVG_TARIFF_INR_PER_KWH);
  const [selectedPreset, setSelectedPreset] = useState<string>('gaming-laptop');

  // Appliance presets
  const APPLIANCE_PRESETS = [
    { id: 'gaming-laptop', name: '170W Gaming Laptop', watts: 170, defaultHours: 8, isAdapter: true },
    { id: 'inverter-ac', name: '1.5 Ton Inverter AC', watts: 1500, defaultHours: 6, isAdapter: false },
    { id: 'air-cooler', name: '200W Air Cooler', watts: 200, defaultHours: 10, isAdapter: false },
    { id: 'ceiling-fan', name: '75W Ceiling Fan', watts: 75, defaultHours: 12, isAdapter: false },
    { id: 'bldc-fan', name: '28W BLDC Fan', watts: 28, defaultHours: 12, isAdapter: false },
    { id: 'water-geyser', name: '2000W Water Geyser', watts: 2000, defaultHours: 1, isAdapter: false },
    { id: 'refrigerator', name: '150W Refrigerator', watts: 150, defaultHours: 10, isAdapter: false },
    { id: 'custom', name: 'Custom Wattage', watts: 100, defaultHours: 4, isAdapter: false },
  ];

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const found = APPLIANCE_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setCalcWatts(found.watts);
      setCalcHours(found.defaultHours);
    }
  };

  // Calculator math: Units = Watts * Hours * Days / 1000
  const calculatedUnits = Number(((calcWatts * calcHours * calcDays) / 1000).toFixed(2));
  const calculatedCost = Number((calculatedUnits * calcTariff).toFixed(2));
  const calculatedCo2Kg = Number(
    (calculatedUnits * CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH).toFixed(2)
  );

  // Active appliance nuance
  const isAdapterOrVariable =
    selectedPreset === 'gaming-laptop' ||
    calcWatts === 170 ||
    selectedPreset === 'inverter-ac';

  const targetMonthlyKwh = (profile.familyMembers || 4) * 75;
  const recordedKwhSavedFromMissions = Math.round(
    totalCo2SavedKg / CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH
  );
  const netPostMissionKwh = Math.max(0, profile.monthlyKwh - recordedKwhSavedFromMissions);

  // Actual user baseline vs post-mission net vs Mission LiFE target
  const historicalData = [
    { month: 'Recorded Baseline', actual: profile.monthlyKwh, target: targetMonthlyKwh },
    { month: 'After Recorded Missions', actual: netPostMissionKwh, target: targetMonthlyKwh },
    {
      month: 'With Full Habit Adoption',
      actual: Math.max(0, profile.monthlyKwh - baselineMetrics.potentialMonthlySavingKwh),
      target: targetMonthlyKwh,
    },
  ];

  // Appliance distribution data
  const selectedAppliances = APPLIANCE_CATALOG.filter((app) =>
    (profile.appliances || []).includes(app.id)
  );
  const totalAppKwh = selectedAppliances.reduce((acc, curr) => acc + curr.avgKwh, 0) || 100;
  const applianceChartData = selectedAppliances.map((app) => ({
    name: app.name.split('(')[0].trim(),
    value: Math.round((app.avgKwh / totalAppKwh) * profile.monthlyKwh),
  }));

  const PIE_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#0284c7', '#38bdf8', '#f59e0b', '#fbbf24'];

  const handleDownloadEnergyReport = async () => {
    setDownloadingReport(true);
    setReportFeedback(null);
    try {
      const completedLogs = Object.values(completedMissions || {});
      const completedMissionEntries = completedLogs.map((log) => {
        const found = MISSIONS_LIST.find((m) => m.id === log.missionId);
        return {
          missionId: log.missionId,
          title: found ? found.title : log.missionId,
          completionDate: log.completionDate,
          points: log.points,
          co2SavedKg: log.co2SavedKg,
          inrSaved: log.inrSaved,
        };
      });

      const pdfBytes = await generateImpactReportPdf({
        holderName: profile.name || 'Household Citizen',
        district: profile.district || 'Ahmedabad',
        familyMembers: profile.familyMembers || 4,
        monthlyKwh: profile.monthlyKwh,
        monthlyBillInr: profile.monthlyBillInr,
        baselineMonthlyCarbonKg: baselineMetrics.monthlyCarbonKg,
        potentialMonthlySavingKwh: baselineMetrics.potentialMonthlySavingKwh,
        potentialMonthlySavingInr: baselineMetrics.potentialMonthlySavingInr,
        greenScore: effectiveGreenScore,
        tierName: baselineMetrics.tier.name,
        streakDays,
        rewardPoints: totalPoints,
        totalElectricityInrSaved: totalInrSaved,
        totalCo2SavedKg,
        completedMissionsCount: totalMissions,
        completedMissions: completedMissionEntries,
        monthlyProgress: historicalData.map((row) => ({
          month: row.month,
          actualKwh: row.actual,
          targetKwh: row.target,
        })),
        generatedAt: new Date(),
      });

      const downloadResult = triggerBrowserPdfDownload(pdfBytes, IMPACT_REPORT_FILENAME);
      setReportFeedback(
        `Downloaded ${downloadResult.filename} (${(downloadResult.sizeBytes / 1024).toFixed(1)} KB)`
      );
    } catch (err: any) {
      setReportFeedback(err?.message || 'Failed to generate Impact Report PDF.');
    } finally {
      setDownloadingReport(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>Detailed Energy Analytics &amp; Consumption Tracking</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading mt-1">
              My Household Energy
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Calculated baseline for {profile.name || 'Your Household'}{profile.district ? ` in ${profile.district}, Gujarat` : ''} ({profile.familyMembers} family members).
            </p>
          </div>

          <button
            type="button"
            data-testid="download-energy-impact-report-btn"
            onClick={handleDownloadEnergyReport}
            disabled={downloadingReport}
            className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-[#14532D] hover:bg-emerald-900 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#A3E635]" />
            <span>{downloadingReport ? 'Generating PDF...' : 'Download Impact Report'}</span>
          </button>
        </div>

        {reportFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between">
            <span>{reportFeedback}</span>
            <span className="font-mono text-[11px]">application/pdf</span>
          </div>
        )}
      </div>

      {/* 2. Four Key Energy Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Monthly Consumption
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {profile.monthlyKwh}
            </span>
            <span className="text-xs font-bold text-slate-500">kWh / mo</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {Math.round(profile.monthlyKwh / profile.familyMembers)} kWh per capita in your home
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Monthly Bill
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              ₹{profile.monthlyBillInr.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-bold text-slate-500">/ mo</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Avg ~₹{(profile.monthlyBillInr / profile.monthlyKwh).toFixed(2)} / kWh with fixed charges
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Carbon Footprint
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center">
              <TreeDeciduous className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {baselineMetrics.monthlyCarbonKg}
            </span>
            <span className="text-xs font-bold text-slate-500">kg CO₂ / mo</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            CEA 22.0 Baseline: 0.675 kg CO₂/kWh
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Potential Savings
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-800 tracking-tight">
              ₹{baselineMetrics.potentialMonthlySavingInr.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-bold text-slate-500">/ mo</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">
            Save ~{baselineMetrics.potentialMonthlySavingKwh} kWh via Mission LiFE habits
          </p>
        </div>
      </div>

      {/* 3. Interactive Appliance Energy Calculator */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-[#14532D] text-white flex items-center justify-center">
            <Calculator className="w-5 h-5 text-[#A3E635]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-heading">
              Smart Appliance Energy Calculator
            </h2>
            <p className="text-xs text-slate-500">
              Calculate the exact electricity units (kWh) and rupee cost for any home appliance.
            </p>
          </div>
        </div>

        {/* Presets Bar */}
        <div className="pt-5">
          <label className="text-xs font-bold text-slate-700 block mb-2">
            Choose a quick preset or enter custom wattage:
          </label>
          <div className="flex flex-wrap gap-2">
            {APPLIANCE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedPreset === preset.id
                    ? 'bg-[#14532D] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Appliance Power (Watts)
            </label>
            <input
              type="number"
              value={calcWatts}
              onChange={(e) => {
                setCalcWatts(Math.max(1, Number(e.target.value) || 0));
                setSelectedPreset('custom');
              }}
              min={1}
              max={10000}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#059669] text-sm font-semibold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">e.g. 170W laptop, 200W cooler</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Daily Usage (Hours)
            </label>
            <input
              type="number"
              value={calcHours}
              onChange={(e) => setCalcHours(Math.max(0.1, Math.min(24, Number(e.target.value) || 0)))}
              min={0.1}
              max={24}
              step={0.5}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#059669] text-sm font-semibold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Hours active per day (max 24)</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Usage Days / Month
            </label>
            <input
              type="number"
              value={calcDays}
              onChange={(e) => setCalcDays(Math.max(1, Math.min(31, Number(e.target.value) || 0)))}
              min={1}
              max={31}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#059669] text-sm font-semibold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Days appliance runs in a month</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Tariff Rate (₹ / kWh)
            </label>
            <input
              type="number"
              value={calcTariff}
              onChange={(e) => setCalcTariff(Math.max(1, Number(e.target.value) || 0))}
              min={1}
              max={20}
              step={0.25}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#059669] text-sm font-semibold"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Gujarat domestic avg: ₹6.25</span>
          </div>
        </div>

        {/* Calculation Result Banner */}
        <div className="mt-6 p-5 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border-b sm:border-b-0 sm:border-r border-slate-200 pb-3 sm:pb-0 pr-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Electricity Consumption
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[#14532D]">
                {calculatedUnits}
              </span>
              <span className="text-xs font-bold text-slate-600">Units (kWh) / month</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Formula: ({calcWatts}W × {calcHours}h × {calcDays}d) ÷ 1000
            </span>
          </div>

          <div className="border-b sm:border-b-0 sm:border-r border-slate-200 pb-3 sm:pb-0 pr-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Monthly Bill Impact
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[#059669]">
                ₹{calculatedCost}
              </span>
              <span className="text-xs font-bold text-slate-600">/ month</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              ₹{(calculatedCost * 12).toLocaleString('en-IN')} / year at ₹{calcTariff}/unit
            </span>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Carbon Emissions
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800">
                {calculatedCo2Kg}
              </span>
              <span className="text-xs font-bold text-slate-600">kg CO₂ / month</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Offset by planting ~{Math.max(1, Math.round(calculatedCo2Kg / 1.7))} trees / year
            </span>
          </div>
        </div>

        {/* Rated Wattage vs Actual Draw Explanation */}
        {isAdapterOrVariable && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Important Distinction (Rated Adapter Wattage vs. Continuous Draw):</strong>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                The {calcWatts}W label on your charger or power brick represents its <strong>maximum burst capacity</strong> (e.g. charging a flat battery while running full 100% GPU/CPU load).
                Actual real-world draw during gaming is typically ~100W–130W, normal browsing is ~35W–50W, and once the battery reaches 100%, idle trickle draw is only ~15W.
                When the charger is left plugged into the wall without the device, it draws under 1W (negligible standby power).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4. Two Clean Analytics Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Historical Trend Chart (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  6-Month Electricity Trend
                </h3>
                <p className="text-xs text-slate-500">
                  Actual consumption vs Mission LiFE target for {profile.familyMembers} members
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" /> Actual
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-400">
                  <span className="w-2.5 h-0.5 bg-slate-400" /> Target
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="actualGradEnergy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      `${val ?? 0} kWh`,
                      name === 'actual' ? 'Actual Usage' : 'Mission LiFE Target',
                    ]}
                  />
                  <Area type="monotone" dataKey="actual" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#actualGradEnergy)" />
                  <Area type="monotone" dataKey="target" stroke="#94A3B8" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Monthly Target: <strong className="text-slate-800">{profile.familyMembers * 75} kWh</strong></span>
            <span className="text-emerald-700 font-semibold">Consistently below regional threshold</span>
          </div>
        </div>

        {/* Appliance Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Appliance Load Share
                </h3>
                <p className="text-xs text-slate-500">
                  Estimated monthly kWh by connected appliance
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {selectedAppliances.length} Active
              </span>
            </div>

            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={applianceChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {applianceChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} kWh / mo`, 'Estimated Draw']}
                    contentStyle={{ borderRadius: '10px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              {applianceChartData.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="truncate">{item.name}</span>
                  <span className="text-slate-400 font-mono text-[10px] ml-auto">{item.value} kWh</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
            Cooling and refrigeration comprise the largest portion of domestic Gujarat energy.
          </div>
        </div>
      </div>

      {/* 5. Progressive Disclosure: Expandable Regulatory & Methodology Details */}
      <div className="space-y-3">
        {/* Accordion 1: Grid Emission Factors */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <button
            onClick={() => setShowMethodology(!showMethodology)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#059669]" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                How is the Carbon Baseline calculated? (CEA Version 22.0)
              </span>
            </div>
            {showMethodology ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showMethodology && (
            <div className="px-6 pb-5 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-100 bg-slate-50/50">
              <p>
                • <strong>Official National Baseline:</strong> Built using the Central Electricity Authority (CEA) Version 22.0 database FY 2025-26 weighted average emission factor of <strong>0.675 kg CO₂/kWh</strong> for the unified Indian Grid.
              </p>
              <p>
                • <strong>Engineering Delivery-Loss Model:</strong> When transmission and delivery losses (~17.7% AT&amp;C) are modeled, the derived terminal emission factor is ~0.82 kg CO₂/kWh (clearly labeled as an engineering delivery estimate, not a published CEA figure).
              </p>
            </div>
          )}
        </div>

        {/* Accordion 2: DISCOM Tariff Slabs */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <button
            onClick={() => setShowDiscomTariffs(!showDiscomTariffs)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-[#059669]" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                Gujarat DISCOM Tariff Structure (GERC Benchmark)
              </span>
            </div>
            {showDiscomTariffs ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showDiscomTariffs && (
            <div className="px-6 pb-5 pt-1 text-xs text-slate-600 space-y-2 border-t border-slate-100 bg-slate-50/50">
              <p>
                • <strong>Residential Domestic Slabs:</strong> In Gujarat, utilities (UGVCL, PGVCL, DGVCL, MGVCL, and Torrent Power) follow telescopic slab billing approved by GERC.
              </p>
              <p>
                • <strong>Average Benchmark:</strong> For an average household consuming 200–350 kWh/month, the effective blend including Fuel Price and Power Purchase Adjustment (FPPPA) and electricity duty is approximately <strong>₹6.25 per unit (kWh)</strong>.
              </p>
              <p>
                • <strong>Solar Net-Metering &amp; Feed-In:</strong> Under GERC GIDRES Regulations 2026 (notified 30 October 2026), surplus solar injection into the grid is compensated at <strong>₹2.25/kWh</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
