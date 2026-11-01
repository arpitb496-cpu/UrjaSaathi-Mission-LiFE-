import React from 'react';
import { Leaf, Sun, Flame, Award, RefreshCw, BookOpen, ShieldCheck } from 'lucide-react';
import { AppState, DEFAULT_PROFILE, DEMO_PROFILES, calculateUserAggregates } from '../utils/storage';

interface HeaderProps {
  appState: AppState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenOnboarding: () => void;
  onOpenDocs: () => void;
  onSelectDemoProfile: (key: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  appState,
  activeTab,
  setActiveTab,
  onOpenOnboarding,
  onOpenDocs,
  onSelectDemoProfile,
}) => {
  const aggregates = calculateUserAggregates(appState);
  const { profile, streakDays } = appState;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { id: 'missions', label: 'Daily Missions', icon: 'CheckCircle2', count: Object.keys(appState.completedMissions).length },
    { id: 'coach', label: 'AI Green Coach', icon: 'Bot' },
    { id: 'solar', label: 'Solar Calculator', icon: 'Sun' },
    { id: 'community', label: 'Community & Leaderboard', icon: 'Users' },
    { id: 'passport', label: 'Impact Passport', icon: 'Award' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-xs">
      {/* Top GEDA Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-emerald-100 text-xs py-1.5 px-4 font-medium flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <span className="inline-flex items-center gap-1 bg-emerald-700/80 text-emerald-100 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase border border-emerald-500/40">
            <ShieldCheck className="w-3 h-3 text-lime-300" /> GEDA Mission LiFE
          </span>
          <span className="hidden sm:inline text-emerald-200/90">
            Gujarat Energy Development Agency — Lifestyle for Environment Hackathon
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-emerald-200">
              District: <strong className="text-white">{profile.district || 'Gujarat'}</strong>
            </span>
            <div className="hidden md:flex items-center gap-1 text-[11px]">
              <span className="text-emerald-300/80">Sample Profiles:</span>
              <button
                onClick={() => onSelectDemoProfile('gandhinagar')}
                className="hover:text-white underline decoration-dotted text-emerald-200"
              >
                Gandhinagar
              </button>
              <span>•</span>
              <button
                onClick={() => onSelectDemoProfile('ahmedabad')}
                className="hover:text-white underline decoration-dotted text-emerald-200"
              >
                Ahmedabad
              </button>
              <span>•</span>
              <button
                onClick={() => onSelectDemoProfile('surat')}
                className="hover:text-white underline decoration-dotted text-emerald-200"
              >
                Surat (Solar)
              </button>
            </div>
            <button
              onClick={onOpenDocs}
              className="inline-flex items-center gap-1 text-[11px] bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-0.5 rounded transition-colors"
              title="View Architecture, Schemas, and Hackathon Deliverables"
            >
              <BookOpen className="w-3 h-3 text-lime-300" />
              <span>Hackathon Docs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 ring-2 ring-emerald-500/30">
              <Leaf className="w-5 h-5 text-lime-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold tracking-tight text-emerald-950 font-heading">
                  URJA<span className="text-emerald-600">SAATHI</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-lime-100 text-lime-800 rounded border border-lime-300">
                  LiFE
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium hidden sm:block">
                Your Personal Green Energy Companion
              </p>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all relative flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80 shadow-xs'
                      : 'text-gray-600 hover:text-emerald-700 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                  {item.count !== undefined && item.count > 0 && (
                    <span className="w-4 h-4 text-[10px] rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                      {item.count}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Status Indicators */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Streak */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-900 shadow-2xs"
              title={`${streakDays} Day Green Habit Streak!`}
            >
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
              <div className="text-xs">
                <span className="font-bold">{streakDays}</span>
                <span className="text-[10px] text-amber-700 ml-0.5 hidden sm:inline">d streak</span>
              </div>
            </div>

            {/* Green Score Pill */}
            <div
              onClick={() => setActiveTab('passport')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-900 cursor-pointer transition-colors shadow-2xs"
              title="Click to view your Green Impact Passport"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                {aggregates.effectiveGreenScore}
              </div>
              <div className="text-xs hidden sm:block">
                <span className="font-semibold text-emerald-900">Green Score</span>
              </div>
            </div>

            {/* Edit / Retake Onboarding */}
            <button
              onClick={onOpenOnboarding}
              className="p-2 rounded-lg border border-gray-200 hover:border-emerald-300 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
              title="Edit Household Assessment Profile"
              aria-label="Edit Profile"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden flex items-center justify-between gap-1 overflow-x-auto py-2 border-t border-gray-100 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-gray-600 hover:text-emerald-700 bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
