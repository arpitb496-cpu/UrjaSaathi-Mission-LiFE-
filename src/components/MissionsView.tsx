import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Circle,
  Flame,
  Award,
  Zap,
  TrendingDown,
  Sparkles,
  Sun,
  Wind,
  PowerOff,
  SunMedium,
  SunDim,
  Clock,
  Droplets,
  Utensils,
  Lightbulb,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { MISSIONS_LIST, Mission } from '../data/missionsData';
import { AppState, calculateUserAggregates } from '../utils/storage';

interface MissionsViewProps {
  appState: AppState;
  onToggleMission: (mission: Mission) => void;
}

export const MissionsView: React.FC<MissionsViewProps> = ({ appState, onToggleMission }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAllMissions, setShowAllMissions] = useState<boolean>(false);

  const aggregates = calculateUserAggregates(appState);
  const completedMissions = appState.completedMissions;
  const completedCount = Object.keys(completedMissions).length;
  const totalMissionsCount = MISSIONS_LIST.length;

  const categories = ['All', 'Cooling', 'Lighting', 'Appliances', 'Solar', 'Habits', 'Peak Management'];

  // Top featured mission for today
  const incompleteMissions = MISSIONS_LIST.filter((m) => !completedMissions[m.id]);
  const featuredMission = incompleteMissions.length > 0 ? incompleteMissions[0] : MISSIONS_LIST[0];
  const isFeaturedDone = !!completedMissions[featuredMission.id];

  const filteredMissions = MISSIONS_LIST.filter((mission) => {
    const matchesCategory = selectedCategory === 'All' || mission.category === selectedCategory;
    const matchesSearch =
      mission.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mission.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Limit display if All is selected and toggle is not expanded
  const displayedMissions =
    selectedCategory === 'All' && !searchQuery.trim() && !showAllMissions
      ? filteredMissions.slice(0, 6)
      : filteredMissions;

  const handleMissionClick = (mission: Mission) => {
    const isCurrentlyDone = !!completedMissions[mission.id];
    onToggleMission(mission);

    if (!isCurrentlyDone) {
      try {
        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#14532D', '#059669', '#A3E635', '#34D399'],
        });
      } catch {
        // ignore in headless
      }

      setToastMessage(`🎉 Completed "${mission.title}"! +${mission.points} LiFE points credited.`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const getMissionIcon = (iconName: string) => {
    switch (iconName) {
      case 'Wind':
        return <Wind className="w-4 h-4 text-emerald-700" />;
      case 'PowerOff':
        return <PowerOff className="w-4 h-4 text-rose-600" />;
      case 'Sun':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'SunMedium':
        return <SunMedium className="w-4 h-4 text-amber-600" />;
      case 'SunDim':
        return <SunDim className="w-4 h-4 text-yellow-500" />;
      case 'Lightbulb':
        return <Lightbulb className="w-4 h-4 text-amber-500" />;
      case 'Clock':
        return <Clock className="w-4 h-4 text-indigo-600" />;
      case 'Droplets':
        return <Droplets className="w-4 h-4 text-blue-600" />;
      case 'Utensils':
        return <Utensils className="w-4 h-4 text-emerald-700" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-emerald-600" />;
      default:
        return <Zap className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#14532D] text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-600/50 flex items-center gap-2.5 text-xs font-semibold animate-fade-in">
          <Sparkles className="w-4 h-4 text-[#A3E635]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner with Streak and Points */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#059669]">
            <span className="w-2 h-2 rounded-full bg-[#059669]" />
            <span>GEDA Mission LiFE • Verified Household Actions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
            Daily Green Missions
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Simple everyday actions designed for Gujarat households. Complete challenges to earn LiFE points, maintain your streak, and cut your electricity bill.
          </p>
        </div>

        {/* User Score & Streak Summary */}
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 shrink-0">
          <div className="text-center px-3 border-r border-slate-200">
            <div className="flex items-center justify-center gap-1 text-amber-600 font-bold text-xl font-heading">
              <Flame className="w-5 h-5 fill-amber-500 text-amber-600" />
              {appState.streakDays}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Day Streak
            </div>
          </div>

          <div className="text-center px-3 border-r border-slate-200">
            <div className="text-xl font-bold font-heading text-[#14532D]">
              {aggregates.totalPoints}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              LiFE Points
            </div>
          </div>

          <div className="text-center px-3">
            <div className="text-xl font-bold font-heading text-emerald-700">
              {completedCount}/{totalMissionsCount}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Completed
            </div>
          </div>
        </div>
      </div>

      {/* Featured Mission of the Day Callout */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#A3E635] text-emerald-950 px-2 py-0.5 rounded">
              Today&apos;s Priority
            </span>
            <span className="text-xs text-emerald-200 font-medium">+{featuredMission.points} Points</span>
          </div>
          <h3 className="text-lg font-bold text-white font-heading">{featuredMission.title}</h3>
          <p className="text-xs text-emerald-100/90 leading-relaxed">{featuredMission.description}</p>
          <div className="flex items-center gap-3 text-[11px] text-emerald-200 pt-1">
            <span>Saves ~{featuredMission.co2SavedKg} kg CO₂</span>
            <span>•</span>
            <span>Cuts ~₹{featuredMission.inrSaved} on electric bill</span>
          </div>
        </div>

        <button
          onClick={() => handleMissionClick(featuredMission)}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0 ${
            isFeaturedDone
              ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/50'
              : 'bg-[#A3E635] hover:bg-lime-300 text-emerald-950 shadow-xs'
          }`}
        >
          {isFeaturedDone ? (
            <>
              <Check className="w-4 h-4 text-[#A3E635]" />
              <span>Completed Today</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-950" />
              <span>Complete Today</span>
            </>
          )}
        </button>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#14532D] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search missions..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
          />
        </div>
      </div>

      {/* Missions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedMissions.map((mission) => {
          const isDone = !!completedMissions[mission.id];
          return (
            <div
              key={mission.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                isDone
                  ? 'bg-emerald-50/40 border-emerald-200/90 shadow-xs'
                  : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center">
                      {getMissionIcon(mission.iconName)}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {mission.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium ml-1.5 hidden sm:inline">
                        • {mission.lifePillar}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-500">
                      {mission.difficulty}
                    </span>
                    <span className="text-xs font-bold text-[#14532D] bg-lime-100 px-2 py-0.5 rounded-md">
                      +{mission.points} pts
                    </span>
                  </div>
                </div>

                <h3
                  className={`font-bold text-sm sm:text-base font-heading ${
                    isDone ? 'text-[#14532D]' : 'text-slate-900'
                  }`}
                >
                  {mission.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {mission.description}
                </p>

                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                  <strong className="text-emerald-800">💡 Science note:</strong> {mission.actionTip}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1 text-[#059669] font-semibold">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {mission.co2SavedKg} kg CO₂
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-700 font-semibold">
                    ₹{mission.inrSaved} saved
                  </span>
                </div>

                <button
                  onClick={() => handleMissionClick(mission)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    isDone
                      ? 'bg-[#14532D] text-white'
                      : 'bg-[#059669] hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isDone ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#A3E635]" />
                      <span>Completed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-3.5 h-3.5" />
                      <span>Mark Done</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progressive Disclosure Toggle */}
      {selectedCategory === 'All' && !searchQuery.trim() && filteredMissions.length > 6 && (
        <div className="text-center pt-2">
          <button
            onClick={() => setShowAllMissions(!showAllMissions)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-[#14532D] hover:border-emerald-300 transition-all shadow-xs"
          >
            <span>{showAllMissions ? 'Show Fewer Missions' : `Show All 14 Missions (${filteredMissions.length})`}</span>
            {showAllMissions ? <ChevronUp className="w-4 h-4 text-[#059669]" /> : <ChevronDown className="w-4 h-4 text-[#059669]" />}
          </button>
        </div>
      )}
    </div>
  );
};
