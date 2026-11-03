import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Share2,
  Sparkles,
  Leaf,
  Lock,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
  Ban,
} from 'lucide-react';
import { AppState, calculateUserAggregates, hasEverCompletedMission } from '../utils/storage';
import { MISSIONS_LIST } from '../data/missionsData';
import {
  PROTOTYPE_PASSPORT_DISCLAIMER,
  PASSPORT_REPORT_FILENAME,
  generateGreenPassportPdf,
  generateQrCodeDataUrl,
  resolveVerificationBaseUrl,
  triggerBrowserPdfDownload,
  formatIstDate,
  PassportBadgeItem,
} from '../utils/pdfGenerator';

interface PassportViewProps {
  appState: AppState;
  accessToken?: string | null;
  onOpenVerificationToken?: (token: string) => void;
}

export const PassportView: React.FC<PassportViewProps> = ({
  appState,
  accessToken,
  onOpenVerificationToken,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [publicDisplayConsent, setPublicDisplayConsent] = useState<boolean>(true);
  const [credentialRecord, setCredentialRecord] = useState<{
    credential_id: string;
    payload_hash: string;
    qr_verification_path: string;
    verified_count: number;
    status: 'active' | 'revoked';
    issued_at: string;
  } | null>(null);
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [verificationUrl, setVerificationUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [persistenceInfo, setPersistenceInfo] = useState<{
    persistenceMode: 'supabase_postgres' | 'local_demo_fallback';
    durableStorageAvailable: boolean;
  }>({
    persistenceMode: appState.persistenceMode || 'local_demo_fallback',
    durableStorageAvailable: Boolean(appState.durableStorageAvailable),
  });

  const [pdfDownloadState, setPdfDownloadState] = useState<{
    downloading: boolean;
    error: string | null;
    successMessage: string | null;
  }>({
    downloading: false,
    error: null,
    successMessage: null,
  });

  const [qrVerificationStatus, setQrVerificationStatus] = useState<{
    checking: boolean;
    verified?: boolean;
    verificationState?: string;
    persistenceMode?: string;
    message?: string;
  }>({ checking: false });

  const aggregates = calculateUserAggregates(appState);
  const { profile, streakDays } = appState;
  const { baselineMetrics, effectiveGreenScore, totalMissions, totalCo2SavedKg, totalInrSaved } =
    aggregates;

  const fallbackPassportId = `GEDA-LIFE-2026-${
    ((profile.name.length * 7919 + profile.monthlyKwh * 13) % 90000) + 10000
  }`;
  const passportId = credentialRecord?.credential_id || fallbackPassportId;
  const issueDateStr = formatIstDate(credentialRecord?.issued_at || new Date());

  const BADGE_DEFINITIONS: Array<PassportBadgeItem & { icon: string }> = [
    {
      id: 'pioneer',
      name: 'Mission LiFE Pioneer',
      description: 'Completed onboarding and established your household carbon baseline.',
      icon: '🌱',
      unlocked: true,
      category: 'Foundation',
    },
    {
      id: 'ac_master',
      name: 'AC 24°C Maestro',
      description: 'Maintained air conditioner at 24°C during peak Gujarat afternoons.',
      icon: '❄️',
      unlocked: hasEverCompletedMission(appState, 'm-ac-24'),
      category: 'Cooling',
    },
    {
      id: 'vampire_slayer',
      name: 'Vampire Load Slayer',
      description: 'Eliminated idle standby consumption across residential electronics.',
      icon: '⚡',
      unlocked: hasEverCompletedMission(appState, 'm-phantom-power'),
      category: 'Efficiency',
    },
    {
      id: 'solar_advocate',
      name: 'Surya Gujarat Scout',
      description: 'Assessed terrace solar feasibility and completed roof survey.',
      icon: '☀️',
      unlocked: profile.hasSolarInstalled || hasEverCompletedMission(appState, 'm-solar-survey'),
      category: 'Solar',
    },
    {
      id: 'streak_master',
      name: '7-Day Habit Champion',
      description: 'Maintained an unbroken sustainability streak for 7 consecutive days.',
      icon: '🔥',
      unlocked: streakDays >= 7,
      category: 'Streak',
    },
    {
      id: 'carbon_guardian',
      name: '100 kg CO2 Guardian',
      description: 'Averted over 100 kg of coal-fired grid emissions through daily habits.',
      icon: '🛡️',
      unlocked: totalCo2SavedKg >= 100,
      category: 'Impact',
    },
  ];

  const unlockedBadgeIds = BADGE_DEFINITIONS.filter((b) => b.unlocked).map((b) => b.id);
  const unlockedBadgeIdsKey = unlockedBadgeIds.join(',');

  const completedMissionTitles = Object.values(appState.completedMissions || {})
    .map((log) => {
      const found = MISSIONS_LIST.find((m) => m.id === log.missionId);
      return found ? found.title : log.missionId;
    })
    .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i);

  const syncCredentialWithServer = useCallback(
    async (opts?: {
      consentOverride?: boolean;
      rotateToken?: boolean;
      statusOverride?: 'active' | 'revoked';
    }) => {
      try {
        const endpoint =
          opts?.statusOverride || opts?.rotateToken !== undefined || opts?.consentOverride !== undefined
            ? '/api/passport/credentials/status'
            : '/api/passport/credentials/issue';

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers,
          body: JSON.stringify({
            holderName: profile.name || 'Household Citizen',
            district: profile.district || 'Gujarat',
            greenScore: effectiveGreenScore,
            publicDisplayConsent:
              opts?.consentOverride !== undefined ? opts.consentOverride : publicDisplayConsent,
            unlockedBadgeIds,
            rotateToken: Boolean(opts?.rotateToken),
            status: opts?.statusOverride,
          }),
        });

        if (!res.ok) return;
        const data = await res.json();
        if (data?.credential) {
          setCredentialRecord(data.credential);
        }
        if (typeof data?.publicDisplayConsent === 'boolean') {
          setPublicDisplayConsent(data.publicDisplayConsent);
        }
        if (typeof data?.verificationToken === 'string' && data.verificationToken) {
          setVerificationToken(data.verificationToken);
        }
        if (typeof data?.verificationUrl === 'string' && data.verificationUrl) {
          setVerificationUrl(data.verificationUrl);
        }
        if (typeof data?.qrDataUrl === 'string' && data.qrDataUrl) {
          setQrDataUrl(data.qrDataUrl);
        }
        if (data?.persistenceMode) {
          setPersistenceInfo({
            persistenceMode: data.persistenceMode,
            durableStorageAvailable: Boolean(data.durableStorageAvailable),
          });
        }
      } catch {
        // Fallback client-side QR generation if offline
        const base = resolveVerificationBaseUrl({
          browserOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
        });
        const fallbackUrl = `${base}/verify/${encodeURIComponent(fallbackPassportId)}`;
        setVerificationUrl(fallbackUrl);
        generateQrCodeDataUrl(fallbackUrl)
          .then((url) => setQrDataUrl(url))
          .catch(() => {});
      }
    },
    [
      profile.name,
      profile.district,
      effectiveGreenScore,
      publicDisplayConsent,
      unlockedBadgeIdsKey,
      fallbackPassportId,
      accessToken,
    ]
  );

  useEffect(() => {
    syncCredentialWithServer();
  }, [syncCredentialWithServer]);

  const handleDownloadPassportPdf = async () => {
    setPdfDownloadState({ downloading: true, error: null, successMessage: null });
    try {
      const effectiveUrl =
        verificationUrl ||
        `${resolveVerificationBaseUrl({
          browserOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
        })}/verify/${encodeURIComponent(verificationToken || passportId)}`;

      const pdfBytes = await generateGreenPassportPdf({
        holderName: profile.name || 'Household Citizen',
        publicDisplayConsent,
        passportId,
        district: profile.district || 'Gujarat',
        greenScore: effectiveGreenScore,
        tierName: baselineMetrics.tier.name,
        completedMissionsCount: totalMissions,
        completedMissionTitles,
        co2SavedKg: totalCo2SavedKg,
        treeEquivalent: Math.max(1, Math.round(totalCo2SavedKg / 1.67)),
        streakDays,
        badges: BADGE_DEFINITIONS,
        issueDate: credentialRecord?.issued_at || new Date(),
        verificationUrl: effectiveUrl,
        persistenceMode: persistenceInfo.persistenceMode,
        durableStorageAvailable: persistenceInfo.durableStorageAvailable,
        credentialStatus: credentialRecord?.status || 'active',
      });

      const downloadResult = triggerBrowserPdfDownload(pdfBytes, PASSPORT_REPORT_FILENAME);
      setPdfDownloadState({
        downloading: false,
        error: null,
        successMessage: `Downloaded ${downloadResult.filename} (${(
          downloadResult.sizeBytes / 1024
        ).toFixed(1)} KB)`,
      });
    } catch (err: any) {
      setPdfDownloadState({
        downloading: false,
        error: err?.message || 'Failed to generate Green Impact Passport PDF.',
        successMessage: null,
      });
    }
  };

  const handleVerifyQrCredential = async () => {
    const tokenOrId = verificationToken || credentialRecord?.credential_id || passportId;
    if (!tokenOrId) return;
    setQrVerificationStatus({ checking: true });
    try {
      const res = await fetch(`/api/passport/verify/${encodeURIComponent(tokenOrId)}`, {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (res.ok && data.verified && data.publicCredential) {
        setCredentialRecord((prev) =>
          prev
            ? {
                ...prev,
                verified_count: data.publicCredential.verifiedCount,
                status: data.publicCredential.credentialStatus,
              }
            : prev
        );
        setQrVerificationStatus({
          checking: false,
          verified: true,
          verificationState: data.verificationState,
          persistenceMode: data.persistenceMode,
          message: `Verified (${data.persistenceMode}) · SHA-256: ${data.publicCredential.tokenHashPrefix}... · Checks: ${data.publicCredential.verifiedCount}`,
        });
      } else {
        setQrVerificationStatus({
          checking: false,
          verified: false,
          verificationState: data.verificationState,
          message: data.error || data.reason || 'Credential verification rejected',
        });
      }
    } catch {
      setQrVerificationStatus({
        checking: false,
        verified: false,
        message: 'Could not reach verification endpoint',
      });
    }
  };

  const handleToggleConsent = async () => {
    const nextConsent = !publicDisplayConsent;
    setPublicDisplayConsent(nextConsent);
    await syncCredentialWithServer({ consentOverride: nextConsent });
  };

  const handleToggleRevoke = async () => {
    const nextStatus = credentialRecord?.status === 'revoked' ? 'active' : 'revoked';
    await syncCredentialWithServer({ statusOverride: nextStatus });
    setQrVerificationStatus({
      checking: false,
      verified: nextStatus === 'active',
      message:
        nextStatus === 'revoked'
          ? 'Credential revoked. Public QR scans will now display REVOKED status.'
          : 'Credential reactivated. Public QR scans will now verify as ACTIVE.',
    });
  };

  const handleRotateToken = async () => {
    await syncCredentialWithServer({ rotateToken: true, statusOverride: 'active' });
    setQrVerificationStatus({
      checking: false,
      verified: true,
      message: 'New cryptographic verification token generated and QR updated.',
    });
  };

  const handleOpenPublicVerificationPage = () => {
    const tokenTarget = verificationToken || passportId;
    if (onOpenVerificationToken) {
      onOpenVerificationToken(tokenTarget);
      return;
    }
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/verify/${encodeURIComponent(tokenTarget)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const handleShare = () => {
    const shareTargetUrl = verificationUrl || window.location.href;
    if (navigator.share) {
      navigator
        .share({
          title: 'My URJASAATHI Green Impact Passport',
          text: `I earned a Green Score of ${effectiveGreenScore}/100 and saved ${totalCo2SavedKg} kg CO2 in ${profile.district} on URJASAATHI! Verify at: ${shareTargetUrl}`,
          url: shareTargetUrl,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareTargetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-12" data-testid="passport-view">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-[#059669]" />
            <span>
              {persistenceInfo.durableStorageAvailable
                ? 'Durable Server Credential · Supabase PostgreSQL Active'
                : 'Demo Credential Mode · Local Storage Fallback'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
            Green Impact Passport
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Download your verifiable digital sustainability passport PDF or scan the cryptographic QR
            code to inspect your public verification record.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            type="button"
            data-testid="download-passport-pdf-btn"
            onClick={handleDownloadPassportPdf}
            disabled={pdfDownloadState.downloading}
            className="px-4 py-2.5 rounded-xl bg-[#14532D] hover:bg-emerald-900 disabled:opacity-60 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            {pdfDownloadState.downloading ? (
              <RefreshCw className="w-4 h-4 text-[#A3E635] animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-[#A3E635]" />
            )}
            <span>
              {pdfDownloadState.downloading
                ? 'Generating Passport PDF...'
                : 'Download Passport PDF'}
            </span>
          </button>

          <button
            type="button"
            data-testid="open-public-verification-btn"
            onClick={handleOpenPublicVerificationPage}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
            <span>Open Verification Page</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-[#059669]" />
            <span>{copied ? 'Copied Verification URL!' : 'Copy Verification Link'}</span>
          </button>
        </div>
      </div>

      {/* PDF Download Status Feedback */}
      {(pdfDownloadState.successMessage || pdfDownloadState.error) && (
        <div
          data-testid="passport-pdf-status"
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            pdfDownloadState.error
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{pdfDownloadState.error || pdfDownloadState.successMessage}</span>
          </div>
          <span className="font-mono text-[11px] opacity-80">application/pdf</span>
        </div>
      )}

      {/* Mandatory Exact Prototype Disclosure */}
      <div
        data-testid="passport-prototype-disclaimer"
        className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5"
      >
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-amber-900 mb-0.5">Prototype Credential Disclosure:</strong>
          <span>{PROTOTYPE_PASSPORT_DISCLAIMER}</span>
        </div>
      </div>

      {/* Demo Storage Notice when persistent database is not configured */}
      {!persistenceInfo.durableStorageAvailable && (
        <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-800">
          <strong>Demo Credential Status:</strong> Persistent cloud database storage is not active in
          this session. This passport is clearly identified as a <strong>Demo Credential</strong>{' '}
          until persistent production storage is configured.
        </div>
      )}

      {/* Main Passport Card */}
      <div className="max-w-4xl mx-auto bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-emerald-500/40 relative overflow-hidden">
        <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none">
          <Leaf className="w-96 h-96 text-white" />
        </div>

        {/* Passport Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-emerald-600/60 pb-5 mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-500 p-0.5 shadow-md">
              <div className="w-full h-full bg-emerald-950 rounded-2xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-lime-300" />
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-lime-300 font-bold">
                  URJASAATHI · GEDA Mission LiFE
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    credentialRecord?.status === 'revoked'
                      ? 'bg-red-500/30 text-red-200 border border-red-400/40'
                      : persistenceInfo.durableStorageAvailable
                      ? 'bg-emerald-700 text-emerald-100'
                      : 'bg-amber-400/25 text-amber-200 border border-amber-300/40'
                  }`}
                >
                  {credentialRecord?.status === 'revoked'
                    ? 'Revoked Credential'
                    : qrVerificationStatus.verified
                    ? 'Verified'
                    : persistenceInfo.durableStorageAvailable
                    ? 'Server-Persisted Credential'
                    : 'Demo Credential'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-heading tracking-wide mt-0.5">
                GREEN IMPACT PASSPORT
              </h2>
            </div>
          </div>

          <div className="text-left sm:text-right sm:border-l sm:border-emerald-700/80 sm:pl-4">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-mono">
              Unique Passport ID
            </div>
            <div
              className="text-sm font-bold font-mono text-lime-300 tracking-wider"
              data-testid="passport-unique-id"
            >
              {passportId}
            </div>
            <div className="text-[10px] text-emerald-200 mt-0.5">Issued: {issueDateStr}</div>
          </div>
        </div>

        {/* Citizen Profile Details & Status Tier */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="sm:col-span-2 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-emerald-300 text-[10px] uppercase tracking-wider">
                  Passport Holder Name
                </p>
                <p
                  className="font-bold text-white text-base mt-0.5 font-heading"
                  data-testid="passport-holder-name"
                >
                  {profile.name || 'Household Citizen'}
                </p>
                <span className="text-[10px] text-emerald-300">
                  {publicDisplayConsent
                    ? 'Publicly visible on QR verification'
                    : 'Anonymized on public QR scan'}
                </span>
              </div>
              <div>
                <p className="text-emerald-300 text-[10px] uppercase tracking-wider">
                  Jurisdiction &amp; District
                </p>
                <p className="font-bold text-white text-base mt-0.5">
                  {profile.district ? `${profile.district}, Gujarat` : 'Gujarat, India'}
                </p>
              </div>
              <div>
                <p className="text-emerald-300 text-[10px] uppercase tracking-wider">
                  Household Cohort
                </p>
                <p className="font-semibold text-white mt-0.5">
                  {profile.familyMembers} Residents{profile.city ? ` • ${profile.city}` : ''}
                </p>
              </div>
              <div>
                <p className="text-emerald-300 text-[10px] uppercase tracking-wider">
                  Solar Readiness
                </p>
                <p className="font-semibold text-lime-300 mt-0.5">
                  {profile.hasSolarInstalled
                    ? 'Active Grid-Tied PV'
                    : `${profile.rooftopAvailableSqFt} sq.ft Terrace`}
                </p>
              </div>
            </div>
          </div>

          {/* Tier Medal */}
          <div className="bg-emerald-950/60 rounded-2xl p-4 border border-emerald-500/30 text-center flex flex-col items-center justify-center">
            <div className="text-3xl mb-1">{baselineMetrics.tier.badge}</div>
            <div className="text-xs font-bold text-lime-300 uppercase tracking-wider font-heading">
              {baselineMetrics.tier.name.split('(')[0]}
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              {baselineMetrics.tier.titleGujarati}
            </div>
            <div className="text-[11px] text-emerald-200 mt-1 font-mono">
              Score: <strong className="text-white text-sm">{effectiveGreenScore}</strong>/100
            </div>
          </div>
        </div>

        {/* 4 Quantified Impact Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-950/70 p-4 rounded-2xl border border-emerald-500/30 mb-8 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
              Missions Completed
            </div>
            <div className="text-xl font-bold font-heading text-white mt-1">{totalMissions}</div>
            <div className="text-[10px] text-emerald-400">{streakDays}d active streak</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
              CO2 Eliminated
            </div>
            <div className="text-xl font-bold font-heading text-lime-300 mt-1">
              {totalCo2SavedKg} kg
            </div>
            <div className="text-[10px] text-emerald-400">CEA Western Grid</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
              Estimated Bill Offset
            </div>
            <div className="text-xl font-bold font-heading text-white mt-1">₹{totalInrSaved}</div>
            <div className="text-[10px] text-emerald-400">Private to holder only</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
              Tree Offset Factor
            </div>
            <div className="text-xl font-bold font-heading text-lime-300 mt-1">
              {Math.max(1, Math.round(totalCo2SavedKg / 1.67))} Trees
            </div>
            <div className="text-[10px] text-emerald-400">Annual equivalence</div>
          </div>
        </div>

        {/* Passport Footer with Real Scannable QR Code & Verification Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-t border-emerald-700/60 pt-6 gap-6">
          <div className="space-y-2.5 flex-1 min-w-0">
            <p className="text-[10px] text-emerald-300 uppercase tracking-wider font-mono">
              Cryptographic QR Verification · SHA-256 Token Hash Ledger
            </p>
            <p className="text-xs text-emerald-100 leading-relaxed">
              Scan the QR code with any phone camera to open the public verification page. Private
              household bills and phone numbers are never exposed on the public verification record.
            </p>

            {verificationUrl && (
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-700/70 text-[11px] font-mono text-lime-300 break-all">
                <span className="text-emerald-400 select-none">Verification URL: </span>
                <span data-testid="passport-verification-url">{verificationUrl}</span>
              </div>
            )}

            {/* Interactive Controls: Consent, Verify, Rotate, Revoke */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                data-testid="verify-qr-record-btn"
                onClick={handleVerifyQrCredential}
                disabled={qrVerificationStatus.checking}
                className="px-3 py-1.5 rounded-lg bg-lime-400/20 hover:bg-lime-400/30 border border-lime-300/40 text-lime-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{qrVerificationStatus.checking ? 'Verifying...' : 'Verify QR Record'}</span>
              </button>

              <button
                type="button"
                data-testid="toggle-public-consent-btn"
                onClick={handleToggleConsent}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {publicDisplayConsent ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-lime-300" />
                    <span>Public Name: Shown</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                    <span>Public Name: Hidden</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="rotate-qr-token-btn"
                onClick={handleRotateToken}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-emerald-100 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rotate Token</span>
              </button>

              <button
                type="button"
                data-testid="toggle-revoke-passport-btn"
                onClick={handleToggleRevoke}
                className={`px-3 py-1.5 rounded-lg border font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  credentialRecord?.status === 'revoked'
                    ? 'bg-emerald-500/30 hover:bg-emerald-500/40 border-emerald-300/50 text-lime-200'
                    : 'bg-red-500/20 hover:bg-red-500/30 border-red-400/40 text-red-200'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>
                  {credentialRecord?.status === 'revoked'
                    ? 'Restore Credential'
                    : 'Revoke Credential'}
                </span>
              </button>
            </div>

            {qrVerificationStatus.message && (
              <p
                data-testid="qr-verification-feedback"
                className={`text-xs font-semibold pt-1 ${
                  qrVerificationStatus.verified ? 'text-lime-300' : 'text-amber-300'
                }`}
              >
                {qrVerificationStatus.verified ? '✓ ' : '⚠ '}
                {qrVerificationStatus.message}
              </p>
            )}
          </div>

          {/* Genuine Generated QR Code Image */}
          <div className="flex flex-col items-center bg-white text-slate-900 p-3.5 rounded-2xl shadow-lg border-2 border-lime-300/60 self-start md:self-auto shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Verification QR Code for Passport ${passportId}`}
                data-testid="passport-qr-image"
                className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
              />
            ) : (
              <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center bg-slate-100 rounded-lg text-xs text-slate-500">
                Generating QR...
              </div>
            )}
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#14532D] mt-2">
              Scan to Verify
            </span>
            <span className="text-[9px] font-mono text-slate-500">{passportId}</span>
          </div>
        </div>
      </div>

      {/* Badges Showcase Section */}
      <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-bold text-gray-900 font-heading text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              {qrVerificationStatus.verified
                ? 'Verified Sustainability Badges'
                : 'Recorded Sustainability Badges'}
            </h3>
            <p className="text-xs text-gray-500">
              Included in your downloadable Passport PDF and public verification page.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
            {BADGE_DEFINITIONS.filter((b) => b.unlocked).length}/{BADGE_DEFINITIONS.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {BADGE_DEFINITIONS.map((badge) => (
            <div
              key={badge.id}
              className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                badge.unlocked
                  ? 'bg-emerald-50/70 border-emerald-200 shadow-2xs'
                  : 'bg-gray-50/70 border-gray-200 opacity-60'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                  badge.unlocked
                    ? 'bg-white shadow-xs border border-emerald-200'
                    : 'bg-gray-200 border border-gray-300'
                }`}
              >
                {badge.unlocked ? badge.icon : <Lock className="w-5 h-5 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-900 truncate">{badge.name}</h4>
                  <span className="text-[9px] uppercase font-bold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                    {badge.category}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1 leading-snug">{badge.description}</p>
                <span
                  className={`text-[10px] font-bold mt-2 inline-block ${
                    badge.unlocked ? 'text-emerald-700' : 'text-gray-400'
                  }`}
                >
                  {badge.unlocked
                    ? qrVerificationStatus.verified
                      ? '✓ Verified'
                      : '✓ Unlocked'
                    : '🔒 Locked'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
