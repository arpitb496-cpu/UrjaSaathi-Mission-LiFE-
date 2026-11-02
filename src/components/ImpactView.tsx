import React, { useState, useEffect } from 'react';
import {
  Award,
  Trophy,
  Users,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  TreeDeciduous,
  Zap,
  TrendingDown,
  DollarSign,
  Download,
  Share2,
  QrCode,
  Sparkles,
  Flame,
  Leaf,
  Calendar,
  Lock,
  Printer,
  Info,
} from 'lucide-react';
import { AppState, calculateUserAggregates } from '../utils/storage';
import { MISSIONS_LIST } from '../data/missionsData';

interface ImpactViewProps {
  appState: AppState;
  initialSubTab?: 'achievements' | 'leaderboard' | 'districts' | 'passport';
}

export const ImpactView: React.FC<ImpactViewProps> = ({
  appState,
  initialSubTab = 'achievements',
}) => {
  const [activeTab, setActiveTab] = useState<'achievements' | 'leaderboard' | 'districts' | 'passport'>(
    initialSubTab
  );
  const [communityData, setCommunityData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const aggregates = calculateUserAggregates(appState);
  const { profile, streakDays, completedMissions } = appState;
  const { baselineMetrics, effectiveGreenScore, totalMissions, totalCo2SavedKg, totalInrSaved } =
    aggregates;

  useEffect(() => {
    fetch('/api/community/stats')
      .then((res) => res.json())
      .then((data) => {
        setCommunityData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Could not fetch community data:', err);
        setLoading(false);
      });
  }, []);

  const passportId = `GEDA-LIFE-GJ-2026-${(
    (profile.name.length * 7919 + profile.monthlyKwh * 13) %
    90000 + 10000
  )}`;

  const BADGE_DEFINITIONS = [
    {
      id: 'pioneer',
      name: 'Mission LiFE Pioneer',
      description: 'Completed onboarding and established your household carbon baseline.',
      icon: '🌱',
      unlocked: true,
      category: 'Foundation',
    },
    {
      id: 'ac_master',
      name: 'AC 24°C Maestro',
      description: 'Maintained air conditioner at 24°C during peak Gujarat afternoons.',
      icon: '❄️',
      unlocked: !!completedMissions['m-ac-24'],
      category: 'Cooling',
    },
    {
      id: 'vampire_slayer',
      name: 'Vampire Load Slayer',
      description: 'Eliminated idle standby consumption across residential electronics.',
      icon: '⚡',
      unlocked: !!completedMissions['m-phantom-power'],
      category: 'Habits',
    },
    {
      id: 'solar_advocate',
      name: 'Surya Mitra (Solar Champion)',
      description: 'Evaluated rooftop solar feasibility or installed grid-tied solar.',
      icon: '☀️',
      unlocked: profile.hasSolarInstalled || profile.rooftopAvailableSqFt >= 200,
      category: 'Solar',
    },
    {
      id: 'fan_upgrader',
      name: 'BLDC Fan Evangelist',
      description: 'Adopted BEE 5-star energy efficient ceiling fan technology.',
      icon: '🌀',
      unlocked: !!completedMissions['m-bldc-fan'],
      category: 'Efficiency',
    },
    {
      id: 'streak_warrior',
      name: '7-Day Green Streak',
      description: 'Demonstrated 7 or more consecutive days of active sustainability.',
      icon: '🔥',
      unlocked: streakDays >= 7,
      category: 'Habits',
    },
    {
      id: 'water_saver',
      name: 'Jal Sanrakshak',
      description: 'Adopted bucket bath habit to eliminate electric geyser overdraw.',
      icon: '💧',
      unlocked: !!completedMissions['m-bucket-bath'],
      category: 'Habits',
    },
    {
      id: 'community_leader',
      name: 'GEDA Green Ambassador',
      description: 'Achieved an audited Green Score of 85 or higher in your district.',
      icon: '🏆',
      unlocked: effectiveGreenScore >= 85,
      category: 'Leadership',
    },
  ];

  const unlockedCount = BADGE_DEFINITIONS.filter((b) => b.unlocked).length;

  const topChampions = communityData?.topChampions || [
    { rank: 1, name: 'Bhavik Patel', district: 'Gandhinagar', greenScore: 96, missionsCompleted: 48, solarUser: true, streakDays: 34 },
    { rank: 2, name: 'Ananya Shah', district: 'Ahmedabad', greenScore: 94, missionsCompleted: 42, solarUser: true, streakDays: 28 },
    { rank: 3, name: 'Dhaval Joshi', district: 'Vadodara', greenScore: 92, missionsCompleted: 39, solarUser: false, streakDays: 21 },
    { rank: 4, name: 'Meera Trivedi', district: 'Rajkot', greenScore: 90, missionsCompleted: 36, solarUser: true, streakDays: 19 },
    { rank: 5, name: 'Kinjal Mehta', district: 'Surat', greenScore: 89, missionsCompleted: 35, solarUser: false, streakDays: 16 },
  ];

  const districtStats = communityData?.districtStats || [
    { district: 'Ahmedabad', households: 48200, mwhSaved: 1420, co2ReducedTonnes: 1164, avgScore: 78 },
    { district: 'Surat', households: 39500, mwhSaved: 1180, co2ReducedTonnes: 967, avgScore: 76 },
    { district: 'Vadodara', households: 28400, mwhSaved: 890, co2ReducedTonnes: 729, avgScore: 75 },
    { district: 'Gandhinagar', households: 18900, mwhSaved: 630, co2ReducedTonnes: 516, avgScore: 82 },
    { district: 'Rajkot', households: 24100, mwhSaved: 760, co2ReducedTonnes: 623, avgScore: 74 },
  ];

  const handleCopyCredential = () => {
    navigator.clipboard.writeText(
      `URJASAATHI Mission LiFE Digital Credential: ID ${passportId} for ${profile.name} (${profile.district}). Green Score: ${effectiveGreenScore}/100.`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Personal Impact Summary */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>My Impact &amp; Community Recognition</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading mt-1">
              Sustainability Impact Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Celebrating verified sustainability actions, district standings, and your Green Impact Passport.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-bold flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#059669]" />
              <span>{unlockedCount}/8 Badges Unlocked</span>
            </span>
          </div>
        </div>

        {/* Simplified Personal Impact Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Green Score</span>
            <div className="text-xl font-black text-[#14532D] mt-0.5">{effectiveGreenScore}/100</div>
            <span className="text-[10px] text-emerald-700 font-medium">{baselineMetrics.tier.name}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">CO₂ Offset</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">{totalCo2SavedKg} kg</div>
            <span className="text-[10px] text-slate-500">~{baselineMetrics.treeOffsetEquivalent} Trees Eq.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Money Saved</span>
            <div className="text-xl font-black text-[#059669] mt-0.5">₹{totalInrSaved}</div>
            <span className="text-[10px] text-slate-500">Cumulative habits</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Active Streak</span>
            <div className="text-xl font-black text-amber-700 mt-0.5 flex items-center gap-1">
              <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>{streakDays} Days</span>
            </div>
            <span className="text-[10px] text-slate-500">Daily consistency</span>
          </div>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'achievements'
              ? 'bg-[#14532D] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>My Achievements</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'bg-[#14532D] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Community Leaderboard</span>
        </button>

        <button
          onClick={() => setActiveTab('districts')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'districts'
              ? 'bg-[#14532D] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>District Rankings</span>
        </button>

        <button
          onClick={() => setActiveTab('passport')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'passport'
              ? 'bg-[#14532D] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Green Impact Passport</span>
        </button>
      </div>

      {/* 3. SUB-TAB 1: ACHIEVEMENTS & BADGES */}
      {activeTab === 'achievements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BADGE_DEFINITIONS.map((badge) => (
              <div
                key={badge.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  badge.unlocked
                    ? 'bg-white border-emerald-200 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200/60 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{badge.icon}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        badge.unlocked
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {badge.unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{badge.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {badge.description}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{badge.category}</span>
                  {badge.unlocked ? (
                    <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SUB-TAB 2: COMMUNITY LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Note on Leaderboard Data:</strong> Cohort entries below represent simulated benchmark community profiles to demonstrate Gujarat regional engagement for the Mission LiFE Hackathon. Your rank (#12) is computed against these benchmarks.
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Gujarat Household Champions</h3>
                <p className="text-xs text-slate-500">Live Mission LiFE rankings across all 33 districts</p>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                Your Rank: #12
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {topChampions.map((champ: any, index: number) => (
                <div
                  key={index}
                  className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                        champ.rank === 1
                          ? 'bg-amber-100 text-amber-800'
                          : champ.rank === 2
                          ? 'bg-slate-200 text-slate-700'
                          : champ.rank === 3
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {champ.rank}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {champ.name}
                        </span>
                        {champ.solarUser && (
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/70 px-1.5 py-0.2 rounded">
                            Solar
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">{champ.district}, Gujarat</span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-4">
                    <div className="hidden sm:block">
                      <div className="text-xs font-bold text-slate-700">{champ.streakDays} Days</div>
                      <span className="text-[10px] text-slate-400">Streak</span>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black text-[#14532D]">
                        {champ.greenScore} / 100
                      </div>
                      <span className="text-[10px] text-slate-400">{champ.missionsCompleted} Missions</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* User Entry */}
              <div className="p-4 bg-emerald-50/70 border-t-2 border-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <span className="w-7 h-7 rounded-full bg-[#14532D] text-white flex items-center justify-center text-xs font-black">
                    12
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {profile.name} (You)
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-lime-200/80 px-1.5 py-0.2 rounded">
                        Active User
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-600">{profile.district}, Gujarat</span>
                  </div>
                </div>

                <div className="text-right flex items-center gap-4">
                  <div className="hidden sm:block">
                    <div className="text-xs font-bold text-slate-700">{streakDays} Days</div>
                    <span className="text-[10px] text-slate-500">Streak</span>
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-[#14532D]">
                      {effectiveGreenScore} / 100
                    </div>
                    <span className="text-[10px] text-slate-500">{totalMissions} Missions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 3: DISTRICT IMPACT */}
      {activeTab === 'districts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">33-District Sustainability Engagement</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cumulative clean energy adoption and Western Grid fossil offset under Mission LiFE.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {districtStats.map((d: any, idx: number) => {
                const isUserDistrict = d.district.toLowerCase() === profile.district.toLowerCase();
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      isUserDistrict
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                        : 'bg-slate-50/60 border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{d.district}</h4>
                      {isUserDistrict && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/70 px-1.5 py-0.2 rounded">
                          Your District
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200/60 text-xs">
                      <div>
                        <div className="font-extrabold text-slate-800">{d.households.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-slate-500">Citizens</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-[#059669]">{d.mwhSaved} MWh</div>
                        <div className="text-[10px] text-slate-500">Saved</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-[#14532D]">{d.avgScore}</div>
                        <div className="text-[10px] text-slate-500">Avg Score</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 4: GREEN IMPACT PASSPORT */}
      {activeTab === 'passport' && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Prototype Digital Credential:</strong> This Green Impact Passport is a digital demonstration model designed for the GEDA Mission LiFE Hackathon. It is not an officially issued government certificate.
            </span>
          </div>

          <div className="bg-white rounded-2xl border-2 border-emerald-300/80 p-6 sm:p-8 shadow-md relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#14532D] text-white flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-[#A3E635]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
                    Prototype Digital Sustainability Credential
                  </div>
                  <h2 className="text-xl font-black text-slate-900 font-heading">
                    Green Impact Passport
                  </h2>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">Credential ID</span>
                <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                  {passportId}
                </span>
              </div>
            </div>

            {/* Passport Body */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-6">
              <div className="sm:col-span-8 space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Citizen Name</span>
                  <div className="text-lg font-bold text-slate-900">{profile.name}</div>
                  <span className="text-xs text-slate-500">{profile.district}, Gujarat, India</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Green Score</span>
                    <div className="text-base font-black text-[#14532D]">{effectiveGreenScore} / 100</div>
                    <span className="text-[10px] text-emerald-700 font-medium">{baselineMetrics.tier.name}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">CO₂ Averted</span>
                    <div className="text-base font-black text-slate-800">{totalCo2SavedKg} kg</div>
                    <span className="text-[10px] text-slate-500">~{baselineMetrics.treeOffsetEquivalent} Trees</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Bill Savings</span>
                    <div className="text-base font-black text-[#059669]">₹{totalInrSaved}</div>
                    <span className="text-[10px] text-slate-500">Cumulative</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed pt-2">
                  This credential logs verified sustainable micro-actions under Mission LiFE standards, offsetting fossil-fuel generation drawn from the Western Regional Grid.
                </p>
              </div>

              {/* QR & Verification */}
              <div className="sm:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                <div className="w-24 h-24 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-center">
                  <QrCode className="w-20 h-20 text-slate-800" />
                </div>
                <span className="text-[10px] text-slate-400 mt-2 font-mono">GEDA-VERIFY-PASS</span>
                <span className="text-[11px] font-semibold text-emerald-800 mt-0.5">
                  Verified Active Household
                </span>
              </div>
            </div>

            {/* Passport Footer Actions */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                Issued for GEDA Mission LiFE Hackathon Demonstration
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCredential}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied Link!' : 'Share Credential'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#14532D] hover:bg-[#0f4022] text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Passport</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
