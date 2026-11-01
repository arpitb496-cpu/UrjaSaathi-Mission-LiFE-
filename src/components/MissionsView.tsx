import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Circle,
  Flame,
  Award,
  Zap,
  Filter,
  TrendingDown,
  Sparkles,
  DollarSign,
  Sun,
  Wind,
  PowerOff,
  SunMedium,
  SunDim,
  Clock,
  Droplets,
  Utensils,
  Lightbulb,
  Fan,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { MISSIONS_LIST, Mission } from '../data/missionsData';
import { AppState, CompletedMissionLog, calculateUserAggregates } from '../utils/storage';

interface MissionsViewProps {
  appState: AppState;
  onToggleMission: (mission: Mission) => void;
}

export const MissionsView: React.FC<MissionsViewProps> = ({ appState, onToggleMission }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const aggregates = calculateUserAggregates(appState);
  const completedMissions = appState.completedMissions;

  const categories = ['All', 'Cooling', 'Lighting', 'Appliances', 'Solar', 'Habits', 'Peak Management'];

  const filteredMissions = MISSIONS_LIST.filter((mission) => {
    const matchesCategory = selectedCategory === 'All' || mission.category === selectedCategory;
    const matchesSearch =
      mission.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mission.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleMissionClick = (mission: Mission) => {
    const isCurrentlyDone = !!completedMissions[mission.id];
    onToggleMission(mission);

    if (!isCurrentlyDone) {
      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 },
          colors: ['#059669', '#10b981', '#34d399', '#f59e0b', '#fbbf24'],
        });
      } catch (e) {
        // ignore confetti errors in headless
      }

      setToastMessage(`🎉 Completed "${mission.title}"! +${mission.points} LiFE points credited.`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const getMissionIcon = (iconName: string) => {
    switch (iconName) {
      case 'Wind':
        return <Wind className="w-5 h-5 text-teal-600" />;
      case 'PowerOff':
        return <PowerOff className="w-5 h-5 text-rose-600" />;
      case 'Sun':
        return <Sun className="w-5 h-5 text-amber-500" />;
      case 'SunMedium':
        return <SunMedium className="w-5 h-5 text-orange-500" />;
      case 'SunDim':
        return <SunDim className="w-5 h-5 text-yellow-500" />;
      case 'Lightbulb':
        return <Lightbulb className="w-5 h-5 text-amber-500" />;
      case 'Clock':
        return <Clock className="w-5 h-5 text-indigo-600" />;
      case 'Droplets':
        return <Droplets className="w-5 h-5 text-blue-600" />;
      case 'Utensils':
        return <Utensils className="w-5 h-5 text-emerald-600" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-lime-600" />;
      case 'Users':
        return <Users className="w-5 h-5 text-emerald-600" />;
      default:
        return <Zap className="w-5 h-5 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/30 text-xs font-semibold text-lime-300">
              <ShieldCheck className="w-4 h-4" />
              <span>GEDA Mission LiFE • 14 Certified Citizen Challenges</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading">
              Daily Green Missions & Streak Tracker
            </h1>
            <p className="text-sm text-emerald-100/90 leading-relaxed">
              Complete simple everyday micro-actions to cut your electric load, accumulate verified
              Mission LiFE points, and climb the Gujarat green leaderboard.
            </p>
          </div>

          {/* User Score & Streak Summary */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 self-start md:self-auto shrink-0">
            <div className="text-center px-2 border-r border-white/20">
              <div className="flex items-center justify-center gap-1 text-amber-400 font-bold text-xl font-heading">
                <Flame className="w-5 h-5 fill-amber-400 text-amber-400" />
                {appState.streakDays}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold">
                Day Streak
              </div>
            </div>
            <div className="text-center px-2">
              <div className="text-xl font-bold font-heading text-lime-300">
                {aggregates.totalPoints}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold">
                LiFE Points
              </div>
            </div>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
          {toastMessage}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search missions..."
            className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Missions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMissions.map((mission) => {
          const isDone = !!completedMissions[mission.id];
          return (
            <div
              key={mission.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                isDone
                  ? 'bg-emerald-50/60 border-emerald-300 shadow-xs'
                  : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-md'
              }`}
            >
              <div>
                {/* Mission Top Metadata */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                      {getMissionIcon(mission.iconName)}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                        {mission.category}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium ml-1.5 hidden sm:inline">
                        • {mission.lifePillar}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        mission.difficulty === 'Easy'
                          ? 'bg-blue-50 text-blue-700'
                          : mission.difficulty === 'Medium'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {mission.difficulty}
                    </span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      +{mission.points} pts
                    </span>
                  </div>
                </div>

                <h3
                  className={`font-bold text-base font-heading ${
                    isDone ? 'text-emerald-950 font-bold' : 'text-gray-900'
                  }`}
                >
                  {mission.title}
                </h3>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                  {mission.description}
                </p>

                <div className="mt-3 p-2.5 rounded-lg bg-gray-50/80 border border-gray-100 text-[11px] text-gray-600">
                  <strong className="text-emerald-800">💡 Science behind this:</strong> {mission.actionTip}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {mission.co2SavedKg} kg CO2
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-gray-700 font-semibold">
                    ₹{mission.inrSaved} saved
                  </span>
                </div>

                <button
                  onClick={() => handleMissionClick(mission)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    isDone
                      ? 'bg-emerald-700 text-white ring-2 ring-emerald-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isDone ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-lime-300" />
                      Completed
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4" />
                      Mark as Done
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
