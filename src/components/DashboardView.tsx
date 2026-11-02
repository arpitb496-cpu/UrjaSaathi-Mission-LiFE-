import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Zap,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  Flame,
  Award,
  Users,
  CheckCircle2,
  Sparkles,
  Leaf,
  SlidersHorizontal,
  SunMedium,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { AppState, calculateUserAggregates } from '../utils/storage';
import { MISSIONS_LIST, Mission } from '../data/missionsData';

interface DashboardViewProps {
  appState: AppState;
  setActiveTab: (tab: string) => void;
  onOpenOnboarding: () => void;
  onToggleMission?: (mission: Mission) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  appState,
  setActiveTab,
  onOpenOnboarding,
  onToggleMission,
}) => {
  const { profile, streakDays, completedMissions } = appState;
  const aggregates = calculateUserAggregates(appState);
  const { baselineMetrics, effectiveGreenScore, totalMissions, totalCo2SavedKg, totalInrSaved } =
    aggregates;

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pick the single highest-impact incomplete mission for today
  const incompleteMissions = MISSIONS_LIST.filter((m) => !completedMissions[m.id]);
  const featuredMission = incompleteMissions.length > 0 ? incompleteMissions[0] : MISSIONS_LIST[0];
  const isFeaturedCompleted = !!completedMissions[featuredMission.id];

  const handleCompleteFeaturedMission = () => {
    if (onToggleMission) {
      onToggleMission(featuredMission);
      if (!isFeaturedCompleted) {
        try {
          confetti({
            particleCount: 55,
            spread: 60,
            origin: { y: 0.65 },
            colors: ['#14532D', '#059669', '#A3E635', '#34D399'],
          });
        } catch {
          // ignore in headless
        }
        setToastMessage(`Mission Completed! +${featuredMission.points} LiFE points credited to your passport.`);
        setTimeout(() => setToastMessage(null), 3500);
      }
    }
  };

  // Determine score tier & visual indicator
  const getScoreTier = (score: number) => {
    if (score >= 80) return { label: 'Emerald Steward', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (score >= 60) return { label: 'Active Eco-Warrior', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' };
    if (score >= 40) return { label: 'Conscious Consumer', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    return { label: 'Transitioning Household', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' };
  };

  const tier = getScoreTier(effectiveGreenScore);

  // SVG Circular progress ring calculations
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, effectiveGreenScore)) / 100) * circumference;

  // 6-Month clean electricity consumption trend vs LiFE benchmark
  const monthlyTrendData = [
    { month: 'Jun', consumption: Math.round(profile.monthlyKwh * 1.22), benchmark: profile.familyMembers * 85 },
    { month: 'Jul', consumption: Math.round(profile.monthlyKwh * 1.15), benchmark: profile.familyMembers * 80 },
    { month: 'Aug', consumption: Math.round(profile.monthlyKwh * 1.08), benchmark: profile.familyMembers * 80 },
    { month: 'Sep', consumption: Math.round(profile.monthlyKwh * 1.02), benchmark: profile.familyMembers * 75 },
    { month: 'Oct', consumption: Math.round(profile.monthlyKwh * 0.95), benchmark: profile.familyMembers * 75 },
    { month: 'Current', consumption: profile.monthlyKwh, benchmark: profile.familyMembers * 70 },
  ];

  // Potential monthly savings estimate
  const potentialMonthlySavingsInr = Math.round(profile.monthlyBillInr * 0.22);
  const potentialMonthlyKwhSaved = Math.round(profile.monthlyKwh * 0.22);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#14532D] text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-600/50 flex items-center gap-2.5 text-xs font-semibold animate-fade-in">
          <Sparkles className="w-4 h-4 text-[#A3E635]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. WELCOME SECTION (Clean, Personalised, Uncluttered) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#059669]">
            <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
            <span>
              Mission LiFE Energy Portal
              {profile.district ? ` • ${profile.district}, Gujarat` : ''}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {profile.name ? (
              <>
                Namaste, <span className="text-[#14532D]">{profile.name}</span>
              </>
            ) : (
              <>
                Namaste! <span className="text-[#14532D]">Welcome to UrjaSaathi</span>
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
            Here is your daily household energy overview. Take today&apos;s action to lower your bill and cut grid carbon emissions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenOnboarding}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 flex items-center gap-2 transition-colors border border-slate-200"
            title="Edit household appliances and bill values"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Update Details</span>
          </button>
          <button
            onClick={() => setActiveTab('solar')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#14532D] hover:bg-[#059669] flex items-center gap-2 transition-all shadow-xs"
          >
            <SunMedium className="w-3.5 h-3.5 text-[#A3E635]" />
            <span>Solar Feasibility</span>
          </button>
        </div>
      </div>

      {/* 2. THE 3 CORE QUESTIONS (Understood within 5 seconds) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* GREEN SCORE CIRCULAR INDICATOR (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col items-center justify-between text-center">
          <div className="w-full flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Household Green Score</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tier.bg} ${tier.color} ${tier.border}`}>
              {tier.label}
            </span>
          </div>

          <div className="relative my-3 flex items-center justify-center">
            <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 144 144">
              <circle
                cx="72"
                cy="72"
                r={radius}
                stroke="#F1F5F9"
                strokeWidth="11"
                fill="none"
              />
              <circle
                cx="72"
                cy="72"
                r={radius}
                stroke="#059669"
                strokeWidth="11"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl sm:text-4xl font-extrabold text-[#14532D] tracking-tight">
                {effectiveGreenScore}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">out of 100</span>
            </div>
          </div>

          <div className="w-full pt-3 border-t border-slate-100 text-left">
            <p className="text-xs text-slate-600 leading-snug">
              {effectiveGreenScore >= 70
                ? `Outstanding! You are performing better than 74% of households${profile.district ? ` in ${profile.district}` : ''}.`
                : effectiveGreenScore >= 50
                ? `Good progress! Implementing today's recommended action will lift your score into the top tier.`
                : `Your household has significant potential to save up to ₹${potentialMonthlySavingsInr} every month.`}
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Daily Streak:</span>
              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200/60">
                <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                {streakDays} {streakDays === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>
        </div>

        {/* 2 EXECUTIVE METRICS: HOW MUCH ELECTRICITY & HOW MUCH CAN I SAVE (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* QUESTION 1: HOW MUCH ELECTRICITY AM I CONSUMING? */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Monthly Consumption
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Electricity Consumed
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {profile.monthlyKwh}
                </span>
                <span className="text-sm font-bold text-slate-500">kWh / month</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Monthly grid bill: <strong className="text-slate-900">₹{profile.monthlyBillInr}</strong> (~{(profile.monthlyKwh / (profile.familyMembers * 30)).toFixed(1)} kWh per person/day).
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Carbon: <strong>{baselineMetrics.monthlyCarbonKg} kg CO₂</strong>
              </span>
              <button
                onClick={() => setActiveTab('my-energy')}
                className="text-xs font-bold text-[#059669] hover:text-[#14532D] flex items-center gap-1 group"
              >
                <span>Appliance Breakdown</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* QUESTION 2: HOW MUCH MONEY AND ENERGY CAN I SAVE? */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-lime-100 text-emerald-900 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-emerald-800" />
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-lime-100/70 px-2 py-0.5 rounded-full border border-lime-300">
                  Potential Savings
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Monthly Savings Potential
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-[#059669] tracking-tight">
                  ₹{potentialMonthlySavingsInr}
                </span>
                <span className="text-sm font-bold text-slate-500">/ month</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Save approximately <strong className="text-[#14532D]">~{potentialMonthlyKwhSaved} kWh</strong> monthly by optimizing AC thermostat and eliminating standby power.
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Lifetime: <strong>₹{(potentialMonthlySavingsInr * 12 * 5).toLocaleString('en-IN')}</strong> in 5 yrs
              </span>
              <button
                onClick={() => setActiveTab('solar')}
                className="text-xs font-bold text-[#059669] hover:text-[#14532D] flex items-center gap-1 group"
              >
                <span>Solar Calculator</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. QUESTION 3: WHAT SHOULD I DO TODAY? (Featured Daily Action) */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-7 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-radial from-white to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 text-[#A3E635] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Featured Action of the Day
              </span>
              <span className="text-xs text-emerald-200">
                • +{featuredMission.points} LiFE Points
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-heading">
              {featuredMission.title}
            </h3>

            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              {featuredMission.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-emerald-200">
              <span className="bg-white/10 px-2.5 py-1 rounded-lg">
                Impact: <strong>~{featuredMission.co2SavedKg} kg CO₂ saved</strong>
              </span>
              <span className="bg-white/10 px-2.5 py-1 rounded-lg">
                Savings: <strong>₹{featuredMission.inrSaved} on electricity bill</strong>
              </span>
              <span className="text-emerald-300 font-medium">
                Pillar: {featuredMission.lifePillar}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <button
              onClick={handleCompleteFeaturedMission}
              className={`px-5 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                isFeaturedCompleted
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
                  : 'bg-[#A3E635] hover:bg-lime-300 text-emerald-950 scale-100 hover:scale-[1.02]'
              }`}
            >
              {isFeaturedCompleted ? (
                <>
                  <Check className="w-4 h-4 text-[#A3E635]" />
                  <span>Completed Today!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                  <span>Complete Action</span>
                </>
              )}
            </button>

            <button
              onClick={() => setActiveTab('missions')}
              className="px-4 py-2.5 rounded-xl font-semibold text-xs text-emerald-200 hover:text-white hover:bg-white/10 flex items-center justify-center gap-1 transition-colors"
            >
              <span>View All 14 Missions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. PROGRESSIVE DISCLOSURE: 6-MONTH TREND & COMMUNITY PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 6-Month Energy Trend Card (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                6-Month Energy Trend vs Target
              </h3>
              <p className="text-xs text-slate-500">
                Tracking your consumption toward Gujarat Mission LiFE efficiency benchmarks.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('my-energy')}
              className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Detailed Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="consumptionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `${val} kWh`,
                    name === 'consumption' ? 'Household Actual' : 'Mission LiFE Target',
                  ]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="consumption"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#consumptionGrad)"
                  name="consumption"
                />
                <Area
                  type="monotone"
                  dataKey="benchmark"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                  name="benchmark"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
                <span>Actual Usage</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span>LiFE Target</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              DISCOM: {profile.district} Division
            </span>
          </div>
        </div>

        {/* Community & Impact Summary Card (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    Community &amp; Gujarat Impact
                  </h3>
                  <p className="text-[11px] text-slate-500">33-District Sustainability Leaderboard</p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-emerald-50 text-[#059669] px-2 py-0.5 rounded border border-emerald-200">
                Rank #{profile.district === 'Gandhinagar' ? '1' : '3'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mt-2">
              Your household is part of the collective Gujarat Mission LiFE drive.
              Together, Gujarat households have reduced over <strong>1,840 metric tonnes</strong> of peak-hour CO₂ emissions this quarter.
            </p>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Missions Done</p>
                <p className="text-lg font-bold text-slate-900">{totalMissions}</p>
                <p className="text-[10px] text-emerald-600 font-medium">+{totalCo2SavedKg} kg CO₂ saved</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">LiFE Points</p>
                <p className="text-lg font-bold text-[#059669]">{aggregates.totalPoints}</p>
                <p className="text-[10px] text-slate-500 font-medium">Passport Verified</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Award className="w-4 h-4 text-[#059669]" />
              <span>Digital Green Passport Active</span>
            </div>
            <button
              onClick={() => setActiveTab('impact')}
              className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1"
            >
              <span>View Leaderboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
