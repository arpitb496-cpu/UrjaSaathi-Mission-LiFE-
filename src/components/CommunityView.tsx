import React, { useState, useEffect } from 'react';
import {
  Users,
  Trophy,
  Award,
  Flame,
  ShieldCheck,
  TrendingUp,
  MapPin,
  CheckCircle2,
  TreeDeciduous,
  Zap,
  Info,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { AppState, calculateUserAggregates } from '../utils/storage';

interface CommunityViewProps {
  appState: AppState;
}

export const CommunityView: React.FC<CommunityViewProps> = ({ appState }) => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'districts' | 'challenges'>('leaderboard');
  const [joinedChallenges, setJoinedChallenges] = useState<Record<string, boolean>>({
    'summer-24c-drive': true,
  });
  const [communityData, setCommunityData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const aggregates = calculateUserAggregates(appState);
  const { profile, streakDays } = appState;

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

  const handleJoinChallenge = (id: string) => {
    setJoinedChallenges((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const totals = communityData?.aggregateTotals || {
    totalHouseholdsJoined: 247600,
    totalMwhSaved: 6850,
    totalCo2AvertedTonnes: 5617,
    totalRupeesSavedLakhs: 428,
    equivalentTreesPlanted: 280850,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/30 text-xs font-semibold text-lime-300">
              <Users className="w-4 h-4" />
              <span>Gujarat Mission LiFE Citizen Community</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading">
              Statewide Green Movement & District Rankings
            </h1>
            <p className="text-sm text-emerald-100/90 leading-relaxed">
              Join thousands of households across Gujarat making collective, daily micro-commitments
              to decarbonise our power grid and protect the environment.
            </p>
          </div>

          {/* User's position card */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 self-start md:self-auto shrink-0 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-lg text-lime-300 font-heading">
              #12
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-emerald-200 uppercase tracking-wider font-semibold">
                Your Gujarat Rank
              </div>
              <div className="text-sm font-bold text-white">{profile.name}</div>
              <div className="text-xs text-lime-300 font-medium">
                {aggregates.effectiveGreenScore} Pts • {profile.district}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate State Impact Numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold mb-1">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Households Joined</span>
          </div>
          <div className="text-2xl font-bold font-heading text-emerald-950">
            {totals.totalHouseholdsJoined.toLocaleString('en-IN')}+
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">Across 33 Districts</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold mb-1">
            <Zap className="w-4 h-4 text-teal-600" />
            <span>Clean Energy Saved</span>
          </div>
          <div className="text-2xl font-bold font-heading text-gray-900">
            {totals.totalMwhSaved.toLocaleString('en-IN')}{' '}
            <span className="text-xs font-normal text-gray-400">MWh</span>
          </div>
          <p className="text-[11px] text-teal-700 font-medium mt-1">Grid load reduced</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold mb-1">
            <TreeDeciduous className="w-4 h-4 text-emerald-600" />
            <span>CO2 Emissions Averted</span>
          </div>
          <div className="text-2xl font-bold font-heading text-emerald-800">
            {totals.totalCo2AvertedTonnes.toLocaleString('en-IN')}{' '}
            <span className="text-xs font-normal text-gray-400">Tonnes</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">
            ≈ {totals.equivalentTreesPlanted.toLocaleString('en-IN')} Trees
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold mb-1">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span>Citizen Electricity Savings</span>
          </div>
          <div className="text-2xl font-bold font-heading text-amber-800">
            ₹{totals.totalRupeesSavedLakhs}{' '}
            <span className="text-xs font-normal text-gray-400">Lakhs</span>
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">Returned to citizen pockets</p>
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
          Gujarat Green Champions
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
          District Rankings
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
          Community Challenges
        </button>
      </div>

      {/* Explicit Data Notice */}
      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          <strong>Hackathon Transparency Note:</strong> Demonstrative figures are benchmarked
          against GEDA residential surveys across Gujarat. Your active household profile is
          integrated into live calculations above.
        </span>
      </div>

      {/* TAB 1: LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-emerald-50/60 text-emerald-950 border-b border-emerald-100 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Citizen / Household</th>
                  <th className="py-3 px-4">Data Type</th>
                  <th className="py-3 px-4">District</th>
                  <th className="py-3 px-4">Green Score</th>
                  <th className="py-3 px-4">Missions</th>
                  <th className="py-3 px-4">Solar Installed</th>
                  <th className="py-3 px-4">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {/* Highlight Current User Row */}
                <tr className="bg-emerald-100/60 font-bold text-emerald-950 border-y-2 border-emerald-400">
                  <td className="py-3.5 px-4 flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                      #12
                    </span>
                    <span className="text-[10px] bg-emerald-700 text-white px-1.5 py-0.5 rounded font-bold">
                      YOU
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{profile.name} (Your Household)</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                      ● Real User (Active)
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{profile.district}</td>
                  <td className="py-3.5 px-4 text-emerald-700 font-bold text-sm">
                    {aggregates.effectiveGreenScore}/100
                  </td>
                  <td className="py-3.5 px-4">{aggregates.totalMissions} Done</td>
                  <td className="py-3.5 px-4">
                    {profile.hasSolarInstalled ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-gray-400">In Planning</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-amber-600 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 fill-amber-500" />
                    {streakDays} Days
                  </td>
                </tr>

                {/* Champion Demonstration Rows */}
                {(communityData?.topChampions || []).map((champ: any) => (
                  <tr key={champ.rank} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                          champ.rank === 1
                            ? 'bg-amber-400 text-amber-950'
                            : champ.rank === 2
                            ? 'bg-slate-300 text-slate-800'
                            : champ.rank === 3
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {champ.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{champ.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        Simulated Demo Data
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{champ.district}</td>
                    <td className="py-3 px-4 text-emerald-700 font-bold">{champ.greenScore}/100</td>
                    <td className="py-3 px-4 text-gray-700">{champ.missionsCompleted} Done</td>
                    <td className="py-3 px-4">
                      {champ.solarUser ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-amber-600 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-amber-500" />
                      {champ.streakDays} Days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DISTRICT RANKINGS */}
      {activeTab === 'districts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(communityData?.districtStats || []).map((dist: any, idx: number) => {
            const isUserDist = dist.district === profile.district;
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
                    <span className="text-xs font-bold text-gray-400">#{idx + 1} District</span>
                    {isUserDist && (
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        Your District
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-gray-900 font-heading">
                    {dist.district}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {dist.households.toLocaleString('en-IN')} Active LiFE Households
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100 text-center">
                  <div>
                    <p className="text-[10px] text-gray-400">MWh Saved</p>
                    <p className="text-xs font-bold text-emerald-800 mt-0.5">{dist.mwhSaved}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">CO2 Averted</p>
                    <p className="text-xs font-bold text-teal-800 mt-0.5">{dist.co2ReducedTonnes}t</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Avg Score</p>
                    <p className="text-xs font-bold text-emerald-700 mt-0.5">{dist.avgScore}/100</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: COMMUNITY CHALLENGES */}
      {activeTab === 'challenges' && (
        <div className="space-y-4">
          {(communityData?.activeChallenges || []).map((ch: any) => {
            const isJoined = !!joinedChallenges[ch.id];
            return (
              <div
                key={ch.id}
                className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Reward: {ch.rewardBadge}
                    </span>
                    <span className="text-xs text-gray-400">• {ch.daysRemaining} days left</span>
                  </div>
                  <h4 className="font-bold text-base text-gray-900 font-heading">{ch.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{ch.description}</p>
                  <p className="text-[11px] text-emerald-800 font-semibold pt-1">
                    Target: {ch.targetGoal} ({ch.participants.toLocaleString('en-IN')} citizens participating)
                  </p>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-gradient-to-r from-emerald-600 to-teal-500 h-full rounded-full transition-all"
                      style={{ width: `${ch.progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 pt-0.5">
                    <span>{ch.progressPct}% Goal Achieved</span>
                    <span>100% Target</span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinChallenge(ch.id)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    isJoined
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  {isJoined ? '✓ Challenge Joined' : 'Join Community Drive'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
