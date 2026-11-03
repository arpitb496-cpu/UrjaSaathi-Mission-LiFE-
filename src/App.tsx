import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { MyEnergyView } from './components/MyEnergyView';
import { AiCoachView } from './components/AiCoachView';
import { MissionsView } from './components/MissionsView';
import { SolarCalculatorView } from './components/SolarCalculatorView';
import { ImpactView } from './components/ImpactView';
import { PublicVerificationView } from './components/PublicVerificationView';
import { OnboardingModal } from './components/OnboardingModal';
import { HackathonDocsModal } from './components/HackathonDocsModal';
import { GoogleLoginView } from './components/GoogleLoginView';
import {
  AppState,
  loadAppState,
  saveAppState,
  createInitialAuthenticatedUserState,
  DEMO_PROFILES,
  MissionCompletionCoordinator,
  MissionCompletionResult,
  getAdoptedMissionId,
  DEFAULT_USER_ID,
} from './utils/storage';
import {
  AuthenticatedUserProfile,
  getBrowserSupabaseClient,
  extractGoogleUserProfile,
  parseOAuthCallbackParams,
  handleOAuthCallbackExchange,
  restoreSupabaseSession,
  initiateGoogleSignIn,
  signOutSupabaseUser,
  isSessionExpired,
} from './utils/supabaseAuth';
import {
  HouseholdProfile,
  CEA_VER_22_FY25_26_EMISSION_FACTOR_KG_CO2_PER_KWH,
} from './utils/sustainabilityMath';
import { Mission } from './data/missionsData';
import { Leaf, ShieldCheck, Sparkles, AlertCircle, LogIn } from 'lucide-react';

function extractVerificationTokenFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const pathMatch = window.location.pathname.match(/^\/verify\/([^/?#]+)/i);
  if (pathMatch && pathMatch[1]) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get('verify');
  if (queryToken && queryToken.trim()) {
    return queryToken.trim();
  }
  return null;
}

function shouldOpenLoginPortalInitially(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  if (path === '/login' || path === '/signin' || path.startsWith('/auth/callback')) {
    return true;
  }
  const parsed = parseOAuthCallbackParams(window.location.search, window.location.hash);
  if (parsed.hasCallbackParams) {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('login') === '1' || params.get('auth') === 'google';
}

export default function App() {
  const [authUser, setAuthUser] = useState<AuthenticatedUserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoginPortalOpen, setIsLoginPortalOpen] = useState<boolean>(() =>
    shouldOpenLoginPortalInitially()
  );
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isExchangingCallback, setIsExchangingCallback] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorType, setAuthErrorType] = useState<
    'cancelled' | 'invalid_config' | 'expired' | 'auth_error' | null
  >(null);
  const [runtimeAuthConfig, setRuntimeAuthConfig] = useState<{
    url?: string;
    anonKey?: string;
  }>({});

  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const coordinatorRef = useRef<MissionCompletionCoordinator>(
    new MissionCompletionCoordinator(appState)
  );
  const sessionTokenRef = useRef<string>('');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [verificationRouteToken, setVerificationRouteToken] = useState<string | null>(() =>
    extractVerificationTokenFromLocation()
  );
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);

  // Synchronize authoritative server state for the active user (either authenticated Google UUID or isolated Demo session)
  const syncAuthoritativeStateForUser = useCallback(
    async (targetUser: AuthenticatedUserProfile | null, bearerToken: string | null) => {
      const headers: Record<string, string> = {};
      if (bearerToken) {
        headers['Authorization'] = `Bearer ${bearerToken}`;
      } else if (sessionTokenRef.current) {
        headers['X-UrjaSaathi-Session'] = sessionTokenRef.current;
      }

      try {
        const res = await fetch('/api/missions/state', {
          method: 'GET',
          credentials: 'same-origin',
          headers,
        });

        if (res.status === 401 && bearerToken) {
          // Token expired or rejected server-side
          await signOutSupabaseUser();
          setAuthUser(null);
          setAccessToken(null);
          setAuthError('Your Google session has expired. Please sign in again.');
          setAuthErrorType('expired');
          setIsLoginPortalOpen(true);
          return;
        }

        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.state) return;

        if (!bearerToken && typeof data.sessionToken === 'string' && data.sessionToken) {
          sessionTokenRef.current = data.sessionToken;
        }

        setAppState((prev) => {
          const effectiveId = targetUser?.id || data.userId || prev.userId || DEFAULT_USER_ID;
          const serverProfile: HouseholdProfile | undefined = data.state.profile;
          const serverHasOnboarded = Boolean(
            data.state.isOnboarded && serverProfile?.district
          );

          // Never hardcode names or districts for authenticated Google users
          let mergedProfile: HouseholdProfile = prev.profile;
          let mergedOnboarded = prev.isOnboarded;

          if (targetUser) {
            if (serverHasOnboarded && serverProfile) {
              mergedProfile = {
                ...serverProfile,
                name: serverProfile.name || targetUser.name || '',
              };
              mergedOnboarded = true;
            } else if (prev.userId === targetUser.id && prev.isOnboarded && prev.profile.district) {
              mergedProfile = {
                ...prev.profile,
                name: prev.profile.name || targetUser.name || '',
              };
              mergedOnboarded = true;
            } else {
              mergedProfile = {
                ...prev.profile,
                name: prev.profile.name || targetUser.name || '',
                city: prev.userId === targetUser.id ? prev.profile.city : '',
                district: prev.userId === targetUser.id ? prev.profile.district : '',
              };
              mergedOnboarded = Boolean(mergedProfile.name && mergedProfile.district);
            }
          }

          const reconciled: AppState = {
            ...prev,
            userId: effectiveId,
            profile: mergedProfile,
            isOnboarded: mergedOnboarded,
            completedMissions: data.state.completedMissions || {},
            streakDays:
              typeof data.state.streakDays === 'number' ? data.state.streakDays : 0,
            lastActiveDate: data.state.lastActiveDate || '',
            persistenceMode: data.persistenceMode,
            durableStorageAvailable: data.durableStorageAvailable,
            persistenceWarning: data.persistenceWarning,
          };
          coordinatorRef.current.setState(reconciled);
          saveAppState(reconciled);
          return reconciled;
        });
      } catch {
        // Offline client cache remains available if network request fails
      }
    },
    []
  );

  // Initialize Supabase Auth, handle OAuth PKCE callbacks, restore session on refresh, and subscribe to auth state changes
  useEffect(() => {
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initAuthAndState = async () => {
      // 1. Ensure public Supabase config is hydrated from build env or /api/auth/public-config
      let { client, config } = getBrowserSupabaseClient();
      let activeOverrides: { url?: string; anonKey?: string } | undefined;

      if (!config.isConfigured) {
        try {
          const cfgRes = await fetch('/api/auth/public-config', { credentials: 'same-origin' });
          if (cfgRes.ok) {
            const cfgData = await cfgRes.json();
            if (cfgData?.supabaseUrl && cfgData?.supabaseAnonKey) {
              activeOverrides = {
                url: cfgData.supabaseUrl,
                anonKey: cfgData.supabaseAnonKey,
              };
              if (isMounted) {
                setRuntimeAuthConfig(activeOverrides);
              }
              const hydrated = getBrowserSupabaseClient(activeOverrides);
              client = hydrated.client;
              config = hydrated.config;
            }
          }
        } catch {
          // Continue with local state if public-config endpoint is unreachable
        }
      }

      // 2. Check if current URL is an OAuth callback (?code=... or ?error=... or /auth/callback)
      const callbackCheck = parseOAuthCallbackParams(
        window.location.search,
        window.location.hash
      );
      const isCallbackPath = window.location.pathname.toLowerCase().startsWith('/auth/callback');

      if (callbackCheck.hasCallbackParams || isCallbackPath) {
        if (isMounted) {
          setIsExchangingCallback(true);
        }
        const exchangeResult = await handleOAuthCallbackExchange({
          searchOrUrl: window.location.href,
          hash: window.location.hash,
          client,
        });

        // Clean OAuth query/hash params from URL bar without reloading
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/');
        }

        if (!isMounted) return;
        setIsExchangingCallback(false);

        if (exchangeResult.status === 'authenticated' && exchangeResult.user) {
          const googleUser = exchangeResult.user;
          setAuthUser(googleUser);
          setAccessToken(exchangeResult.accessToken);
          setAuthError(null);
          setAuthErrorType(null);
          setIsLoginPortalOpen(false);

          const cachedUserState = loadAppState(new Date(), googleUser.id);
          const hydratedUserState: AppState = {
            ...cachedUserState,
            userId: googleUser.id,
            profile: {
              ...cachedUserState.profile,
              name: cachedUserState.profile.name || googleUser.name || '',
            },
          };
          coordinatorRef.current.setState(hydratedUserState);
          setAppState(hydratedUserState);
          saveAppState(hydratedUserState);

          await syncAuthoritativeStateForUser(googleUser, exchangeResult.accessToken);
        } else if (exchangeResult.status === 'error' || exchangeResult.status === 'expired') {
          setAuthError(exchangeResult.errorMessage || 'Authentication failed.');
          setAuthErrorType(exchangeResult.errorType || 'auth_error');
          setIsLoginPortalOpen(true);
        }
      } else {
        // 3. Restore existing session on page refresh
        const restored = await restoreSupabaseSession({ client });
        if (!isMounted) return;

        if (restored.status === 'authenticated' && restored.user) {
          const googleUser = restored.user;
          setAuthUser(googleUser);
          setAccessToken(restored.accessToken);
          setAuthError(null);
          setAuthErrorType(null);

          const cachedUserState = loadAppState(new Date(), googleUser.id);
          const hydratedUserState: AppState = {
            ...cachedUserState,
            userId: googleUser.id,
            profile: {
              ...cachedUserState.profile,
              name: cachedUserState.profile.name || googleUser.name || '',
            },
          };
          coordinatorRef.current.setState(hydratedUserState);
          setAppState(hydratedUserState);
          saveAppState(hydratedUserState);

          await syncAuthoritativeStateForUser(googleUser, restored.accessToken);
        } else if (restored.status === 'expired') {
          setAuthError(restored.errorMessage);
          setAuthErrorType('expired');
          setIsLoginPortalOpen(true);
        } else {
          // Unauthenticated guest / demo sandbox
          await syncAuthoritativeStateForUser(null, null);
        }
      }

      // 4. Attach Supabase onAuthStateChange listener for live token refreshes, logins, and logouts
      if (client) {
        const { data: listener } = client.auth.onAuthStateChange(async (event, session) => {
          if (!isMounted) return;

          if (event === 'SIGNED_OUT') {
            setAuthUser(null);
            setAccessToken(null);
            return;
          }

          if (
            (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
            session
          ) {
            if (isSessionExpired(session)) {
              await signOutSupabaseUser({ client });
              setAuthUser(null);
              setAccessToken(null);
              setAuthError('Your Google session has expired. Please sign in again.');
              setAuthErrorType('expired');
              setIsLoginPortalOpen(true);
              return;
            }

            const profile = extractGoogleUserProfile(session.user);
            if (profile) {
              setAuthUser(profile);
              setAccessToken(session.access_token);
              setIsLoginPortalOpen(false);
              await syncAuthoritativeStateForUser(profile, session.access_token);
            }
          }
        });
        authSubscription = listener.subscription;
      }
    };

    const handleLocationChange = () => {
      setVerificationRouteToken(extractVerificationTokenFromLocation());
    };
    window.addEventListener('popstate', handleLocationChange);

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

    initAuthAndState();

    return () => {
      isMounted = false;
      window.removeEventListener('popstate', handleLocationChange);
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [syncAuthoritativeStateForUser]);

  // Save changes to per-user localStorage cache and keep coordinator synced
  useEffect(() => {
    coordinatorRef.current.setState(appState);
    saveAppState(appState);
  }, [appState]);

  // Start Google OAuth login via Supabase Auth
  const handleContinueWithGoogle = async () => {
    setAuthError(null);
    setAuthErrorType(null);
    setIsSigningIn(true);

    const { client } = getBrowserSupabaseClient(
      runtimeAuthConfig.anonKey ? runtimeAuthConfig : undefined
    );
    const result = await initiateGoogleSignIn({
      client,
      redirectOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
    });

    if (result.status === 'error') {
      setIsSigningIn(false);
      setAuthError(result.errorMessage || 'Unable to start Google Sign-In.');
      setAuthErrorType(result.errorType || 'auth_error');
    }
  };

  // Sign out of Google Account and isolate from demo guest mode
  const handleSignOut = async () => {
    const { client } = getBrowserSupabaseClient(
      runtimeAuthConfig.anonKey ? runtimeAuthConfig : undefined
    );
    await signOutSupabaseUser({ client });
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});

    setAuthUser(null);
    setAccessToken(null);
    setAuthError(null);
    setAuthErrorType(null);

    const guestState = loadAppState(new Date(), DEFAULT_USER_ID);
    coordinatorRef.current.setState(guestState);
    setAppState(guestState);
    setIsLoginPortalOpen(true);
  };

  // Switch from Login Portal into Isolated Demo Sandbox
  const handleContinueAsDemoGuest = () => {
    setAuthError(null);
    setAuthErrorType(null);
    setIsLoginPortalOpen(false);
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    const guestState = loadAppState(new Date(), DEFAULT_USER_ID);
    coordinatorRef.current.setState(guestState);
    setAppState(guestState);
    syncAuthoritativeStateForUser(null, null);
  };

  // Handle saving new or edited household profile (isolated per userId)
  const handleSaveProfile = (newProfile: HouseholdProfile) => {
    setAppState((prev) => {
      const updated: AppState = {
        ...prev,
        profile: newProfile,
        isOnboarded: true,
      };
      coordinatorRef.current.setState(updated);
      saveAppState(updated);
      return updated;
    });

    // Persist profile server-side for the authenticated user or current session
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else if (sessionTokenRef.current) {
      headers['X-UrjaSaathi-Session'] = sessionTokenRef.current;
    }

    fetch('/api/user/profile', {
      method: 'PUT',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify({
        profile: newProfile,
        isOnboarded: true,
      }),
    }).catch(() => {});
  };

  // Switch demo profiles (only available in Guest Demo mode)
  const handleSelectDemoProfile = (key: string) => {
    if (authUser) return; // Never overwrite an authenticated user's profile with hardcoded demo profiles
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
    const result = coordinatorRef.current.completeSync(mission, {
      userId: authUser?.id || appState.userId,
    });
    if (result.status === 'completed') {
      setAppState(result.state);
      saveAppState(result.state);

      // Commit to authoritative server-side database ledger (Supabase PostgreSQL / atomic transaction)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else if (sessionTokenRef.current) {
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
        .then(async (res) => {
          if (res.status === 401 && accessToken) {
            await signOutSupabaseUser();
            setAuthUser(null);
            setAccessToken(null);
            setAuthError('Your Google session expired while saving mission progress. Please sign in again.');
            setAuthErrorType('expired');
            setIsLoginPortalOpen(true);
            return null;
          }
          return res.ok ? res.json() : null;
        })
        .then((serverResult) => {
          if (!serverResult || !serverResult.state) return;
          if (!accessToken && typeof serverResult.sessionToken === 'string' && serverResult.sessionToken) {
            sessionTokenRef.current = serverResult.sessionToken;
          }
          // Reconcile client cache with authoritative server ledger while preserving user's household profile
          setAppState((prev) => {
            const authoritative: AppState = {
              ...prev,
              userId: authUser?.id || serverResult.userId || prev.userId,
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

  const handleOpenVerificationToken = (token: string) => {
    const cleanToken = (token || '').trim();
    if (!cleanToken) return;
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/verify/${encodeURIComponent(cleanToken)}`);
    }
    setVerificationRouteToken(cleanToken);
  };

  const handleBackFromVerification = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
    setVerificationRouteToken(null);
  };

  if (verificationRouteToken !== null) {
    return (
      <PublicVerificationView
        token={verificationRouteToken}
        onBackToApp={handleBackFromVerification}
      />
    );
  }

  if (isLoginPortalOpen && !authUser) {
    return (
      <GoogleLoginView
        onContinueWithGoogle={handleContinueWithGoogle}
        onContinueAsDemoGuest={handleContinueAsDemoGuest}
        isSigningIn={isSigningIn}
        isExchangingCallback={isExchangingCallback}
        authError={authError}
        authErrorType={authErrorType}
        onDismissError={() => {
          setAuthError(null);
          setAuthErrorType(null);
        }}
      />
    );
  }

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
        authUser={authUser}
        onOpenSignIn={() => setIsLoginPortalOpen(true)}
        onSignOut={handleSignOut}
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
          authUser={authUser}
          onOpenSignIn={() => setIsLoginPortalOpen(true)}
          onSignOut={handleSignOut}
        />

        {/* Authenticated User Onboarding Prompt when Google User has not yet selected their Gujarat district */}
        {authUser && (!appState.isOnboarded || !appState.profile.district) && (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div
              data-testid="authenticated-onboarding-banner"
              className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-start sm:items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-bold">
                    Welcome{authUser.name ? `, ${authUser.name}` : ''}!{' '}
                  </span>
                  <span>
                    Signed in as <strong className="font-mono">{authUser.email}</strong>. Complete
                    your Gujarat household onboarding to calibrate your district tariff slab and
                    rooftop solar baseline.
                  </span>
                </div>
              </div>
              <button
                type="button"
                data-testid="complete-authenticated-onboarding-btn"
                onClick={() => setIsOnboardingOpen(true)}
                className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[#14532D] hover:bg-emerald-900 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Complete Household Onboarding
              </button>
            </div>
          </div>
        )}

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
              accessToken={accessToken}
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
              accessToken={accessToken}
              onOpenVerificationToken={handleOpenVerificationToken}
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
