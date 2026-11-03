import React, { useState } from 'react';
import {
  Award,
  Trophy,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Download,
  Flame,
  Lock,
  Info,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { AppState, calculateUserAggregates, hasEverCompletedMission } from '../utils/storage';
import { MISSIONS_LIST } from '../data/missionsData';
import { PassportView } from './PassportView';
import {
  generateImpactReportPdf,
  triggerBrowserPdfDownload,
  IMPACT_REPORT_FILENAME,
  PROTOTYPE_PASSPORT_DISCLAIMER,
} from '../utils/pdfGenerator';

interface ImpactViewProps {
  appState: AppState;
  accessToken?: string | null;
  initialSubTab?: 'achievements' | 'leaderboard' | 'districts' | 'passport';
  onOpenVerificationToken?: (token: string) => void;
}

const GUJARAT_DISTRICT_BENCHMARKS = [
  {
    district: 'Ahmedabad',
    discom: 'Torrent Power / UGVCL',
    solarInsolationPsh: '5.3 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    maxSubsidyInr: '₹78,000 (3 kW+)',
  },
  {
    district: 'Gandhinagar',
    discom: 'UGVCL / Torrent Power',
    solarInsolationPsh: '5.35 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    maxSubsidyInr: '₹78,000 (3 kW+)',
  },
  {
    district: 'Surat',
    discom: 'DGVCL / Torrent Power',
    solarInsolationPsh: '5.15 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    maxSubsidyInr: '₹78,000 (3 kW+)',
  },
  {
    district: 'Vadodara',
    discom: 'MGVCL',
    solarInsolationPsh: '5.2 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    maxSubsidyInr: '₹78,000 (3 kW+)',
  },
  {
    district: 'Rajkot',
    discom: 'PGVCL',
    solarInsolationPsh: '5.4 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    maxSubsidyInr: '₹78,000 (3 kW+)',
  },
  {
    district: 'Bhavnagar',
    discom: 'PGVCL',
    solarInsolationPsh: '5.35 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    maxSubsidyInr: '₹78,000 (3 kW+)',
  },
];

export const ImpactView: React.FC<ImpactViewProps> = ({
  appState,
  accessToken,
  initialSubTab = 'achievements',
  onOpenVerificationToken,
}) => {
  const [activeTab, setActiveTab] = useState<'achievements' | 'leaderboard' | 'districts' | 'passport'>(
    initialSubTab
  );
  const [downloadingReport, setDownloadingReport] = useState<boolean>(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  const aggregates = calculateUserAggregates(appState);
  const { profile, streakDays, completedMissions } = appState;
  const {
    baselineMetrics,
    effectiveGreenScore,
    totalMissions,
    totalPoints,
    totalCo2SavedKg,
    totalInrSaved,
  } = aggregates;

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
      unlocked: hasEverCompletedMission(appState, 'm-ac-24'),
      category: 'Cooling',
    },
    {
      id: 'vampire_slayer',
      name: 'Vampire Load Slayer',
      description: 'Eliminated idle standby consumption across residential electronics.',
      icon: '⚡',
      unlocked: hasEverCompletedMission(appState, 'm-phantom-power'),
      category: 'Habits',
    },
    {
      id: 'solar_advocate',
      name: 'Surya Mitra (Solar Champion)',
      description: 'Evaluated rooftop solar feasibility or installed grid-tied solar.',
      icon: '☀️',
      unlocked: Boolean(profile.hasSolarInstalled || profile.rooftopAvailableSqFt >= 200),
      category: 'Solar',
    },
    {
      id: 'fan_upgrader',
      name: 'BLDC Fan Evangelist',
      description: 'Adopted BEE 5-star energy efficient ceiling fan technology.',
      icon: '🌀',
      unlocked: hasEverCompletedMission(appState, 'm-bldc-fan'),
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
      unlocked: hasEverCompletedMission(appState, 'm-bucket-bath'),
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
  const completedLogs = Object.values(completedMissions || {});

  const handleDownloadImpactReport = async () => {
    setDownloadingReport(true);
    setReportFeedback(null);
    try {
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
        monthlyProgress: [
          {
            month: 'Current Recorded Baseline',
            actualKwh: profile.monthlyKwh,
            targetKwh: (profile.familyMembers || 4) * 75,
          },
        ],
        generatedAt: new Date(),
      });

      const downloadResult = triggerBrowserPdfDownload(pdfBytes, IMPACT_REPORT_FILENAME);
      setReportFeedback(
        `Downloaded ${downloadResult.filename} (${(downloadResult.sizeBytes / 1024).toFixed(1)} KB)`
      );
    } catch (err: any) {
      setReportFeedback(err?.message || 'Could not generate Impact Report PDF.');
    } finally {
      setDownloadingReport(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Personal Impact Summary */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>My Impact &amp; Household Sustainability Ledger</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-heading mt-1">
              Sustainability Impact Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Tracking your recorded household sustainability actions, regional benchmarks, and Green Impact Passport.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-bold flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#059669]" />
              <span>{unlockedCount}/8 Badges Unlocked</span>
            </span>

            <button
              type="button"
              data-testid="download-impact-report-btn"
              onClick={handleDownloadImpactReport}
              disabled={downloadingReport}
              className="px-4 py-2 rounded-xl bg-[#14532D] hover:bg-emerald-900 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              {downloadingReport ? (
                <RefreshCw className="w-3.5 h-3.5 text-[#A3E635] animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[#A3E635]" />
              )}
              <span>{downloadingReport ? 'Generating PDF...' : 'Download Impact Report'}</span>
            </button>
          </div>
        </div>

        {reportFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between">
            <span>{reportFeedback}</span>
            <span className="font-mono text-[11px]">application/pdf</span>
          </div>
        )}

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
            <span className="text-[10px] text-slate-500">Recorded from missions</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Estimated Bill Offset</span>
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

      {/* Prototype Credential Disclaimer */}
      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-amber-900 mb-0.5">Prototype Credential Disclosure:</strong>
          <span>{PROTOTYPE_PASSPORT_DISCLAIMER}</span>
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
          <span>Household Progress Ledger</span>
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
          <span>District Solar Benchmarks</span>
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

      {/* 4. SUB-TAB 2: HOUSEHOLD PROGRESS LEDGER (Actual User Data Only - No Fabricated Profiles or Rankings) */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>Data Integrity Policy:</strong> UrjaSaathi displays only your actual recorded household missions and calculated baseline. No fabricated user profiles, rankings, or simulated environmental savings are shown.
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {profile.name || 'Active Household'} — Recorded Sustainability Standing
                </h3>
                <p className="text-xs text-slate-500">
                  {profile.district ? `${profile.district}, Gujarat` : 'Gujarat, India'} • {aggregates.totalPoints} LiFE Points Earned
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                {totalMissions} Completed Missions
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {completedLogs.length > 0 ? (
                completedLogs.map((log) => {
                  const missionObj = MISSIONS_LIST.find((m) => m.id === log.missionId);
                  return (
                    <div
                      key={log.completionKey}
                      className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                          {missionObj ? missionObj.title : log.missionId}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Completed on {log.completionDate} (Asia/Kolkata)
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-[#14532D]">+{log.points} Points</div>
                        <span className="text-[10px] text-emerald-700">
                          {log.co2SavedKg} kg CO₂ • ₹{log.inrSaved} est. offset
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">
                  No missions recorded yet. Complete a daily mission to log your household impact.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 3: DISTRICT SOLAR & GRID REFERENCE BENCHMARKS */}
      {activeTab === 'districts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">Gujarat District Solar &amp; Grid Reference Parameters</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Engineering reference parameters for regional solar irradiance, DISCOM coverage, and CEA Version 22.0 emission factors.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
              {GUJARAT_DISTRICT_BENCHMARKS.map((d, idx) => {
                const isUserDistrict =
                  Boolean(profile.district) &&
                  d.district.toLowerCase() === profile.district.toLowerCase();
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
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/70 px-1.5 py-0.5 rounded">
                          Selected District
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 space-y-1 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-500">DISCOM:</span>
                        <strong className="text-slate-800">{d.discom}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Insolation:</span>
                        <strong className="text-[#059669]">{d.solarInsolationPsh}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Grid Factor:</span>
                        <strong className="text-[#14532D]">{d.ceaFactor}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">CFA Subsidy Cap:</span>
                        <strong className="text-slate-800">{d.maxSubsidyInr}</strong>
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
        <PassportView
          appState={appState}
          accessToken={accessToken}
          onOpenVerificationToken={onOpenVerificationToken}
        />
      )}
    </div>
  );
};
