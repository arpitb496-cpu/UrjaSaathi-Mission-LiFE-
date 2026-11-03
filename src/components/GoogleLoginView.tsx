import React from 'react';
import {
  Leaf,
  ShieldCheck,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  UserCheck,
  Award,
  Sun,
} from 'lucide-react';

export interface GoogleLoginViewProps {
  onContinueWithGoogle: () => Promise<void> | void;
  onContinueAsDemoGuest: () => void;
  isSigningIn?: boolean;
  isExchangingCallback?: boolean;
  authError?: string | null;
  authErrorType?: 'cancelled' | 'invalid_config' | 'expired' | 'auth_error' | null;
  onDismissError?: () => void;
}

export const GoogleLoginView: React.FC<GoogleLoginViewProps> = ({
  onContinueWithGoogle,
  onContinueAsDemoGuest,
  isSigningIn = false,
  isExchangingCallback = false,
  authError = null,
  authErrorType = null,
  onDismissError,
}) => {
  return (
    <div
      data-testid="google-login-view"
      className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between font-sans selection:bg-emerald-200 selection:text-emerald-950"
    >
      {/* Top Brand Bar */}
      <header className="w-full bg-white border-b border-slate-200/80 px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#14532D] flex items-center justify-center text-white shadow-xs">
            <Leaf className="w-5 h-5 text-[#A3E635]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-extrabold text-base sm:text-lg tracking-tight text-slate-900">
                URJA<span className="text-[#059669]">SAATHI</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-lime-100 text-emerald-900 border border-lime-300 whitespace-nowrap">
                Mission LiFE
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 hidden sm:block">
              Gujarat Residential Sustainability &amp; Solar Companion
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
          <span className="font-medium hidden sm:inline">Supabase PKCE OAuth 2.0</span>
          <span className="font-mono text-[10px] sm:text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap">
            Secure Portal
          </span>
        </div>
      </header>

      {/* Main Centered Split / Responsive Login Layout */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
          {/* Left Column: Mission LiFE Value Proposition (Green Panel - second on mobile, first on desktop) */}
          <div className="order-2 lg:order-1 lg:col-span-5 bg-gradient-to-br from-[#14532D] via-emerald-900 to-teal-950 text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-6 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-semibold text-lime-300">
                <Leaf className="w-3.5 h-3.5" />
                <span>GEDA Mission LiFE Citizen Account</span>
              </div>

              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight leading-tight text-white">
                  Track Your Household Energy &amp; Verified Green Impact
                </h1>
                <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                  Sign in with your Google account to save your Gujarat household electricity profile,
                  daily Mission LiFE streaks, UrjaGuru AI coaching history, and cryptographic Green
                  Impact Passport across devices.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-800/80 border border-emerald-600/50 flex items-center justify-center shrink-0 mt-0.5">
                    <UserCheck className="w-4 h-4 text-lime-300" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-white">
                      Isolated Personal Sustainability Ledger
                    </h2>
                    <p className="text-[11px] sm:text-xs text-emerald-200/85 mt-0.5 leading-relaxed">
                      Your household consumption, mission completions, and streaks are tied exclusively
                      to your verified Supabase account UUID.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-800/80 border border-emerald-600/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-lime-300" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-white">
                      Built-In UrjaGuru Gemini AI Coach
                    </h2>
                    <p className="text-[11px] sm:text-xs text-emerald-200/85 mt-0.5 leading-relaxed">
                      Instant access to platform-managed Gemini AI energy analysis and appliance math
                      — no personal API keys required.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-800/80 border border-emerald-600/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Award className="w-4 h-4 text-lime-300" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-white">
                      Verifiable Green Impact Passport &amp; Solar PDF
                    </h2>
                    <p className="text-[11px] sm:text-xs text-emerald-200/85 mt-0.5 leading-relaxed">
                      Generate downloadable PM Surya Ghar solar feasibility reports and QR-verifiable
                      sustainability credentials.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 mt-8 border-t border-emerald-800/80 flex items-center justify-between text-[11px] text-emerald-200/90 relative z-10">
              <span className="flex items-center gap-1.5 font-medium">
                <Sun className="w-3.5 h-3.5 text-lime-300" />
                CEA Ver 22.0 &amp; GERC GIDRES 2026
              </span>
              <span className="font-mono text-lime-300">0.675 kg CO2/kWh</span>
            </div>
          </div>

          {/* Right Column: Google Sign-In Action Card (White Panel - first on mobile, second on desktop) */}
          <div className="order-1 lg:order-2 lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
            <div className="max-w-md mx-auto w-full space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#059669]">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Personal Account Sign-In</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading tracking-tight">
                  Welcome to UrjaSaathi
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Authenticate with your Google account via Supabase Auth to load or create your
                  personal Gujarat household sustainability profile.
                </p>
              </div>

              {/* OAuth Callback PKCE Exchange Loading Banner */}
              {isExchangingCallback && (
                <div
                  data-testid="oauth-callback-loading"
                  className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-3"
                >
                  <RefreshCw className="w-4 h-4 text-[#059669] animate-spin shrink-0" />
                  <div>
                    <p className="font-bold">Completing Google Sign-In (PKCE Session Exchange)...</p>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Verifying your Google identity and restoring your household profile.
                    </p>
                  </div>
                </div>
              )}

              {/* Authentication Error / Cancelled / Invalid Config Notice */}
              {authError && (
                <div
                  data-testid="google-auth-error-banner"
                  className={`p-4 rounded-2xl border text-xs flex items-start justify-between gap-3 ${
                    authErrorType === 'cancelled'
                      ? 'bg-amber-50 border-amber-200 text-amber-950'
                      : 'bg-red-50 border-red-200 text-red-950'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        authErrorType === 'cancelled' ? 'text-amber-700' : 'text-red-600'
                      }`}
                    />
                    <div className="space-y-1">
                      <p className="font-bold">
                        {authErrorType === 'cancelled'
                          ? 'Sign-In Cancelled'
                          : authErrorType === 'invalid_config'
                          ? 'Google OAuth Configuration Required'
                          : authErrorType === 'expired'
                          ? 'Session Expired'
                          : 'Authentication Notice'}
                      </p>
                      <p className="leading-relaxed">{authError}</p>
                    </div>
                  </div>
                  {onDismissError && (
                    <button
                      type="button"
                      onClick={onDismissError}
                      className="text-[11px] font-bold underline shrink-0 opacity-80 hover:opacity-100 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              )}

              {/* Primary CTA: Continue with Google */}
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  data-testid="continue-with-google-btn"
                  onClick={onContinueWithGoogle}
                  disabled={isSigningIn || isExchangingCallback}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#14532D] hover:bg-emerald-900 active:scale-[0.99] disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  {isSigningIn ? (
                    <RefreshCw className="w-5 h-5 text-[#A3E635] animate-spin" />
                  ) : (
                    <span className="w-6 h-6 rounded-lg bg-white flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M23.49 12.275c0-.85-.075-1.675-.215-2.475H12v4.69h6.445c-.28 1.5-1.125 2.775-2.4 3.63v3.015h3.88c2.27-2.09 3.565-5.17 3.565-8.86z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.955-1.075 7.94-2.91l-3.88-3.015c-1.075.72-2.45 1.15-4.06 1.15-3.125 0-5.77-2.11-6.715-4.945H1.275v3.11C3.25 21.32 7.31 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.285 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.61H1.275C.465 8.23 0 10.06 0 12s.465 3.77 1.275 5.39l4.01-3.11z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.775c1.76 0 3.34.605 4.585 1.795l3.44-3.44C17.95 1.19 15.235 0 12 0 7.31 0 3.25 2.68 1.275 6.61l4.01 3.11c.945-2.835 3.59-4.945 6.715-4.945z"
                        />
                      </svg>
                    </span>
                  )}
                  <span>
                    {isSigningIn ? 'Redirecting to Google Sign-In...' : 'Continue with Google'}
                  </span>
                </button>

                {/* Privacy & Platform AI Explanation Card */}
                <div
                  data-testid="google-privacy-explanation"
                  className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14532D]">
                    <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
                    <span>Privacy &amp; Data Protection Guarantee</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed">
                    Google Sign-In is used <strong>only</strong> to verify your basic profile (name,
                    verified email, and avatar) and isolate your personal sustainability records.
                    UrjaSaathi never collects your Google password and never asks you for Gemini or
                    OpenAI API keys — UrjaGuru AI runs automatically on our secure server.
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Or Evaluate Prototype Sandbox
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              {/* Secondary Option: Isolated Demo Sandbox */}
              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="continue-demo-guest-btn"
                  onClick={onContinueAsDemoGuest}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/90 text-slate-700 hover:text-slate-900 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Explore Isolated Demo Sandbox (Guest Mode)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <p className="text-[11px] text-center text-slate-500">
                  Demo sandbox data is strictly isolated and is never merged into Google accounts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="w-full py-4 px-4 sm:px-8 border-t border-slate-200/80 bg-white text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
          <span>URJASAATHI · Gujarat Energy Development Agency (GEDA) Mission LiFE Model</span>
        </div>
        <div className="font-mono text-slate-400">
          Supabase Auth Project: wzkpbofwajdbaqqrviqw.supabase.co
        </div>
      </footer>
    </div>
  );
};
