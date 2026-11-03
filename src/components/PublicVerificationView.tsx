import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Leaf,
  Award,
  CheckCircle2,
  Calendar,
  MapPin,
  UserCheck,
  Lock,
  ArrowLeft,
  Flame,
  TreeDeciduous,
  RefreshCw,
} from 'lucide-react';
import {
  PROTOTYPE_PASSPORT_DISCLAIMER,
  formatIstDate,
} from '../utils/pdfGenerator';

interface PublicVerificationViewProps {
  token: string;
  onBackToApp: () => void;
}

interface PublicVerificationApiResponse {
  verified: boolean;
  verificationState: 'verified' | 'revoked' | 'invalid_token' | 'unknown_token';
  signatureValid: boolean;
  reason?: string;
  error?: string;
  disclaimer: string;
  persistenceMode: 'supabase_postgres' | 'local_demo_fallback';
  supabaseConfigured: boolean;
  durableStorageAvailable: boolean;
  publicCredential: {
    passportId: string;
    credentialStatus: 'active' | 'revoked';
    holderDisplayName: string;
    publicDisplayConsent: boolean;
    district: string;
    greenScore: number;
    missionsCompleted: number;
    co2SavedKg: number;
    streakDays: number;
    unlockedBadgeIds: string[];
    issuedAt: string;
    verifiedCount: number;
    lastVerifiedAt: string | null;
    tokenHashPrefix: string;
    isDemoCredential: boolean;
  } | null;
}

const BADGE_CATALOG: Record<
  string,
  { name: string; category: string; icon: string; description: string }
> = {
  pioneer: {
    name: 'Mission LiFE Pioneer',
    category: 'Foundation',
    icon: '🌱',
    description: 'Established household carbon baseline under Mission LiFE.',
  },
  ac_master: {
    name: 'AC 24°C Maestro',
    category: 'Cooling',
    icon: '❄️',
    description: 'Maintained air conditioner at 24°C during peak afternoon hours.',
  },
  vampire_slayer: {
    name: 'Vampire Load Slayer',
    category: 'Efficiency',
    icon: '⚡',
    description: 'Eliminated standby phantom consumption across home appliances.',
  },
  solar_advocate: {
    name: 'Surya Gujarat Scout',
    category: 'Solar',
    icon: '☀️',
    description: 'Evaluated rooftop solar feasibility or adopted grid-tied PV.',
  },
  streak_master: {
    name: '7-Day Habit Champion',
    category: 'Streak',
    icon: '🔥',
    description: 'Sustained a 7-day consecutive sustainability action streak.',
  },
  carbon_guardian: {
    name: '100 kg CO2 Guardian',
    category: 'Impact',
    icon: '🛡️',
    description: 'Averted over 100 kg of coal-fired grid CO2 emissions.',
  },
};

export const PublicVerificationView: React.FC<PublicVerificationViewProps> = ({
  token,
  onBackToApp,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PublicVerificationApiResponse | null>(null);

  const fetchVerification = async (targetToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/passport/verify/${encodeURIComponent(targetToken.trim())}`,
        { credentials: 'same-origin' }
      );
      const json = await res.json();
      setData(json);
    } catch {
      setData({
        verified: false,
        verificationState: 'unknown_token',
        signatureValid: false,
        error: 'Unable to reach verification server.',
        disclaimer: PROTOTYPE_PASSPORT_DISCLAIMER,
        persistenceMode: 'local_demo_fallback',
        supabaseConfigured: false,
        durableStorageAvailable: false,
        publicCredential: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerification(token);
  }, [token]);

  const cred = data?.publicCredential;
  const state = data?.verificationState || 'unknown_token';
  const isVerified = Boolean(data?.verified && state === 'verified' && cred);
  const isRevoked = state === 'revoked';
  const isInvalid = state === 'invalid_token';

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-800 py-8 px-4 sm:px-6 lg:px-8"
      data-testid="public-verification-page"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14532D] text-white flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5 text-[#A3E635]" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                URJASAATHI · Public Credential Verification Portal
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 font-heading">
                Green Impact Passport Verification
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToApp}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Open UrjaSaathi App</span>
          </button>
        </div>

        {/* Mandatory Prototype Credential Disclaimer Banner */}
        <div
          className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-3 shadow-2xs"
          data-testid="verification-prototype-disclaimer"
        >
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-900 uppercase tracking-wide text-[11px]">
              Prototype Credential Disclosure
            </div>
            <p className="font-semibold leading-relaxed">
              {PROTOTYPE_PASSPORT_DISCLAIMER}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3 shadow-xs">
            <RefreshCw className="w-8 h-8 text-emerald-700 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              Verifying cryptographic passport token...
            </p>
            <p className="text-xs text-slate-500 font-mono break-all">{token}</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
            {/* Status Header Banner */}
            <div
              className={`p-6 sm:p-7 text-white ${
                isVerified
                  ? 'bg-gradient-to-r from-[#14532D] to-emerald-800'
                  : isRevoked
                  ? 'bg-gradient-to-r from-red-900 to-rose-800'
                  : 'bg-gradient-to-r from-slate-800 to-slate-900'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  {isVerified ? (
                    <div className="w-12 h-12 rounded-2xl bg-lime-400/20 border border-lime-300/40 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-7 h-7 text-lime-300" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-red-400/20 border border-red-300/40 flex items-center justify-center shrink-0">
                      <ShieldX className="w-7 h-7 text-red-200" />
                    </div>
                  )}

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        data-testid="credential-verification-status"
                        className={`text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          isVerified
                            ? cred?.isDemoCredential
                              ? 'bg-amber-300 text-amber-950'
                              : 'bg-lime-300 text-emerald-950'
                            : isRevoked
                            ? 'bg-red-200 text-red-950'
                            : 'bg-slate-200 text-slate-900'
                        }`}
                      >
                        {isVerified
                          ? cred?.isDemoCredential
                            ? 'DEMO CREDENTIAL (LOCAL FALLBACK)'
                            : 'ACTIVE & VERIFIED CREDENTIAL'
                          : isRevoked
                          ? 'REVOKED CREDENTIAL'
                          : isInvalid
                          ? 'INVALID VERIFICATION TOKEN'
                          : 'UNKNOWN PASSPORT TOKEN'}
                      </span>

                      {cred && (
                        <span className="text-[11px] font-mono bg-black/25 px-2.5 py-0.5 rounded text-white/90">
                          ID: {cred.passportId}
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-extrabold font-heading mt-2">
                      {isVerified
                        ? cred?.isDemoCredential
                          ? 'Valid Demo Sustainability Credential'
                          : 'Authentic UrjaSaathi Green Impact Passport'
                        : isRevoked
                        ? 'This Passport Credential Has Been Revoked'
                        : isInvalid
                        ? 'Invalid Verification Token Format'
                        : 'Passport Credential Record Not Found'}
                    </h2>

                    <p className="text-xs text-white/85 mt-1">
                      {isVerified
                        ? `Cryptographic SHA-256 token hash (${cred?.tokenHashPrefix}...) verified against ${
                            data?.durableStorageAvailable
                              ? 'Supabase PostgreSQL production storage'
                              : 'local demonstration ledger'
                          }.`
                        : data?.error ||
                          data?.reason ||
                          'The scanned QR token could not be verified.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Body when a credential record exists (active or revoked) */}
            {cred ? (
              <div className="p-6 sm:p-8 space-y-6">
                {/* Demo Storage Honesty Notice when durable storage is unavailable */}
                {cred.isDemoCredential && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <strong>Demo Credential Storage Notice:</strong> Persistent production database
                    storage is not active in this environment. This credential is verified against
                    the local demo ledger and should not be treated as a permanently persisted
                    public record until cloud persistence is configured.
                  </div>
                )}

                {/* Holder & Credential Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Passport Holder</span>
                    </div>
                    <div
                      className="text-sm font-extrabold text-slate-900 mt-1"
                      data-testid="verified-holder-name"
                    >
                      {cred.holderDisplayName}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {cred.publicDisplayConsent
                        ? 'Public name display consented by holder'
                        : 'Name anonymized per holder privacy preference'}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Passport ID</span>
                    </div>
                    <div
                      className="text-sm font-extrabold font-mono text-slate-900 mt-1"
                      data-testid="verified-passport-id"
                    >
                      {cred.passportId}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Status: <strong className="uppercase">{cred.credentialStatus}</strong>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                      <span>District</span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 mt-1">
                      {cred.district && cred.district.toLowerCase() !== 'gujarat'
                        ? `${cred.district}, Gujarat`
                        : 'Gujarat, India'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      GEDA Mission LiFE Cohort
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase">
                      <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Issue Date</span>
                    </div>
                    <div
                      className="text-sm font-extrabold text-slate-900 mt-1"
                      data-testid="verified-issue-date"
                    >
                      {formatIstDate(cred.issuedAt)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Verified {cred.verifiedCount} {cred.verifiedCount === 1 ? 'time' : 'times'}
                    </div>
                  </div>
                </div>

                {/* Permitted Environmental & Achievement Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                    <div className="text-[10px] font-bold uppercase text-emerald-800">
                      Green Score
                    </div>
                    <div
                      className="text-2xl font-black text-[#14532D] mt-1"
                      data-testid="verified-green-score"
                    >
                      {cred.greenScore} / 100
                    </div>
                    <div className="text-[10px] text-emerald-700">Audited Index</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                    <div className="text-[10px] font-bold uppercase text-emerald-800">
                      Completed Missions
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      {cred.missionsCompleted}
                    </div>
                    <div className="text-[10px] text-emerald-700">Recorded Actions</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                    <div className="text-[10px] font-bold uppercase text-emerald-800">
                      CO2 Averted
                    </div>
                    <div className="text-2xl font-black text-[#059669] mt-1">
                      {cred.co2SavedKg} kg
                    </div>
                    <div className="text-[10px] text-emerald-700 flex items-center justify-center gap-1">
                      <TreeDeciduous className="w-3 h-3" />
                      <span>~{Math.max(1, Math.round(cred.co2SavedKg / 1.67))} Trees</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                    <div className="text-[10px] font-bold uppercase text-emerald-800">
                      Habit Streak
                    </div>
                    <div className="text-2xl font-black text-amber-700 mt-1 flex items-center justify-center gap-1">
                      <Flame className="w-5 h-5 fill-amber-500 text-amber-500" />
                      <span>{cred.streakDays}d</span>
                    </div>
                    <div className="text-[10px] text-emerald-700">Consecutive Days</div>
                  </div>
                </div>

                {/* Permitted Achievement Badges */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-700" />
                      <span>Permitted Achievement Badges</span>
                    </h3>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {cred.unlockedBadgeIds.length} Unlocked
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(BADGE_CATALOG).map(([id, badge]) => {
                      const unlocked = cred.unlockedBadgeIds.includes(id);
                      return (
                        <div
                          key={id}
                          className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                            unlocked
                              ? 'bg-white border-emerald-200 shadow-2xs'
                              : 'bg-slate-50/60 border-slate-200/60 opacity-55'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg shrink-0">
                            {unlocked ? badge.icon : <Lock className="w-4 h-4 text-slate-400" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {badge.name}
                              </span>
                              {unlocked && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              {badge.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Privacy Protection Footer */}
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between gap-3">
                  <span>
                    <strong>Privacy Protection Active:</strong> Household electricity bills (₹),
                    consumer account numbers, phone numbers, and personal addresses are never
                    exposed on public QR verification pages.
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">
                    SHA-256: {cred.tokenHashPrefix}...
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8 space-y-4">
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-1">
                  <div className="font-bold">Verification Diagnostic</div>
                  <p>
                    {data?.error ||
                      data?.reason ||
                      'No matching active passport credential was found for the provided verification token.'}
                  </p>
                  <p className="font-mono text-[11px] text-red-700 pt-1 break-all">
                    Submitted Token: {token || '(empty)'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
