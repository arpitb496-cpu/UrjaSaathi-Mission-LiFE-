import React, { useState, useEffect } from 'react';
import {
  Sun,
  Zap,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  TreeDeciduous,
  ArrowRight,
  HelpCircle,
  FileText,
  AlertTriangle,
  Info,
  Maximize2,
  Sliders,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  calculateSolarFeasibility,
  SolarCalculationResult,
  GUJARAT_DISTRICTS,
  HouseholdProfile,
} from '../utils/sustainabilityMath';
import {
  generateSolarFeasibilityPdf,
  triggerBrowserPdfDownload,
  SOLAR_REPORT_FILENAME,
  formatIstDate,
} from '../utils/pdfGenerator';

interface SolarCalculatorViewProps {
  initialProfile: HouseholdProfile;
}

export const SolarCalculatorView: React.FC<SolarCalculatorViewProps> = ({ initialProfile }) => {
  const [applicantName, setApplicantName] = useState<string>(
    initialProfile.name || 'Household Applicant'
  );
  const [monthlyKwh, setMonthlyKwh] = useState<number>(initialProfile.monthlyKwh || 300);
  const [rooftopArea, setRooftopArea] = useState<number>(
    initialProfile.rooftopAvailableSqFt > 0 ? initialProfile.rooftopAvailableSqFt : 350
  );
  const [district, setDistrict] = useState<string>(initialProfile.district || 'Ahmedabad');
  const [monthlyBill, setMonthlyBill] = useState<number>(initialProfile.monthlyBillInr || 2100);
  const [tariffRate, setTariffRate] = useState<number>(6.25);
  const [hasBattery, setHasBattery] = useState<boolean>(false);
  const [systemLosses, setSystemLosses] = useState<number>(17.5);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [pdfStatus, setPdfStatus] = useState<{
    downloading: boolean;
    error: string | null;
    successMessage: string | null;
  }>({
    downloading: false,
    error: null,
    successMessage: null,
  });

  useEffect(() => {
    if (initialProfile.name) {
      setApplicantName(initialProfile.name);
    }
  }, [initialProfile.name]);

  // Calculate live results using our domain math
  const result: SolarCalculationResult = calculateSolarFeasibility({
    monthlyKwh,
    rooftopAreaSqFt: rooftopArea,
    district,
    monthlyBillInr: monthlyBill,
    unitRateInr: tariffRate,
    hasBatteryBackup: hasBattery,
    systemLossesPercent: systemLosses,
  });

  const handleDownloadSolarPdf = async () => {
    setPdfStatus({ downloading: true, error: null, successMessage: null });
    try {
      const pdfBytes = await generateSolarFeasibilityPdf({
        applicantName: applicantName.trim() || initialProfile.name || 'Household Applicant',
        district,
        monthlyKwh,
        monthlyBillInr: monthlyBill,
        rooftopAreaSqFt: rooftopArea,
        hasBatteryBackup: hasBattery,
        calculation: result,
        generatedAt: new Date(),
      });

      const downloadResult = triggerBrowserPdfDownload(pdfBytes, SOLAR_REPORT_FILENAME);
      setPdfStatus({
        downloading: false,
        error: null,
        successMessage: `Downloaded ${downloadResult.filename} (${(
          downloadResult.sizeBytes / 1024
        ).toFixed(1)} KB)`,
      });
    } catch (err: any) {
      setPdfStatus({
        downloading: false,
        error: err?.message || 'Failed to generate Solar Feasibility PDF.',
        successMessage: null,
      });
    }
  };

  // Comparison chart data: Current vs With Rooftop Solar
  const billComparisonData = [
    {
      name: 'Current Grid Bill',
      amount: monthlyBill,
      label: `₹${monthlyBill}/mo`,
    },
    {
      name: 'With Surya Gujarat Solar',
      amount: Math.max(0, monthlyBill - result.monthlySavingsInr),
      label: `₹${Math.max(0, monthlyBill - result.monthlySavingsInr)}/mo`,
    },
  ];

  return (
    <div className="space-y-6 pb-12" data-testid="solar-calculator-view">
      {/* Hero Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>Surya Gujarat &amp; PM Surya Ghar: Muft Bijli Yojana Compliant</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Interactive Rooftop Solar Feasibility
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Gujarat receives over 300 sunny days annually with high solar insolation (~5.2 kWh/m²/day).
              Calculate system capacity, Central government subsidies, and payback economics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              type="button"
              data-testid="download-solar-pdf-btn"
              onClick={handleDownloadSolarPdf}
              disabled={pdfStatus.downloading}
              className="px-4 py-2.5 rounded-xl bg-[#14532D] hover:bg-emerald-900 disabled:opacity-60 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              {pdfStatus.downloading ? (
                <RefreshCw className="w-4 h-4 text-[#A3E635] animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-[#A3E635]" />
              )}
              <span>
                {pdfStatus.downloading
                  ? 'Generating PDF...'
                  : 'Generate PDF Feasibility Summary'}
              </span>
            </button>

            <button
              type="button"
              data-testid="preview-solar-summary-btn"
              onClick={() => setShowPrintModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#059669]" />
              <span>Preview Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* PDF Download Feedback Banner */}
      {(pdfStatus.successMessage || pdfStatus.error) && (
        <div
          data-testid="solar-pdf-status"
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            pdfStatus.error
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{pdfStatus.error || pdfStatus.successMessage}</span>
          </div>
          <span className="font-mono text-[11px] opacity-80">application/pdf</span>
        </div>
      )}

      {/* Main Grid: Inputs vs Outputs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* INPUTS COLUMN (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-emerald-100 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 font-heading text-base flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              Feasibility Parameters
            </h3>
            <span className="text-[11px] text-gray-400">All inputs configurable</span>
          </div>

          {/* Applicant Name */}
          <div>
            <label htmlFor="solarApplicantName" className="block text-xs font-bold text-gray-700 mb-1">
              Applicant Name
            </label>
            <input
              id="solarApplicantName"
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-xs bg-white font-semibold"
              placeholder="Enter household applicant name"
            />
          </div>

          {/* District selector */}
          <div>
            <label htmlFor="solarDistrictSelect" className="block text-xs font-bold text-gray-700 mb-1">
              District in Gujarat
            </label>
            <select
              id="solarDistrictSelect"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 text-xs bg-white font-medium"
            >
              {GUJARAT_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Monthly Consumption Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-gray-700">Monthly Consumption</label>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                {monthlyKwh} kWh / month
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="1500"
              step="25"
              value={monthlyKwh}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setMonthlyKwh(val);
                setMonthlyBill(Math.round(val * tariffRate));
              }}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>50 units</span>
              <span>300 (Average)</span>
              <span>1500 units</span>
            </div>
          </div>

          {/* Rooftop Area Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-gray-700">Available Shadow-Free Rooftop</label>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                {rooftopArea} sq. ft
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="1500"
              step="50"
              value={rooftopArea}
              onChange={(e) => setRooftopArea(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>50 sq.ft (~0.5 kW)</span>
              <span>350 sq.ft (~3.5 kW)</span>
              <span>1500 sq.ft</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              1 kW standard monocrystalline PV requires ~100 sq.ft.
            </p>
          </div>

          {/* Monthly Bill Input */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Current Average Monthly Electricity Bill (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500 text-xs font-bold">₹</span>
              <input
                type="number"
                value={monthlyBill}
                onChange={(e) => setMonthlyBill(parseInt(e.target.value, 10) || 0)}
                className="w-full pl-7 pr-3 py-2 rounded-xl border border-gray-300 text-xs font-bold"
              />
            </div>
          </div>

          {/* Tariff Rate Override */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                DISCOM Tariff (₹/unit)
              </label>
              <input
                type="number"
                step="0.1"
                min="3.0"
                max="12.0"
                value={tariffRate}
                onChange={(e) => setTariffRate(parseFloat(e.target.value) || 6.25)}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold"
              />
            </div>

            <div className="flex items-center pt-4">
              <input
                type="checkbox"
                id="batteryCheck"
                checked={hasBattery}
                onChange={(e) => setHasBattery(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
              />
              <label htmlFor="batteryCheck" className="text-xs font-medium text-gray-700 ml-2">
                Hybrid Battery Backup
              </label>
            </div>
          </div>

          {/* Configurable System Losses & Performance Ratio (PR) */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-gray-700">
                System Losses & Performance Ratio (PR)
              </label>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                Losses: {systemLosses}% • PR: {result.assumptions.performanceRatio}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="30"
              step="0.5"
              value={systemLosses}
              onChange={(e) => setSystemLosses(parseFloat(e.target.value) || 17.5)}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>10% (High Efficiency)</span>
              <span>17.5% (Standard Default)</span>
              <span>30% (High Dust/Soiling)</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              PR incorporates dust/soiling (4%), temperature derating (8.5%), cabling (2%), and inverter losses (3%).
            </p>
          </div>

          {/* Regulatory Regime Callout */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-950 space-y-1">
            <div className="flex items-center gap-1 font-bold text-emerald-900">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>GERC GIDRES Regulations, 2026 (Notified 30 Oct 2026)</span>
            </div>
            <p className="leading-snug text-emerald-800">
              Surplus solar injection into the Gujarat grid is compensated at <strong>₹2.25/kWh</strong> under the newly notified 2026 regulations (expressly distinguished from the DISCOM bulk APPC rate).
            </p>
          </div>
        </div>

        {/* OUTPUTS COLUMN (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Top Recommendation Highlight Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-900 text-white shadow-md">
            <div className="flex items-center justify-between border-b border-emerald-700/70 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sun className="w-5 h-5 text-yellow-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-lime-300">
                  Recommended PV System
                </span>
              </div>
              <span className="text-xs bg-emerald-700/80 px-2.5 py-1 rounded-full font-bold">
                {result.solarCoveragePercent}% Bill Offset
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white/10 p-3 rounded-xl">
                <p className="text-[10px] text-emerald-200">Recommended Size</p>
                <p className="text-2xl font-bold font-heading text-lime-300">
                  {result.suggestedCapacityKw}{' '}
                  <span className="text-xs text-white/80">kW</span>
                </p>
                <p className="text-[10px] text-emerald-200 mt-0.5">On-Grid Rooftop</p>
              </div>

              <div className="bg-white/10 p-3 rounded-xl">
                <p className="text-[10px] text-emerald-200">Monthly Generation</p>
                <p className="text-2xl font-bold font-heading text-white">
                  {result.monthlyGenerationKwh}{' '}
                  <span className="text-xs text-emerald-300">kWh</span>
                </p>
                <p className="text-[10px] text-emerald-200 mt-0.5">~{result.annualGenerationKwh} kWh/yr</p>
              </div>

              <div className="bg-white/10 p-3 rounded-xl">
                <p className="text-[10px] text-emerald-200">Central Subsidy</p>
                <p className="text-2xl font-bold font-heading text-lime-300">
                  ₹{(result.applicableSubsidyInr / 1000).toFixed(0)}k
                </p>
                <p className="text-[10px] text-emerald-200 mt-0.5">PM Surya Ghar</p>
              </div>

              <div className="bg-white/10 p-3 rounded-xl">
                <p className="text-[10px] text-emerald-200">Est. Payback Period</p>
                <p className="text-2xl font-bold font-heading text-white">
                  {result.paybackPeriodYears}{' '}
                  <span className="text-xs text-emerald-300">Yrs</span>
                </p>
                <p className="text-[10px] text-emerald-200 mt-0.5">Quick ROI</p>
              </div>
            </div>
          </div>

          {/* Financial Breakdown Table & Cards */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs space-y-4">
            <h4 className="font-bold text-gray-900 text-sm font-heading">
              Financial Breakdown & Government Subsidy
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500">Gross Estimated Cost</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">
                  ₹{result.grossSystemCostInr.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Standard GEDA vendor benchmark
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-emerald-800 font-semibold">Central Subsidy (CFA)</p>
                <p className="text-lg font-bold text-emerald-700 mt-0.5">
                  - ₹{result.applicableSubsidyInr.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  Direct Bank Transfer (DBT)
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200">
                <p className="text-xs text-teal-800 font-semibold">Net Customer Investment</p>
                <p className="text-lg font-bold text-teal-800 mt-0.5">
                  ₹{result.netSystemCostInr.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-teal-600 mt-0.5">
                  After subsidy deduction
                </p>
              </div>
            </div>

            {/* Bill Comparison Bar Chart */}
            <div className="pt-2">
              <p className="text-xs font-bold text-gray-700 mb-2">
                Monthly Bill Comparison (Before vs After Rooftop Solar)
              </p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={billComparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip formatter={(val: any) => [`₹${val}`, 'Monthly Cost']} />
                    <Bar dataKey="amount" fill="#059669" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 25-Year Long Term Gains */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50/60 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-emerald-950">
                  25-Year Cumulative Savings: ₹{(result.twentyFiveYearSavingsInr / 100000).toFixed(1)} Lakhs
                </p>
                <p className="text-emerald-800 mt-0.5">
                  Eliminates {result.twentyFiveYearCo2ReductionTonnes} tonnes of coal CO2 emissions (≈ {result.treeEquivalentLifetime} trees planted).
                </p>
              </div>
              <div className="shrink-0 font-bold text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-300">
                Save ₹{result.monthlySavingsInr}/mo
              </div>
            </div>
          </div>

          {/* Transparent Assumptions & Disclaimers Box */}
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Transparent Formula Assumptions & Regulatory Parameters</span>
            </div>
            <p className="leading-relaxed text-[11px] text-amber-900/90">
              {result.disclaimer}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-amber-200/60 text-[10px] text-amber-800">
              <div>
                <strong>Solar Insolation:</strong> {result.assumptions.solarIrradiancePshPerDay} PSH/day
              </div>
              <div>
                <strong>Monthly Yield:</strong> {result.assumptions.generationPerKwMonthlyKwh} kWh/kW
              </div>
              <div>
                <strong>DISCOM Tariff:</strong> ₹{result.assumptions.discomTariffRateInr}/kWh
              </div>
              <div>
                <strong>Surplus Export Rate:</strong> ₹{result.assumptions.surplusInjectionCompensationInr}/kWh
              </div>
              <div>
                <strong>Benchmark Cost:</strong> ₹{result.assumptions.baseSystemCostPerKwInr.toLocaleString('en-IN')}/kW
              </div>
              <div>
                <strong>PV Degradation:</strong> {result.assumptions.annualDegradationPct}%/year
              </div>
            </div>
          </div>

          {/* PM Surya Ghar Eligibility & Source References */}
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>PM Surya Ghar: Muft Bijli Yojana — Eligibility & DBT Conditions</span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded">
                Official Guidelines
              </span>
            </div>

            <ul className="space-y-1.5 text-[11px] text-emerald-900/90 list-disc pl-4">
              {result.eligibilityConditions.map((cond, i) => (
                <li key={i}>{cond}</li>
              ))}
            </ul>

            <div className="pt-2 border-t border-emerald-200/60">
              <span className="text-[10px] font-bold text-emerald-800 block mb-1">
                Authoritative References:
              </span>
              <div className="space-y-0.5 text-[10px] text-emerald-700">
                {result.sourceReferences.map((ref, i) => (
                  <p key={i}>• {ref}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feasibility PDF Modal / Summary Preview */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-2xl shadow-2xl p-6 border border-emerald-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Sun className="w-6 h-6 text-emerald-600" />
                <h3 className="font-bold text-lg text-emerald-950 font-heading">
                  UrjaSaathi Solar Feasibility Report Summary
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-700">
              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                <div>
                  <strong>Applicant:</strong> {applicantName || initialProfile.name}
                </div>
                <div>
                  <strong>District:</strong> {district}, Gujarat
                </div>
                <div>
                  <strong>Terrace Area:</strong> {rooftopArea} sq.ft
                </div>
                <div>
                  <strong>Consumption:</strong> {monthlyKwh} kWh/mo
                </div>
                <div>
                  <strong>Report Date:</strong> {formatIstDate(new Date())}
                </div>
                <div>
                  <strong>DISCOM Tariff:</strong> ₹{result.assumptions.discomTariffRateInr}/kWh
                </div>
              </div>

              <div className="space-y-1 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p>
                  <strong>Recommended Capacity:</strong> {result.suggestedCapacityKw} kW PV System
                </p>
                <p>
                  <strong>Monthly Generation:</strong> ~{result.monthlyGenerationKwh} Units (kWh)
                </p>
                <p>
                  <strong>Gross Cost:</strong> ₹{result.grossSystemCostInr.toLocaleString('en-IN')}
                </p>
                <p>
                  <strong>PM Surya Ghar Central Subsidy:</strong> -₹{result.applicableSubsidyInr.toLocaleString('en-IN')}
                </p>
                <p className="font-bold text-emerald-900">
                  <strong>Net Investment:</strong> ₹{result.netSystemCostInr.toLocaleString('en-IN')}
                </p>
                <p>
                  <strong>Estimated Annual Savings:</strong> ₹{result.annualSavingsInr.toLocaleString('en-IN')}/yr
                </p>
                <p>
                  <strong>Payback Period:</strong> {result.paybackPeriodYears} Years
                </p>
                <p>
                  <strong>Performance Ratio:</strong> {result.assumptions.performanceRatio} (System Losses: {result.assumptions.systemLossesPercent}%)
                </p>
                <p>
                  <strong>Surplus Feed-in Tariff:</strong> ₹{result.assumptions.surplusInjectionCompensationInr}/kWh (GERC GIDRES Regulations 2026)
                </p>
              </div>

              <p className="text-[11px] text-gray-500 italic">
                {result.disclaimer}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                data-testid="modal-download-solar-pdf-btn"
                onClick={handleDownloadSolarPdf}
                disabled={pdfStatus.downloading}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {pdfStatus.downloading
                    ? 'Generating PDF...'
                    : `Download PDF (${SOLAR_REPORT_FILENAME})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
