import React from 'react';
import {
  LayoutDashboard,
  Zap,
  CheckCircle2,
  Bot,
  SunMedium,
} from 'lucide-react';
import { AppState } from '../utils/storage';

interface BottomNavProps {
  appState: AppState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  appState,
  activeTab,
  setActiveTab,
}) => {
  const completedCount = Object.keys(appState.completedMissions).length;

  // Exactly 5 clean primary mobile tabs
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'my-energy', label: 'My Energy', icon: Zap },
    { id: 'missions', label: 'Missions', icon: CheckCircle2, badge: completedCount > 0 ? `${completedCount}` : undefined },
    { id: 'coach', label: 'UrjaGuru AI', icon: Bot },
    { id: 'solar', label: 'Solar', icon: SunMedium },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-2 py-1.5 flex items-center justify-around">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          activeTab === tab.id || (tab.id === 'dashboard' && activeTab === 'home');
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
              isActive
                ? 'text-[#059669] font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
              {tab.badge && (
                <span className="absolute -top-1 -right-2 bg-[#059669] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
