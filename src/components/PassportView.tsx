import React, { useState } from 'react';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  TreeDeciduous,
  Zap,
  TrendingDown,
  DollarSign,
  Download,
  Share2,
  QrCode,
  Sparkles,
  Flame,
  Leaf,
  Calendar,
  Lock,
} from 'lucide-react';
import { AppState, calculateUserAggregates } from '../utils/storage';
import { MISSIONS_LIST } from '../data/missionsData';

interface PassportViewProps {
  appState: AppState;
}

export const PassportView: React.FC<PassportViewProps> = ({ appState }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const aggregates = calculateUserAggregates(appState);
  const { profile, streakDays, completedMissions } = appState;
  const { baselineMetrics, effectiveGreenScore, totalMissions, totalCo2SavedKg, totalInrSaved } =
    aggregates;

  const passportId = `GEDA-LIFE-GJ-2026-${(
    (profile.name.length * 7919 + profile.monthlyKwh * 13) %
    90000 + 10000
  )}`;

  const BADGE_DEFINITIONS = [
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
      unlocked: !!completedMissions['m-ac-24'],
      category: 'Cooling',
    },
    {
      id: 'vampire_slayer',
      name: 'Vampire Load Slayer',
      description: 'Eliminated idle standby consumption across residential electronics.',
      icon: '⚡',
      unlocked: !!completedMissions['m-phantom-power'],
      category: 'Efficiency',
    },
    {
      id: 'solar_advocate',
      name: 'Surya Gujarat Scout',
      description: 'Assessed terrace solar feasibility and completed roof survey.',
      icon: '☀️',
      unlocked: profile.hasSolarInstalled || !!completedMissions['m-solar-survey'],
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

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'My URJASAATHI Green Impact Passport',
          text: `I earned a Green Score of ${effectiveGreenScore}/100 and saved ${totalCo2SavedKg} kg CO2 in ${profile.district} on URJASAATHI (GEDA Mission LiFE)! Check your score today.`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(
        `I have earned a Green Score of ${effectiveGreenScore}/100 and saved ${totalCo2SavedKg} kg CO2 in ${profile.district} on URJASAATHI (GEDA Mission LiFE)!`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-500/40 text-xs font-semibold text-lime-300">
            <Award className="w-4 h-4" />
            <span>Prototype Digital Credential • Hackathon Demonstration Model</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading">
            Green Impact Passport
          </h1>
          <p className="text-sm text-emerald-100/90 leading-relaxed">
            A prototype digital sustainability credential demonstrating how verified household micro-actions,
            carbon offsets, and solar adoption can be celebrated under GEDA Mission LiFE.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-lime-300" />
            <span>Print / Save PDF</span>
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-2 transition-colors shadow-sm"
          >
            <Share2 className="w-4 h-4 text-lime-300" />
            <span>{copied ? 'Copied Link!' : 'Share Passport'}</span>
          </button>
        </div>
      </div>

      {/* Explicit Prototype Notice */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
        <span>
          <strong>Prototype Model Notice:</strong> This digital credential is an architectural demonstration model created for the GEDA Mission LiFE Hackathon. It is not an officially issued or legally stamped government certificate.
        </span>
      </div>

      {/* Main Passport Card */}
      <div className="max-w-3xl mx-auto bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-emerald-500/40 relative overflow-hidden">
        {/* Subtle Watermark emblem */}
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
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-lime-300 font-bold">
                  GEDA Mission LiFE Concept
                </span>
                <span className="text-[10px] bg-emerald-700 px-2 py-0.5 rounded text-emerald-100 font-semibold">
                  Prototype Credential
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-heading tracking-wide">
                PASSPORT TO SUSTAINABILITY
              </h2>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-emerald-700/80 sm:pl-4">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-mono">
              Passport Identification
            </div>
            <div className="text-sm font-bold font-mono text-lime-300 tracking-wider">
              {passportId}
            </div>
          </div>
        </div>

        {/* Citizen Profile Details & Status Tier */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="sm:col-span-2 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-emerald-300 text-[10px] uppercase tracking-wider">
                  Citizen / Household
                </p>
                <p className="font-bold text-white text-base mt-0.5 font-heading">
                  {profile.name}
                </p>
              </div>
              <div>
                <p className="text-emerald-300 text-[10px] uppercase tracking-wider">
                  Jurisdiction & District
                </p>
                <p className="font-bold text-white text-base mt-0.5">
                  {profile.district}, Gujarat
                </p>
              </div>
              <div>
                <p className="text-emerald-300 text-[10px] uppercase tracking-wider">
                  Household Cohort
                </p>
                <p className="font-semibold text-white mt-0.5">
                  {profile.familyMembers} Residents • {profile.city}
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
            <div className="text-xl font-bold font-heading text-white mt-1">
              {totalMissions}
            </div>
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
              Direct Money Saved
            </div>
            <div className="text-xl font-bold font-heading text-white mt-1">
              ₹{totalInrSaved}
            </div>
            <div className="text-[10px] text-emerald-400">Residential tariff offset</div>
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

        {/* Passport Footer with QR Stamp */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-emerald-700/60 pt-5 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] text-emerald-300 uppercase tracking-wider font-mono">
              Validation Protocol
            </p>
            <p className="text-xs text-emerald-100 font-medium">
              Modeled under GEDA LiFE Hackathon Guidelines • CEA Unified National Grid Ver 22.0 Baseline
            </p>
            <p className="text-[10px] text-emerald-400">
              Prototype Evaluation Model • Demonstration Concept for Gujarat
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 p-2.5 rounded-xl border border-white/20 self-start sm:self-auto shrink-0">
            <QrCode className="w-10 h-10 text-white" />
            <div className="text-[10px] font-mono text-emerald-200">
              <span className="block font-bold text-white">PROTOTYPE DEMO</span>
              HACKATHON MODEL
            </div>
          </div>
        </div>
      </div>

      {/* Badges Showcase Section */}
      <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-bold text-gray-900 font-heading text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Verified Sustainability Badges
            </h3>
            <p className="text-xs text-gray-500">
              Earn distinctive honor badges for completing Mission LiFE household milestones.
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
                <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                  {badge.description}
                </p>
                <span
                  className={`text-[10px] font-bold mt-2 inline-block ${
                    badge.unlocked ? 'text-emerald-700' : 'text-gray-400'
                  }`}
                >
                  {badge.unlocked ? '✓ Verified Unlocked' : '🔒 Locked'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
