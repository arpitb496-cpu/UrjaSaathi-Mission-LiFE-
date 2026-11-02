import React from 'react';
import {
  LayoutDashboard,
  Zap,
  CheckCircle2,
  Bot,
  SunMedium,
  Award,
  Leaf,
  Flame,
  BookOpen,
  MapPin,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { AppState, calculateUserAggregates } from '../utils/storage';

interface SidebarProps {
  appState: AppState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDocs: () => void;
  onSelectDemoProfile: (key: string) => void;
  onOpenProfile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  appState,
  activeTab,
  setActiveTab,
  onOpenDocs,
  onSelectDemoProfile,
  onOpenProfile,
}) => {
  const { profile, streakDays, completedMissions } = appState;
  const aggregates = calculateUserAggregates(appState);
  const completedCount = Object.keys(completedMissions).length;

  // Exactly FIVE primary sections per design guidelines
  const primaryNavItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'my-energy', label: 'My Energy', icon: Zap },
    { id: 'missions', label: 'Green Missions', icon: CheckCircle2, badge: completedCount > 0 ? `${completedCount}` : undefined },
    { id: 'coach', label: 'UrjaGuru AI', icon: Bot, isAi: true },
    { id: 'solar', label: 'Solar & Savings', icon: SunMedium },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 bg-white border-r border-slate-200/80 z-30 select-none">
      {/* Brand Header */}
      <div className="h-20 px-6 flex items-center border-b border-slate-100">
        <button
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 text-left group w-full focus:outline-none"
        >
          <div className="w-10 h-10 rounded-xl bg-[#14532D] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Leaf className="w-5 h-5 text-[#A3E635]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-extrabold text-lg tracking-tight text-slate-900">
                URJA<span className="text-[#059669]">SAATHI</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-lime-100 text-emerald-900 border border-lime-300">
                LiFE
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">Green Energy Companion</p>
          </div>
        </button>
      </div>

      {/* Gujarat District & DISCOM Status Tag */}
      <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
          <MapPin className="w-3.5 h-3.5 text-[#059669] shrink-0" />
          <span className="truncate">{profile.district || 'Select Location'}</span>
        </div>
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 shrink-0">
          LiFE
        </span>
      </div>

      {/* Primary Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Main Navigation
        </div>

        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeTab === item.id || (item.id === 'dashboard' && activeTab === 'home');
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-emerald-50 text-[#14532D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-[#059669]' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {item.isAi && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-800 bg-lime-200/80 px-1.5 py-0.2 rounded">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-700" /> AI
                  </span>
                )}
              </div>

              {item.badge && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-[#059669] text-white'
                      : 'bg-slate-200/70 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Dedicated Secondary Section: MY IMPACT */}
        <div className="pt-5">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Community &amp; Recognition
          </div>
          <button
            onClick={() => setActiveTab('impact')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
              activeTab === 'impact' || activeTab === 'community' || activeTab === 'passport'
                ? 'bg-emerald-50 text-[#14532D] shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Award
                className={`w-4 h-4 transition-colors ${
                  activeTab === 'impact' || activeTab === 'community' || activeTab === 'passport'
                    ? 'text-[#059669]'
                    : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span className="truncate">My Impact</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-lime-100 px-1.5 py-0.5 rounded">
              Passport
            </span>
          </button>
        </div>

        {/* Quick Demo Profile Switcher Section */}
        <div className="pt-5">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Sample Districts
          </div>
          <div className="space-y-1">
            <button
              onClick={() => onSelectDemoProfile('gandhinagar')}
              className={`w-full text-left px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                profile.district === 'Gandhinagar'
                  ? 'bg-slate-100 text-[#14532D] font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Gandhinagar</span>
              {profile.district === 'Gandhinagar' && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
              )}
            </button>
            <button
              onClick={() => onSelectDemoProfile('ahmedabad')}
              className={`w-full text-left px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                profile.district === 'Ahmedabad'
                  ? 'bg-slate-100 text-[#14532D] font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Ahmedabad</span>
              {profile.district === 'Ahmedabad' && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
              )}
            </button>
            <button
              onClick={() => onSelectDemoProfile('surat')}
              className={`w-full text-left px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                profile.district === 'Surat'
                  ? 'bg-slate-100 text-[#14532D] font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Surat (Solar)</span>
              {profile.district === 'Surat' && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Bottom Sustainability Streak Widget & Docs Button */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        <div
          onClick={onOpenProfile}
          className="bg-slate-50 hover:bg-emerald-50/60 transition-colors p-3 rounded-xl border border-slate-200/80 cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Flame className="w-4 h-4 fill-amber-500 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">{streakDays} Day Streak</p>
                <p className="text-[10px] text-slate-500">{aggregates.effectiveGreenScore}/100 Green Score</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        <button
          onClick={onOpenDocs}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#14532D] hover:bg-slate-100/80 transition-colors border border-slate-200"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#059669]" />
          <span>Hackathon Docs</span>
        </button>
      </div>
    </aside>
  );
};
