import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { AiCoachView } from './components/AiCoachView';
import { MissionsView } from './components/MissionsView';
import { SolarCalculatorView } from './components/SolarCalculatorView';
import { CommunityView } from './components/CommunityView';
import { PassportView } from './components/PassportView';
import { OnboardingModal } from './components/OnboardingModal';
import { HackathonDocsModal } from './components/HackathonDocsModal';
import {
  AppState,
  loadAppState,
  saveAppState,
  DEFAULT_PROFILE,
  DEMO_PROFILES,
} from './utils/storage';
import { HouseholdProfile } from './utils/sustainabilityMath';
import { Mission, MISSIONS_LIST } from './data/missionsData';
import {
  ShieldCheck,
  Leaf,
  Sun,
  Flame,
  Zap,
  ArrowRight,
  TrendingDown,
  BookOpen,
  Award,
} from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);

  // Check query params (?autostart=1 or ?tab=solar)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['dashboard', 'missions', 'coach', 'solar', 'community', 'passport'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  // Handle saving new or edited profile
  const handleSaveProfile = (newProfile: HouseholdProfile) => {
    setAppState((prev) => ({
      ...prev,
      profile: newProfile,
      isOnboarded: true,
    }));
  };

  // Switch demo profiles
  const handleSelectDemoProfile = (key: string) => {
    const selected = DEMO_PROFILES[key];
    if (selected) {
      setAppState((prev) => ({
        ...prev,
        profile: selected,
        isOnboarded: true,
      }));
    }
  };

  // Toggle mission completion
  const handleToggleMission = (mission: Mission) => {
    setAppState((prev) => {
      const nextCompleted = { ...prev.completedMissions };
      let streak = prev.streakDays;

      if (nextCompleted[mission.id]) {
        delete nextCompleted[mission.id];
      } else {
        nextCompleted[mission.id] = {
          missionId: mission.id,
          completedAt: new Date().toISOString(),
          points: mission.points,
          co2SavedKg: mission.co2SavedKg,
          inrSaved: mission.inrSaved,
        };
        streak = Math.max(streak, streak + 1);
      }

      return {
        ...prev,
        completedMissions: nextCompleted,
        streakDays: streak,
        lastActiveDate: new Date().toISOString().split('T')[0],
      };
    });
  };

  // Adopt mission from AI Coach
  const handleAdoptMission = (title: string, kwh: number, inr: number) => {
    const id = `adopted-${Date.now()}`;
    const dynamicMission: Mission = {
      id,
      title,
      category: 'Habits',
      points: 30,
      co2SavedKg: Number((kwh * 0.82).toFixed(1)),
      inrSaved: inr,
      description: `Action recommended by UrjaGuru AI Coach for your household in ${appState.profile.district}.`,
      actionTip: 'Consistent execution leads to permanent grid demand reduction.',
      difficulty: 'Easy',
      lifePillar: 'Save Energy',
      iconName: 'Zap',
    };

    handleToggleMission(dynamicMission);
  };

  return (
    <div className="min-h-screen bg-[#f8faf8] text-gray-900 flex flex-col selection:bg-emerald-200 selection:text-emerald-900">
      {/* Header */}
      <Header
        appState={appState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onOpenDocs={() => setIsDocsOpen(true)}
        onSelectDemoProfile={handleSelectDemoProfile}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            appState={appState}
            setActiveTab={setActiveTab}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
          />
        )}

        {activeTab === 'missions' && (
          <MissionsView
            appState={appState}
            onToggleMission={handleToggleMission}
          />
        )}

        {activeTab === 'coach' && (
          <AiCoachView
            profile={appState.profile}
            onAdoptMission={handleAdoptMission}
          />
        )}

        {activeTab === 'solar' && (
          <SolarCalculatorView
            initialProfile={appState.profile}
          />
        )}

        {activeTab === 'community' && (
          <CommunityView
            appState={appState}
          />
        )}

        {activeTab === 'passport' && (
          <PassportView
            appState={appState}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-emerald-950 text-emerald-300 py-8 px-4 sm:px-6 lg:px-8 border-t border-emerald-900 text-xs mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-white">
              <Leaf className="w-4 h-4 text-lime-300" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">
                URJASAATHI – Your Personal Green Energy Companion
              </p>
              <p className="text-[11px] text-emerald-400">
                Gujarat Energy Development Agency (GEDA) Mission LiFE Hackathon Submission
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <button
              onClick={() => setIsDocsOpen(true)}
              className="text-emerald-300 hover:text-white underline decoration-dotted"
            >
              System Architecture & Docs
            </button>
            <span>•</span>
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="text-emerald-300 hover:text-white underline decoration-dotted"
            >
              Recalibrate Household Profile
            </button>
            <span>•</span>
            <span>CEA Western Regional Emission Factor (0.82 kg CO2/kWh)</span>
          </div>
        </div>
      </footer>

      {/* Onboarding / Profile Edit Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        currentProfile={appState.profile}
        onSaveProfile={handleSaveProfile}
      />

      {/* Hackathon Deliverables & Architecture Docs Modal */}
      <HackathonDocsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />
    </div>
  );
}
