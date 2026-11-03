import React, { useState, useEffect, useRef } from 'react';
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
  MissionCompletionCoordinator,
  MissionCompletionResult,
  getAdoptedMissionId,
  getEffectiveUserId,
} from './utils/storage';
import {
  HouseholdProfile,
  CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH,
} from './utils/sustainabilityMath';
import { Mission } from './data/missionsData';
import { Leaf } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const coordinatorRef = useRef<MissionCompletionCoordinator>(
    new MissionCompletionCoordinator(appState)
  );
  const sessionTokenRef = useRef<string>('');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);

  // Check query params (?autostart=1 or ?tab=solar) and hydrate authoritative mission ledger from backend
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

    // Fetch authoritative mission ledger & persistence status from server
    // Browser localStorage is treated strictly as a client-side cache, never as the authoritative reward ledger.
    fetch('/api/missions/state', {
      method: 'GET',
      credentials: 'same-origin',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.state) return;
        if (typeof data.sessionToken === 'string' && data.sessionToken) {
          sessionTokenRef.current = data.sessionToken;
        }
        setAppState((prev) => {
          const reconciled: AppState = {
            ...prev,
            userId: data.userId || prev.userId,
            completedMissions: data.state.completedMissions || prev.completedMissions,
            streakDays:
              typeof data.state.streakDays === 'number' ? data.state.streakDays : prev.streakDays,
            lastActiveDate: data.state.lastActiveDate || prev.lastActiveDate,
            persistenceMode: data.persistenceMode,
            durableStorageAvailable: data.durableStorageAvailable,
            persistenceWarning: data.persistenceWarning,
          };
          coordinatorRef.current.setState(reconciled);
          saveAppState(reconciled);
          return reconciled;
        });
      })
      .catch(() => {
        // Offline client cache remains available if network request fails
      });
  }, []);

  // Save changes to localStorage cache and keep coordinator synced
  useEffect(() => {
    coordinatorRef.current.setState(appState);
    saveAppState(appState);
  }, [appState]);

  // Handle saving new or edited profile
  const handleSaveProfile = (newProfile: HouseholdProfile) => {
    setAppState((prev) => {
      const updated: AppState = {
        ...prev,
        profile: newProfile,
        isOnboarded: true,
      };
      coordinatorRef.current.setState(updated);
      return updated;
    });
  };

  // Switch demo profiles
  const handleSelectDemoProfile = (key: string) => {
    const selected = DEMO_PROFILES[key];
    if (selected) {
      setAppState((prev) => {
        const updated: AppState = {
          ...prev,
          profile: selected,
          isOnboarded: true,
        };
        coordinatorRef.current.setState(updated);
        return updated;
      });
    }
  };

  // Complete mission once per calendar day (Asia/Kolkata) with atomic server-side duplicate prevention
  const handleToggleMission = (mission: Mission): MissionCompletionResult => {
    const result = coordinatorRef.current.completeSync(mission);
    if (result.status === 'completed') {
      setAppState(result.state);
      saveAppState(result.state);

      // Commit to authoritative server-side database ledger (Supabase PostgreSQL / atomic transaction)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionTokenRef.current) {
        headers['X-UrjaSaathi-Session'] = sessionTokenRef.current;
      }

      fetch('/api/missions/complete', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({
          mission: {
            id: mission.id,
            title: mission.title,
            points: mission.points,
            co2SavedKg: mission.co2SavedKg,
            inrSaved: mission.inrSaved,
          },
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((serverResult) => {
          if (!serverResult || !serverResult.state) return;
          if (typeof serverResult.sessionToken === 'string' && serverResult.sessionToken) {
            sessionTokenRef.current = serverResult.sessionToken;
          }
          // Reconcile client cache with authoritative server ledger
          setAppState((prev) => {
            const authoritative: AppState = {
              ...prev,
              userId: serverResult.userId || prev.userId,
              completedMissions: serverResult.state.completedMissions,
              streakDays: serverResult.state.streakDays,
              lastActiveDate: serverResult.state.lastActiveDate,
              persistenceMode: serverResult.persistenceMode ?? prev.persistenceMode,
              durableStorageAvailable:
                serverResult.durableStorageAvailable ?? prev.durableStorageAvailable,
              persistenceWarning: serverResult.persistenceWarning ?? prev.persistenceWarning,
            };
            coordinatorRef.current.setState(authoritative);
            saveAppState(authoritative);
            return authoritative;
          });
        })
        .catch(() => {
          // Client cache retains optimistic completion if network is unreachable
        });
    }
    return result;
  };

  // Adopt mission from AI Coach (uses deterministic missionId per recommendation title)
  const handleAdoptMission = (
    title: string,
    kwh: number,
    inr: number
  ): MissionCompletionResult => {
    const id = getAdoptedMissionId(title);
    const dynamicMission: Mission = {
      id,
      title,
      category: 'Habits',
      points: 30,
      co2SavedKg: Number((kwh * CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH).toFixed(1)),
      inrSaved: inr,
      description: `Action recommended by UrjaGuru AI Coach${
        appState.profile.district ? ` for your household in ${appState.profile.district}` : ''
      }.`,
      actionTip: 'Consistent execution leads to permanent grid demand reduction.',
      difficulty: 'Easy',
      lifePillar: 'Save Energy',
      iconName: 'Zap',
    };

    return handleToggleMission(dynamicMission);
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

        {/* Explicit Persistence Limitation Notice when Supabase PostgreSQL is unconfigured */}
        {appState.durableStorageAvailable === false && (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold">Local Demo Persistence Notice: </span>
                <span>
                  Server-side Supabase PostgreSQL credentials (<code className="font-mono">SUPABASE_URL</code>) are not configured.
                  Durable cloud database persistence is unavailable; rewards are operating in local demo fallback mode with browser cache.
                </span>
              </div>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[11px] font-semibold">
                Mode: local_demo_fallback
              </span>
            </div>
          </div>
        )}

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
              appState={appState}
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
