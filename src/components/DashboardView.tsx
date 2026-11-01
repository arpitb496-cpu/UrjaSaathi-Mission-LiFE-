import React from 'react';
import {
  Flame,
  Award,
  Zap,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  TreeDeciduous,
  ArrowUpRight,
  Sun,
  Bot,
  Compass,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { AppState, calculateUserAggregates } from '../utils/storage';
import { APPLIANCE_CATALOG } from '../utils/sustainabilityMath';

interface DashboardViewProps {
  appState: AppState;
  setActiveTab: (tab: string) => void;
  onOpenOnboarding: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  appState,
  setActiveTab,
  onOpenOnboarding,
}) => {
  const { profile, streakDays, completedMissions } = appState;
  const aggregates = calculateUserAggregates(appState);
  const { baselineMetrics, effectiveGreenScore, totalMissions, totalCo2SavedKg, totalInrSaved } =
    aggregates;

  // Monthly electricity consumption 6-month historical & benchmark chart
  const consumptionHistoryData = [
    { month: 'Jun', actual: Math.round(profile.monthlyKwh * 1.25), benchmark: profile.familyMembers * 90 },
    { month: 'Jul', actual: Math.round(profile.monthlyKwh * 1.18), benchmark: profile.familyMembers * 85 },
    { month: 'Aug', actual: Math.round(profile.monthlyKwh * 1.05), benchmark: profile.familyMembers * 80 },
    { month: 'Sep', actual: Math.round(profile.monthlyKwh * 1.02), benchmark: profile.familyMembers * 80 },
    { month: 'Oct', actual: Math.round(profile.monthlyKwh * 0.95), benchmark: profile.familyMembers * 75 },
    { month: 'Current', actual: profile.monthlyKwh, benchmark: profile.familyMembers * 75 },
  ];

  // Appliance power distribution data
  const selectedAppliances = APPLIANCE_CATALOG.filter((app) =>
    (profile.appliances || []).includes(app.id)
  );

  const totalAppKwh = selectedAppliances.reduce((acc, curr) => acc + curr.avgKwh, 0) || 100;
  const applianceChartData = selectedAppliances.map((app) => ({
    name: app.name.split('(')[0].trim(),
    value: Math.round((app.avgKwh / totalAppKwh) * profile.monthlyKwh),
  }));

  const PIE_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#0284c7', '#38bdf8', '#f59e0b', '#fbbf24'];

  // Carbon trajectory data
  const carbonTrajectoryData = [
    { week: 'Week 1', baseCarbon: baselineMetrics.monthlyCarbonKg, withLiFE: baselineMetrics.monthlyCarbonKg },
    { week: 'Week 2', baseCarbon: baselineMetrics.monthlyCarbonKg, withLiFE: Math.round(baselineMetrics.monthlyCarbonKg - totalCo2SavedKg * 0.3) },
    { week: 'Week 3', baseCarbon: baselineMetrics.monthlyCarbonKg, withLiFE: Math.round(baselineMetrics.monthlyCarbonKg - totalCo2SavedKg * 0.65) },
    { week: 'Week 4', baseCarbon: baselineMetrics.monthlyCarbonKg, withLiFE: Math.max(10, Math.round(baselineMetrics.monthlyCarbonKg - totalCo2SavedKg)) },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome / Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <Sun className="w-80 h-80 text-lime-300" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/40 text-xs font-semibold text-lime-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              GEDA Mission LiFE Certified Household • {profile.district}, Gujarat
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-white">
              Namaste, <span className="text-lime-300">{profile.name}</span>!
            </h1>
            <p className="text-sm text-emerald-100/90 leading-relaxed">
              Your household is tracking at{' '}
              <strong className="text-white font-semibold">{baselineMetrics.perCapitaKwh} kWh</strong> per capita
              monthly. By taking proactive daily actions, you have already eliminated{' '}
              <strong className="text-lime-300 font-bold">{totalCo2SavedKg} kg CO2</strong> from Gujarat&apos;s grid.
            </p>
          </div>

          {/* Quick Green Score Dial */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 self-start md:self-auto shrink-0">
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-emerald-500/30 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-black font-heading text-lime-300 leading-none">
                    {effectiveGreenScore}
                  </div>
                  <div className="text-[10px] text-emerald-200 uppercase tracking-wider font-semibold">
                    Score
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">
                Status Tier
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>{baselineMetrics.tier.badge}</span>
                <span>{baselineMetrics.tier.name.split('(')[0]}</span>
              </div>
              <div className="text-[11px] text-lime-300 font-semibold">
                {baselineMetrics.tier.titleGujarati}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Key Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Green Score */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Green Score</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-heading text-emerald-950">
              {effectiveGreenScore}
              <span className="text-xs text-gray-400 font-normal">/100</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              Top 24% in {profile.district}
            </p>
          </div>
        </div>

        {/* Card 2: Monthly Carbon */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Carbon / Mo</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <TreeDeciduous className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-heading text-gray-900">
              {baselineMetrics.monthlyCarbonKg}
              <span className="text-xs text-gray-400 font-normal"> kg</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              ≈ {baselineMetrics.treeOffsetEquivalent} trees needed
            </p>
          </div>
        </div>

        {/* Card 3: Electricity Draw */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Power Usage</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-heading text-gray-900">
              {profile.monthlyKwh}
              <span className="text-xs text-gray-400 font-normal"> kWh</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              ₹{profile.monthlyBillInr} monthly bill
            </p>
          </div>
        </div>

        {/* Card 4: Energy Saved */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Energy Saved</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-heading text-amber-700">
              {Math.round(totalCo2SavedKg / 0.82)}
              <span className="text-xs text-gray-400 font-normal"> kWh</span>
            </div>
            <p className="text-[11px] text-amber-800 font-medium mt-1">
              Via daily missions
            </p>
          </div>
        </div>

        {/* Card 5: Money Saved */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Money Saved</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-heading text-emerald-800">
              ₹{totalInrSaved}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              Direct bill offset
            </p>
          </div>
        </div>

        {/* Card 6: Missions & Streak */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Missions Done</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <Flame className="w-4 h-4 fill-rose-500 text-rose-500" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-heading text-gray-900">
              {totalMissions}
              <span className="text-xs text-rose-600 font-bold ml-1">({streakDays}d streak)</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {aggregates.totalPoints} LiFE Points
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Monthly Consumption History vs LiFE Benchmark */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base font-heading">
                Electricity Consumption vs GEDA Mission LiFE Benchmark
              </h3>
              <p className="text-xs text-gray-500">
                Monthly units (kWh) for {profile.familyMembers}-member household in {profile.district}
              </p>
            </div>
            <span className="inline-flex items-center text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-semibold self-start sm:self-auto">
              Target: {profile.familyMembers * 75} kWh/mo
            </span>
          </div>

          <div className="h-64 sm:h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumptionHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val} kWh`, 'Units']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="actual" name="Your Consumption (kWh)" fill="#059669" radius={[6, 6, 0, 0]} />
                <Bar dataKey="benchmark" name="Mission LiFE Target (kWh)" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Major Appliance Energy Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs flex flex-col">
          <div className="pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm sm:text-base font-heading">
              Appliance Power Distribution
            </h3>
            <p className="text-xs text-gray-500">
              Estimated breakdown based on active household appliances
            </p>
          </div>

          <div className="h-56 mt-2 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={applianceChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {applianceChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} kWh`, 'Estimated Draw']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-400 font-medium">Total</span>
              <span className="text-sm font-bold text-gray-800">{profile.monthlyKwh} kWh</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-gray-100 text-xs">
            {applianceChartData.slice(0, 4).map((item, idx) => (
              <div key={item.name} className="flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                <span className="truncate text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Launchpad & Recommended Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Module Link 1: AI Green Coach */}
        <div
          onClick={() => setActiveTab('coach')}
          className="group cursor-pointer p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200/80 hover:shadow-md hover:border-emerald-400 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5 text-lime-300" />
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              Gemini AI <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <h4 className="font-bold text-gray-900 group-hover:text-emerald-800 transition-colors font-heading text-base">
            Consult AI Green Coach
          </h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Get personalized savings advice, tariff analysis, and a customized 7-day action plan from UrjaGuru.
          </p>
        </div>

        {/* Module Link 2: Daily Missions */}
        <div
          onClick={() => setActiveTab('missions')}
          className="group cursor-pointer p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 hover:shadow-md hover:border-amber-400 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-amber-200" />
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              14 Missions <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <h4 className="font-bold text-gray-900 group-hover:text-amber-800 transition-colors font-heading text-base">
            Daily Green Missions
          </h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Turn off phantom power, calibrate AC to 24°C, maintain your streak, and earn verified LiFE points.
          </p>
        </div>

        {/* Module Link 3: Rooftop Solar Calculator */}
        <div
          onClick={() => setActiveTab('solar')}
          className="group cursor-pointer p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-200/80 hover:shadow-md hover:border-blue-400 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sun className="w-5 h-5 text-yellow-300" />
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              ₹78,000 Subsidy <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <h4 className="font-bold text-gray-900 group-hover:text-blue-800 transition-colors font-heading text-base">
            Surya Gujarat Solar Feasibility
          </h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Check rooftop solar feasibility, calculate PM Surya Ghar subsidies, generation, and payback period.
          </p>
        </div>
      </div>
    </div>
  );
};
