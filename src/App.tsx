import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { MyEnergyView } from './components/MyEnergyView';
import { AiCoachView } from './components/AiCoachView';
import { MissionsView } from './components/MissionsView';
import { SolarCalculatorView } from './components/SolarCalculatorView';
import { ImpactView } from './components/ImpactView';
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
import {
  HouseholdProfile,
  CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH,
} from './utils/sustainabilityMath';
import { Mission, MISSIONS_LIST } from './data/missionsData';
import { Leaf } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);

  // Check query params (?autostart=1 or ?tab=solar)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (
      tabParam &&
      [
        'home',
        'dashboard',
        'my-energy',
        'missions',
        'coach',
        'solar',
        'impact',
        'community',
        'passport',
      ].includes(tabParam)
    ) {
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
      co2SavedKg: Number((kwh * CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH).toFixed(1)),
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-emerald-200 selection:text-emerald-950">
      {/* 1. Desktop Fixed Left Sidebar */}
      <Sidebar
        appState={appState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDocs={() => setIsDocsOpen(true)}
        onSelectDemoProfile={handleSelectDemoProfile}
        onOpenProfile={() => setIsOnboardingOpen(true)}
      />

      {/* 2. Main Content Wrapper (offset by lg:pl-64 on desktop) */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <TopNavbar
          appState={appState}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          onOpenDocs={() => setIsDocsOpen(true)}
        />

        {/* Dynamic View Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-12">
          {(activeTab === 'dashboard' || activeTab === 'home') && (
            <DashboardView
              appState={appState}
              setActiveTab={setActiveTab}
              onOpenOnboarding={() => setIsOnboardingOpen(true)}
              onToggleMission={handleToggleMission}
            />
          )}

          {activeTab === 'my-energy' && (
            <MyEnergyView
              appState={appState}
              setActiveTab={setActiveTab}
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

          {(activeTab === 'impact' || activeTab === 'community' || activeTab === 'passport') && (
            <ImpactView
              appState={appState}
              initialSubTab={
                activeTab === 'passport'
                  ? 'passport'
                  : activeTab === 'community'
                  ? 'leaderboard'
                  : 'achievements'
              }
            />
          )}
        </main>

        {/* Clean, Professional Footer */}
        <footer className="bg-white border-t border-slate-200/80 py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 mt-auto hidden lg:block">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#14532D] text-white flex items-center justify-center">
                <Leaf className="w-3.5 h-3.5 text-[#A3E635]" />
              </div>
              <span className="font-semibold text-slate-700">
                URJASAATHI · GEDA Mission LiFE Hackathon Model
              </span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <button
                onClick={() => setIsDocsOpen(true)}
                className="text-[#059669] hover:underline font-medium"
              >
                System Architecture &amp; Methodology Docs
              </button>
              <span>•</span>
              <button
                onClick={() => setIsOnboardingOpen(true)}
                className="hover:text-slate-800"
              >
                Recalibrate Household Profile
              </button>
              <span>•</span>
              <span className="text-slate-400">
                CEA Ver 22.0 Baseline (0.675 kg CO2/kWh)
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* 3. Mobile Bottom Navigation */}
      <BottomNav
        appState={appState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

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
