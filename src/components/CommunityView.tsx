import React, { useState } from 'react';
import {
  Trophy,
  Flame,
  MapPin,
  CheckCircle2,
  TreeDeciduous,
  Zap,
  Info,
  TrendingUp,
  Award,
} from 'lucide-react';
import { AppState, calculateUserAggregates } from '../utils/storage';
import { MISSIONS_LIST } from '../data/missionsData';

interface CommunityViewProps {
  appState: AppState;
}

const GUJARAT_DISTRICT_REFERENCE = [
  {
    district: 'Ahmedabad',
    discom: 'Torrent Power / UGVCL',
    solarInsolationPsh: '5.3 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    surplusFeedInRate: '₹2.25/kWh',
  },
  {
    district: 'Gandhinagar',
    discom: 'UGVCL / Torrent Power',
    solarInsolationPsh: '5.35 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    surplusFeedInRate: '₹2.25/kWh',
  },
  {
    district: 'Surat',
    discom: 'DGVCL / Torrent Power',
    solarInsolationPsh: '5.15 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    surplusFeedInRate: '₹2.25/kWh',
  },
  {
    district: 'Vadodara',
    discom: 'MGVCL',
    solarInsolationPsh: '5.2 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    surplusFeedInRate: '₹2.25/kWh',
  },
  {
    district: 'Rajkot',
    discom: 'PGVCL',
    solarInsolationPsh: '5.4 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    surplusFeedInRate: '₹2.25/kWh',
  },
  {
    district: 'Bhavnagar',
    discom: 'PGVCL',
    solarInsolationPsh: '5.35 PSH/day',
    ceaFactor: '0.675 kg CO₂/kWh',
    surplusFeedInRate: '₹2.25/kWh',
  },
];

const HOUSEHOLD_CHALLENGES = [
  {
    id: 'summer-24c-drive',
    title: 'Gujarat 24°C Peak-Hour AC Habit',
    description: 'Run air conditioning at or above 24°C during afternoon peak hours (1 PM – 4 PM) for 7 consecutive days.',
    targetGoal: 'Save ~6% compressor electricity per 1°C increase',
    rewardBadge: 'AC 24°C Maestro',
  },
  {
    id: 'saurashtra-solar-surge',
    title: 'Rooftop Solar Feasibility Assessment',
    description: 'Evaluate shadow-free terrace area and review PM Surya Ghar Central Financial Assistance eligibility.',
    targetGoal: 'Up to ₹78,000 CFA for 3 kW+ residential systems',
    rewardBadge: 'Surya Mitra',
  },
  {
    id: 'phantom-zero-weekend',
    title: 'Zero Vampire Standby Power Sweep',
    description: 'Switch off wall sockets for idle TVs, set-top boxes, and chargers before bedtime.',
    targetGoal: 'Eliminate ~5–8% passive standby electricity draw',
    rewardBadge: 'Vampire Load Slayer',
  },
];

export const CommunityView: React.FC<CommunityViewProps> = ({ appState }) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'districts' | 'challenges'>('leaderboard');
  const [joinedChallenges, setJoinedChallenges] = useState<Record<string, boolean>>({
    'summer-24c-drive': true,
  });

  const aggregates = calculateUserAggregates(appState);
  const { profile, streakDays, completedMissions } = appState;
  const completedLogs = Object.values(completedMissions || {});

  const handleJoinChallenge = (id: string) => {
    setJoinedChallenges((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>Gujarat Mission LiFE Household Ledger</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Household Impact &amp; Regional Solar Benchmarks
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Review your recorded household mission completions alongside official Gujarat solar irradiance and grid emission benchmarks.
            </p>
          </div>

          {/* User's household summary card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 self-start md:self-auto shrink-0 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#14532D] flex items-center justify-center font-bold text-lg text-[#A3E635] font-heading">
              {aggregates.effectiveGreenScore}
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Household Green Score
              </div>
              <div className="text-sm font-bold text-slate-900">{profile.name || 'Active Household'}</div>
              <div className="text-xs text-[#059669] font-semibold">
                {aggregates.totalPoints} Pts{profile.district ? ` · ${profile.district}` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actual Recorded Household Metrics (No Fabricated Statewide Totals) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold mb-1">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Missions Completed</span>
          </div>
          <div className="text-2xl font-bold font-heading text-emerald-950">
            {aggregates.totalMissions}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">Recorded in ledger</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold mb-1">
            <Zap className="w-4 h-4 text-teal-600" />
            <span>LiFE Points Earned</span>
          </div>
          <div className="text-2xl font-bold font-heading text-gray-900">
            {aggregates.totalPoints}
          </div>
          <p className="text-[11px] text-teal-700 font-medium mt-1">{streakDays}d active streak</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold mb-1">
            <TreeDeciduous className="w-4 h-4 text-emerald-600" />
            <span>Recorded CO₂ Offset</span>
          </div>
          <div className="text-2xl font-bold font-heading text-emerald-800">
            {aggregates.totalCo2SavedKg}{' '}
            <span className="text-xs font-normal text-gray-400">kg</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">
            CEA 0.675 kg CO₂/kWh basis
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold mb-1">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span>Estimated Bill Offset</span>
          </div>
          <div className="text-2xl font-bold font-heading text-amber-800">
            ₹{aggregates.totalInrSaved}
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">From completed missions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 ${
            activeTab === 'leaderboard'
              ? 'text-emerald-700 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Trophy className="w-4 h-4 text-emerald-600" />
          Recorded Household Ledger
        </button>
        <button
          onClick={() => setActiveTab('districts')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 ${
            activeTab === 'districts'
              ? 'text-emerald-700 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <MapPin className="w-4 h-4 text-emerald-600" />
          District Solar Reference
        </button>
        <button
          onClick={() => setActiveTab('challenges')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 ${
            activeTab === 'challenges'
              ? 'text-emerald-700 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Flame className="w-4 h-4 text-emerald-600" />
          Habit Challenges
        </button>
      </div>

      {/* Explicit Data Integrity Notice */}
      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-950">
        <Info className="w-4 h-4 text-emerald-700 shrink-0" />
        <span>
          <strong>Data Transparency:</strong> Only your authentic household profile and completed missions are displayed below. No fabricated user profiles, rankings, or simulated environmental savings are shown.
        </span>
      </div>

      {/* TAB 1: RECORDED HOUSEHOLD LEDGER */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-emerald-50/60 text-emerald-950 border-b border-emerald-100 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Household</th>
                  <th className="py-3 px-4">District</th>
                  <th className="py-3 px-4">Green Score</th>
                  <th className="py-3 px-4">Missions</th>
                  <th className="py-3 px-4">Solar Status</th>
                  <th className="py-3 px-4">Active Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                <tr className="bg-emerald-50/50 font-bold text-emerald-950">
                  <td className="py-3.5 px-4">{profile.name || 'Active Household'}</td>
                  <td className="py-3.5 px-4">{profile.district || 'Gujarat'}</td>
                  <td className="py-3.5 px-4 text-emerald-700 font-bold text-sm">
                    {aggregates.effectiveGreenScore}/100
                  </td>
                  <td className="py-3.5 px-4">{aggregates.totalMissions} Done</td>
                  <td className="py-3.5 px-4">
                    {profile.hasSolarInstalled ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Installed
                      </span>
                    ) : (
                      <span className="text-gray-500">Not Installed</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-amber-600 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 fill-amber-500" />
                    {streakDays} Days
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {completedLogs.length > 0 && (
            <div className="p-4 border-t border-gray-100 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Completed Mission Log
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {completedLogs.map((log) => {
                  const found = MISSIONS_LIST.find((m) => m.id === log.missionId);
                  return (
                    <div
                      key={log.completionKey}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">
                          {found ? found.title : log.missionId}
                        </span>
                        <span className="text-[10px] text-slate-500">{log.completionDate}</span>
                      </div>
                      <span className="font-bold text-emerald-800">+{log.points} pts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DISTRICT SOLAR REFERENCE */}
      {activeTab === 'districts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GUJARAT_DISTRICT_REFERENCE.map((dist) => {
            const isUserDist =
              Boolean(profile.district) &&
              dist.district.toLowerCase() === profile.district.toLowerCase();
            return (
              <div
                key={dist.district}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isUserDist
                    ? 'bg-emerald-50/80 border-emerald-400 shadow-sm ring-1 ring-emerald-400'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">{dist.discom}</span>
                    {isUserDist && (
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        Your District
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-gray-900 font-heading">
                    {dist.district}
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100 text-center">
                  <div>
                    <p className="text-[10px] text-gray-400">Insolation</p>
                    <p className="text-xs font-bold text-emerald-800 mt-0.5">{dist.solarInsolationPsh}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">CEA Factor</p>
                    <p className="text-xs font-bold text-teal-800 mt-0.5">{dist.ceaFactor}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Export Rate</p>
                    <p className="text-xs font-bold text-emerald-700 mt-0.5">{dist.surplusFeedInRate}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: HABIT CHALLENGES */}
      {activeTab === 'challenges' && (
        <div className="space-y-4">
          {HOUSEHOLD_CHALLENGES.map((ch) => {
            const isJoined = !!joinedChallenges[ch.id];
            return (
              <div
                key={ch.id}
                className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Badge: {ch.rewardBadge}
                    </span>
                  </div>
                  <h4 className="font-bold text-base text-gray-900 font-heading">{ch.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{ch.description}</p>
                  <p className="text-[11px] text-emerald-800 font-semibold pt-1">
                    Engineering Benchmark: {ch.targetGoal}
                  </p>
                </div>

                <button
                  onClick={() => handleJoinChallenge(ch.id)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    isJoined
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  {isJoined ? '✓ Challenge Active' : 'Start Habit Challenge'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
