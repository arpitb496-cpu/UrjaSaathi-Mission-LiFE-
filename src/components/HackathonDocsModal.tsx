import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Server,
  Database,
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Code,
  Check,
  Copy,
} from 'lucide-react';

interface HackathonDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HackathonDocsModal: React.FC<HackathonDocsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'api' | 'schema' | 'math' | 'roadmap'>('architecture');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const mermaidChart = `flowchart TD
    Client["React 19 + TypeScript Frontend<br/>(Tailwind CSS + Recharts + Motion)"]
    Server["Fullstack Node.js + Express Server<br/>(Port 3000)"]
    Gemini["Google Gemini 3.8 Flash API<br/>(@google/genai Server-Side)"]
    Storage["Hybrid Persistence Layer<br/>(LocalStorage Client + Optional Firestore)"]
    DISCOM["Gujarat Energy Model<br/>(UGVCL/PGVCL/DGVCL/MGVCL/Torrent)"]
    SolarEngine["PM Surya Ghar & GEDA Solar Engine<br/>(Math & Subsidy Calculator)"]

    Client -->|REST API /api/gemini/coach| Server
    Client -->|REST API /api/solar/calculate| Server
    Client -->|REST API /api/community/stats| Server
    Client <-->|Hydrate State & Progress| Storage
    Server -->|Secure System Prompt & Prompting| Gemini
    Server -->|Deterministic Grid Emission CEA: 0.82 kg| SolarEngine
    Server -->|Tariff Slabs & Insolation (~5.2 kWh/m²)| DISCOM`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <BookOpen className="w-5 h-5 text-lime-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-heading">
                URJASAATHI Technical Architecture & Documentation
              </h2>
              <p className="text-xs text-emerald-200">
                GEDA Mission LiFE Hackathon Submission Deliverable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="bg-emerald-50/70 px-6 border-b border-emerald-100 flex items-center gap-2 overflow-x-auto text-xs shrink-0 py-2">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
              activeTab === 'architecture' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Architecture & Mermaid
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
              activeTab === 'api' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            API Endpoints
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
              activeTab === 'schema' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Data Schema
          </button>
          <button
            onClick={() => setActiveTab('math')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
              activeTab === 'math' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Formulas & Calculations
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
              activeTab === 'roadmap' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Roadmap & Scalability
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed flex-1">
          {/* TAB 1: ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-heading">
                Full-Stack System Architecture Diagram
              </h3>
              <p className="text-xs text-gray-600">
                URJASAATHI implements a decoupled client-server pattern. The client communicates
                strictly through server-side proxy routes to safeguard sensitive operations and API keys.
              </p>

              {/* Code block with Mermaid representation */}
              <div className="relative bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                <button
                  onClick={() => copyToClipboard(mermaidChart)}
                  className="absolute right-3 top-3 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-lime-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy Mermaid'}
                </button>
                <pre>{mermaidChart}</pre>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-900 text-xs">Client-Side Tier</h4>
                  <p className="text-[11px] text-emerald-800 mt-1">
                    React 19 SPA, TypeScript, Tailwind CSS, Recharts analytics, and Lucide icons.
                  </p>
                </div>
                <div className="p-3 bg-teal-50 rounded-xl border border-teal-100">
                  <h4 className="font-bold text-teal-900 text-xs">Node.js Express Server</h4>
                  <p className="text-[11px] text-teal-800 mt-1">
                    Vite middleware in dev, REST APIs for Gemini, solar computations, and community stats.
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-900 text-xs">Intelligence & Data</h4>
                  <p className="text-[11px] text-blue-800 mt-1">
                    Google GenAI SDK with Gemini 3.8 Flash + deterministic CEA Western Grid emission model.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: API ENDPOINTS */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-heading">
                Backend API Endpoint Specifications
              </h3>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-bold">GET</span>
                    <span className="font-bold text-gray-900">/api/health</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1 font-sans">
                    Returns service status, timestamp, and Gemini API configuration readiness.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">POST</span>
                    <span className="font-bold text-gray-900">/api/gemini/coach</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1 font-sans">
                    Accepts <code>HouseholdProfile</code> and calls Gemini 3.8 Flash to return structured
                    personalized recommendations, kWh saved, INR saved, and district notes.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">POST</span>
                    <span className="font-bold text-gray-900">/api/gemini/action-plan</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1 font-sans">
                    Generates a customized 7-day green action plan with day-by-day micro-steps.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">POST</span>
                    <span className="font-bold text-gray-900">/api/gemini/chat</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1 font-sans">
                    Contextual conversation with UrjaGuru regarding Gujarat tariffs, solar subsidies, and energy habits.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-bold">GET</span>
                    <span className="font-bold text-gray-900">/api/community/stats</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1 font-sans">
                    Returns aggregate statistics, district rankings, champions leaderboard, and active community challenges.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SCHEMA */}
          {activeTab === 'schema' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-heading">
                Database & State Schema Models
              </h3>
              <p className="text-xs text-gray-600">
                Persistent local schema compatible with direct Firestore replication.
              </p>

              <div className="bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                <pre>{`interface HouseholdProfile {
  name: string;
  city: string;
  district: string; // One of 33 Gujarat Districts
  familyMembers: number;
  monthlyKwh: number;
  monthlyBillInr: number;
  appliances: string[]; // ['ac', 'refrigerator', ...]
  rooftopAvailableSqFt: number;
  hasSolarInstalled?: boolean;
}

interface CompletedMissionLog {
  missionId: string;
  completedAt: string; // ISO date
  points: number;
  co2SavedKg: number;
  inrSaved: number;
}

interface AppState {
  profile: HouseholdProfile;
  isOnboarded: boolean;
  completedMissions: Record<string, CompletedMissionLog>;
  streakDays: number;
  lastActiveDate: string;
  badges: string[];
}`}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: MATH */}
          {activeTab === 'math' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-900 font-heading">
                Domain Mathematical Formulas & Standards
              </h3>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <h4 className="font-bold text-emerald-900 text-xs">
                  1. CEA Version 22.0 FY 2025-26 Baseline & Custom Loss Modeling
                </h4>
                <p className="text-xs font-mono bg-white p-2 rounded border border-gray-200">
                  Default Household Baseline: 0.675 kg CO2/kWh (CEA Ver 22.0 FY 2025-26 Weighted Average)
                  Custom Delivery-Loss Estimate: 0.82 kg CO2/kWh (Derived with ~17.7% AT&C losses)
                </p>
                <p className="text-[11px] text-gray-600">
                  The application uses the official CEA Version 22.0 FY 2025-26 weighted average emission factor of <strong>0.675 kg CO2/kWh</strong> as the primary default household footprint baseline. The 0.82 kg CO2/kWh figure represents a custom delivery-loss-adjusted engineering estimate incorporating ~17.7% AT&C transmission losses and is explicitly NOT labeled as a CEA-published figure.
                </p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <h4 className="font-bold text-emerald-900 text-xs">
                  2. Solar Rooftop Generation with Explicit Performance Ratio (PR)
                </h4>
                <p className="text-xs font-mono bg-white p-2 rounded border border-gray-200">
                  Daily Yield (kWh/kW) = 5.2 PSH/day × PR [PR = 1 - (Losses% / 100)] = 5.2 × 0.825 = 4.29 kWh/kW/day
                  Monthly Generation ≈ Capacity (kW) × 130 kWh/month (~1560 kWh/kW/year)
                </p>
                <p className="text-[11px] text-gray-600">
                  Includes an explicit, user-configurable system loss model (default: 17.5% covering dust/soiling 4%, temperature derating 8.5%, cabling 2%, and inverter 3%, yielding PR = 0.825).
                </p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <h4 className="font-bold text-emerald-900 text-xs">
                  3. PM Surya Ghar Muft Bijli Yojana Central Financial Assistance (CFA)
                </h4>
                <ul className="list-disc pl-5 text-xs space-y-1">
                  <li><strong>1 kW PV:</strong> ₹30,000 Central Financial Assistance</li>
                  <li><strong>2 kW PV:</strong> ₹60,000 Central Financial Assistance (₹30,000/kW)</li>
                  <li><strong>3 kW & Above:</strong> Flat ₹78,000 Central Financial Assistance (Maximum single-residence cap)</li>
                </ul>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <h4 className="font-bold text-emerald-900 text-xs">
                  4. GERC GIDRES Regulations, 2026 (Notified 30 October 2026)
                </h4>
                <p className="text-xs font-mono bg-white p-2 rounded border border-gray-200">
                  Surplus Net-Metering Injection Compensation: ₹2.25/kWh (Fixed Regulatory Feed-in Tariff)
                </p>
                <p className="text-[11px] text-gray-600">
                  Under the GERC (Grid Interactive Distributed Renewable Energy Sources) Regulations, 2026, notified on 30 October 2026, surplus energy injected into the grid is compensated by Gujarat DISCOMs at ₹2.25/kWh. This regulatory feed-in compensation is expressly distinguished from the utility-wide bulk Average Power Purchase Cost (APPC).
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: ROADMAP */}
          {activeTab === 'roadmap' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-900 font-heading">
                Scalability Considerations & Future Roadmap
              </h3>

              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <h4 className="font-bold text-emerald-950 text-xs">
                    Phase 1: GEDA Smart Meter Integration (AMI)
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-1">
                    Direct API handshake with Gujarat DISCOM Smart Prepaid Meters (UGVCL, PGVCL, DGVCL, MGVCL) for 15-minute interval automated load disaggregation.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
                  <h4 className="font-bold text-teal-950 text-xs">
                    Phase 2: Automated DBT & Rooftop Solar Fast-Track
                  </h4>
                  <p className="text-[11px] text-teal-800 mt-1">
                    Instant one-click digital application submission to the PM Surya Ghar National Portal and GEDA verified vendor matching.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <h4 className="font-bold text-blue-950 text-xs">
                    Phase 3: Gujarati Language & Voice-First UrjaGuru
                  </h4>
                  <p className="text-[11px] text-blue-800 mt-1">
                    Native Gujarati audio chat integration via Gemini Live audio streaming to empower rural farmers and senior citizens across Saurashtra and North Gujarat.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-500">
            URJASAATHI • GEDA Mission LiFE Hackathon Edition
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
