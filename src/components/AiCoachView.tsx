import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Calendar,
  Send,
  Zap,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Award,
  ChevronRight,
  ShieldCheck,
  MessageSquare,
  Flame,
  RotateCcw,
} from 'lucide-react';
import { HouseholdProfile } from '../utils/sustainabilityMath';
import {
  generateSmartFallbackResponse,
  ResponseMode,
  QueryIntent,
  ChatMessageItem,
  insertResponseForRequest,
  buildCoachWelcomeMessage,
  getCleanProfileContext,
} from '../utils/energyMathChat';
import {
  AppState,
  getAdoptedMissionId,
  getChatStorageKeyForUser,
  getEffectiveUserId,
  isMissionCompletedToday,
  MissionCompletionResult,
} from '../utils/storage';

interface AiCoachViewProps {
  profile: HouseholdProfile;
  appState?: AppState;
  accessToken?: string | null;
  onAdoptMission?: (title: string, kwh: number, inr: number) => MissionCompletionResult | void;
}

interface CoachRecommendation {
  title: string;
  description: string;
  estimatedMonthlyKwhSaved: number;
  estimatedMonthlyInrSaved: number;
  difficulty: string;
  badge: string;
}

interface ActionPlanItem {
  day: number;
  title: string;
  task: string;
  kwhSavings: number;
  impact: string;
  focus: string;
}

type ChatMessage = ChatMessageItem;

export const AiCoachView: React.FC<AiCoachViewProps> = ({
  profile,
  appState,
  accessToken,
  onAdoptMission,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'recommendations' | 'plan'>('chat');
  const effectiveUserId = getEffectiveUserId(appState);
  const chatStorageKey = getChatStorageKeyForUser(effectiveUserId);
  const { userName: cleanName, district: cleanDistrict } = getCleanProfileContext(profile);
  const locationSuffix = cleanDistrict ? ` in ${cleanDistrict}` : '';
  const summaryHeading = cleanName
    ? `Analysis for ${cleanName}${locationSuffix}`
    : `Household Analysis${locationSuffix}`;

  // Recommendations state
  const [loadingCoach, setLoadingCoach] = useState<boolean>(false);
  const [coachData, setCoachData] = useState<{
    summary?: string;
    districtNotes?: string;
    recommendations: CoachRecommendation[];
    source?: string;
  }>({
    summary: `${summaryHeading}: Your household uses ${profile.monthlyKwh} kWh/month. Optimizing air conditioning and shifting standby loads can save up to 18-22% on your electricity bill.`,
    districtNotes: `${cleanDistrict || 'Your region'} benefits from high solar insolation (~5.2 kWh/m²/day). Participating in GEDA LiFE initiatives directly cuts peak load drawn from the Western Regional Grid.`,
    source: 'gemini_ai',
    recommendations: [
      {
        title: 'Calibrate AC to 24°C or Above (Mission LiFE Standard)',
        description: 'Set your air conditioner thermostat strictly at 24°C instead of 18°C-20°C. For every 1°C increase, compressor electricity consumption decreases by 6% in summers.',
        estimatedMonthlyKwhSaved: Math.round(profile.monthlyKwh * 0.14),
        estimatedMonthlyInrSaved: Math.round(profile.monthlyKwh * 0.14 * 6.25),
        difficulty: 'Instant',
        badge: 'Cool Champion',
      },
      {
        title: 'Adopt Surya Gujarat Rooftop Solar (PM Surya Ghar)',
        description: `With ${profile.rooftopAvailableSqFt || 300} sq.ft of terrace${locationSuffix}, you are eligible for up to ₹78,000 Central financial subsidy. This can slash your electricity bill by 75-90%.`,
        estimatedMonthlyKwhSaved: Math.round(profile.monthlyKwh * 0.75),
        estimatedMonthlyInrSaved: Math.round(profile.monthlyKwh * 0.75 * 6.25),
        difficulty: 'High Impact',
        badge: 'Surya Mitra',
      },
      {
        title: 'Zero Vampire Power (Standby Elimination Sweep)',
        description: 'Turn off wall switches for TV setups, Wi-Fi routers at bedtime, microwave oven displays, and phone chargers. Standby draws up to 8% of residential power.',
        estimatedMonthlyKwhSaved: 18,
        estimatedMonthlyInrSaved: 112,
        difficulty: 'Easy',
        badge: 'Phantom Slayer',
      },
      {
        title: 'BEE 5-Star BLDC Ceiling Fan Upgrade',
        description: 'Replacing conventional 75W induction ceiling fans with 28W brushless DC (BLDC) motors reduces fan electricity by over 60% with zero noise.',
        estimatedMonthlyKwhSaved: 35,
        estimatedMonthlyInrSaved: 218,
        difficulty: 'Medium',
        badge: 'Smart Upgrade',
      },
    ],
  });

  // 7-day plan state
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [actionPlan, setActionPlan] = useState<ActionPlanItem[]>([]);
  const [completedDays, setCompletedDays] = useState<Record<number, boolean>>({ 1: true });

  // Chat state isolated per userId
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(chatStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {
      // Fallback to initial welcome message
    }
    return [
      {
        id: 'init',
        sender: 'ai',
        text: buildCoachWelcomeMessage(profile),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: 'offline_mode',
        modeLabel: 'Offline Mode',
      },
    ];
  });
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Adopt feedback notification
  const [adoptedAlert, setAdoptedAlert] = useState<string | null>(null);

  // Reload isolated chat history whenever the active userId changes
  useEffect(() => {
    let loadedFromCache = false;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(chatStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChatMessages(parsed);
            loadedFromCache = true;
          }
        }
      }
    } catch {
      // Ignore cache read error
    }

    if (!loadedFromCache) {
      setChatMessages([
        {
          id: 'init',
          sender: 'ai',
          text: buildCoachWelcomeMessage(profile),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mode: 'offline_mode',
          modeLabel: 'Offline Mode',
        },
      ]);
    }

    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    fetch('/api/user/chat-history', {
      method: 'GET',
      credentials: 'same-origin',
      headers,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          setChatMessages(data.messages);
        }
      })
      .catch(() => {});
  }, [effectiveUserId, chatStorageKey, accessToken]);

  // Save isolated chat history per userId whenever messages change
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(chatStorageKey, JSON.stringify(chatMessages));
      }
    } catch {
      // Ignore localStorage quota error
    }
    if (chatMessages.length > 1) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      fetch('/api/user/chat-history', {
        method: 'PUT',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({ messages: chatMessages }),
      }).catch(() => {});
    }
  }, [chatMessages, chatStorageKey, accessToken]);

  // Sync welcome banner if user updates their name or district in profile settings
  useEffect(() => {
    setChatMessages((prev) =>
      prev.map((m) =>
        m.id === 'init' || m.id === 'welcome'
          ? { ...m, text: buildCoachWelcomeMessage(profile) }
          : m
      )
    );
  }, [profile.name, profile.district]);

  // Fetch coach recommendations
  const fetchCoachRecommendations = async () => {
    setLoadingCoach(true);
    try {
      const res = await fetch('/api/gemini/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      setCoachData(data);
    } catch (err) {
      console.warn('Error contacting AI coach endpoint:', err);
    } finally {
      setLoadingCoach(false);
    }
  };

  // Fetch 7-day plan
  const fetchActionPlan = async () => {
    setLoadingPlan(true);
    try {
      const res = await fetch('/api/gemini/action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (data.plan) {
        setActionPlan(data.plan);
      }
    } catch (err) {
      console.warn('Error fetching action plan:', err);
    } finally {
      setLoadingPlan(false);
    }
  };

  useEffect(() => {
    fetchCoachRecommendations();
    fetchActionPlan();
  }, [profile.monthlyKwh, profile.district]);

  // Handle chat submission
  const handleSendMessage = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery || chatInput).trim();
    if (!query || chatLoading) return;

    const clientReqId = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const userMsg: ChatMessage = {
      id: `user_${clientReqId}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reqId: clientReqId,
    };

    // Prepare multi-turn history excluding static initial welcome banners
    const priorConversation = chatMessages
      .filter((m) => m.id !== 'init' && m.id !== 'welcome')
      .slice(-8)
      .map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          profile,
          history: priorConversation,
          reqId: clientReqId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat API responded with status ${res.status}`);
      }

      const data = await res.json();
      const returnedReqId = data.reqId || clientReqId;

      // Verify response belongs to this exact originating request
      if (returnedReqId !== clientReqId) {
        throw new Error(`Mismatched response reqId: expected ${clientReqId}, got ${returnedReqId}`);
      }

      let responseText = data.response;
      let responseMode: ResponseMode = data.mode || 'gemini_ai';
      let responseModeLabel = data.modeLabel || (responseMode === 'gemini_ai' ? 'Gemini AI' : 'Smart Calculation');
      let responseIntent: QueryIntent | undefined = data.intent;

      if (!responseText) {
        const smartFallback = generateSmartFallbackResponse(query, profile, false, priorConversation);
        responseText = smartFallback.response;
        responseMode = smartFallback.mode;
        responseModeLabel = smartFallback.modeLabel;
        responseIntent = smartFallback.intent;
      }

      const aiReply: ChatMessage = {
        id: `ai_${clientReqId}`,
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: responseMode,
        modeLabel: responseModeLabel,
        reqId: clientReqId,
        intent: responseIntent,
      };
      setChatMessages((prev) => insertResponseForRequest(prev, clientReqId, aiReply));
    } catch (err) {
      console.error('Chat error, using client-side smart calculation engine:', err);
      const smartFallback = generateSmartFallbackResponse(
        query,
        profile,
        true,
        priorConversation
      );
      const fallbackReply: ChatMessage = {
        id: `ai_${clientReqId}`,
        sender: 'ai',
        text: smartFallback.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: smartFallback.mode,
        modeLabel: smartFallback.modeLabel,
        reqId: clientReqId,
        intent: smartFallback.intent,
      };
      setChatMessages((prev) => insertResponseForRequest(prev, clientReqId, fallbackReply));
    } finally {
      setChatLoading(false);
    }
  };

  const [adoptedTodayLocal, setAdoptedTodayLocal] = useState<Record<string, boolean>>({});

  const isRecommendationCompletedToday = (title: string): boolean => {
    const missionId = getAdoptedMissionId(title);
    if (appState && isMissionCompletedToday(appState, missionId)) {
      return true;
    }
    return !!adoptedTodayLocal[missionId];
  };

  const handleAdopt = (item: CoachRecommendation) => {
    const missionId = getAdoptedMissionId(item.title);
    if (isRecommendationCompletedToday(item.title)) {
      setAdoptedAlert(`"${item.title}" is already completed today. Come back tomorrow!`);
      setTimeout(() => setAdoptedAlert(null), 3500);
      return;
    }

    if (onAdoptMission) {
      const result = onAdoptMission(
        item.title,
        item.estimatedMonthlyKwhSaved,
        item.estimatedMonthlyInrSaved
      );
      setAdoptedTodayLocal((prev) => ({ ...prev, [missionId]: true }));
      if (result && result.status === 'already_completed') {
        setAdoptedAlert(result.message);
        setTimeout(() => setAdoptedAlert(null), 3500);
        return;
      }
      setAdoptedAlert(
        result?.message || `Action adopted: "${item.title}". +30 LiFE points credited!`
      );
      setTimeout(() => setAdoptedAlert(null), 3500);
      return;
    }

    setAdoptedTodayLocal((prev) => ({ ...prev, [missionId]: true }));
    setAdoptedAlert(`Action adopted: "${item.title}". LiFE points credited!`);
    setTimeout(() => setAdoptedAlert(null), 3500);
  };

  const toggleDayCompletion = (dayNum: number) => {
    setCompletedDays((prev) => ({
      ...prev,
      [dayNum]: !prev[dayNum],
    }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>UrjaGuru AI Green Coach · Gemini 3.5 Flash Powered</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              Personalized Green Energy Intelligence
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Analyzes your {profile.familyMembers}-member household{locationSuffix} consuming{' '}
              {profile.monthlyKwh} kWh/mo to generate actionable, rupee-quantified efficiency gains.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => {
                fetchCoachRecommendations();
                fetchActionPlan();
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCoach ? 'animate-spin' : ''}`} />
              Re-Analyze Profile
            </button>
          </div>
        </div>
      </div>

      {adoptedAlert && (
        <div className="p-3 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          {adoptedAlert}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('chat')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'chat'
              ? 'text-emerald-700 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          UrjaGuru AI Assistant
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'recommendations'
              ? 'text-emerald-700 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-600" />
          Personalized Recommendations
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'plan'
              ? 'text-emerald-700 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Calendar className="w-4 h-4 text-emerald-600" />
          7-Day Green Action Plan
        </button>
      </div>

      {/* TAB 1: RECOMMENDATIONS */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          {coachData?.summary && (
            <div className="p-5 rounded-2xl bg-white border border-emerald-100 shadow-xs flex flex-col md:flex-row gap-4 items-start justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" /> GEDA Mission LiFE Audit Summary
                </div>
                <p className="text-sm text-gray-800 leading-relaxed font-medium">
                  {coachData.summary}
                </p>
                {coachData.districtNotes && (
                  <p className="text-xs text-emerald-800 bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200/60 mt-2">
                    <strong>Climate &amp; Grid Context:</strong> {coachData.districtNotes}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right hidden sm:block">
                <span className="text-[10px] text-gray-400 font-mono">
                  Engine: {coachData.source === 'gemini_ai' ? 'Gemini 3.5 Flash (Live)' : 'Mission LiFE Knowledge Engine'}
                </span>
              </div>
            </div>
          )}

          {/* Recommendations Grid */}
          <div className="space-y-3">
            {loadingCoach && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between animate-pulse">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  UrjaGuru is querying Gemini 3.5 Flash for customized tariff insights...
                </span>
                <span className="text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded font-mono">
                  Live AI Syncing
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(coachData?.recommendations || []).map((rec, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {rec.badge}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          rec.difficulty === 'Instant'
                            ? 'bg-blue-100 text-blue-800'
                            : rec.difficulty === 'Easy'
                            ? 'bg-green-100 text-green-800'
                            : rec.difficulty === 'High Impact'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rec.difficulty}
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-base font-heading">
                      {rec.title}
                    </h3>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      {rec.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>~{rec.estimatedMonthlyKwhSaved} kWh/month</span>
                      </div>
                      <div className="text-[11px] text-gray-500 font-medium">
                        Saves ₹{rec.estimatedMonthlyInrSaved} on electricity bill
                      </div>
                    </div>

                    {(() => {
                      const isDoneToday = isRecommendationCompletedToday(rec.title);
                      return (
                        <button
                          onClick={() => handleAdopt(rec)}
                          disabled={isDoneToday}
                          aria-disabled={isDoneToday}
                          className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1 transition-all shadow-2xs ${
                            isDoneToday
                              ? 'bg-[#14532D] cursor-not-allowed opacity-90'
                              : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isDoneToday ? 'Completed Today' : 'Adopt Action'}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 7-DAY GREEN ACTION PLAN */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 font-heading text-base">
                Your 7-Day Sustainability Sprint
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Daily step-by-step habit checklist tailored for {cleanDistrict || 'your household'}.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                {Object.values(completedDays).filter(Boolean).length}/7 Days Complete
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {actionPlan.map((item) => {
              const isDone = !!completedDays[item.day];
              return (
                <div
                  key={item.day}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isDone
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-white border-gray-200 hover:border-emerald-200'
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    <button
                      onClick={() => toggleDayCompletion(item.day)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isDone
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                          : 'border-2 border-gray-300 text-gray-500 hover:border-emerald-500'
                      }`}
                      aria-label={`Toggle Day ${item.day}`}
                    >
                      {isDone ? '✓' : item.day}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-800">Day {item.day}</span>
                        <span className="text-[10px] text-gray-400 font-medium">•</span>
                        <span className="text-[11px] text-gray-500 font-semibold">{item.focus}</span>
                      </div>
                      <h4
                        className={`font-bold text-sm mt-0.5 ${
                          isDone ? 'line-through text-gray-500' : 'text-gray-900'
                        }`}
                      >
                        {item.title}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.task}</p>
                      <p className="text-[11px] text-emerald-700 font-medium mt-1">
                        💡 {item.impact}
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                      +{item.kwhSavings} kWh/day
                    </span>
                    <button
                      onClick={() => toggleDayCompletion(item.day)}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline mt-1"
                    >
                      {isDone ? 'Mark as Incomplete' : 'Complete Day'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ASK URJAAI CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-xs overflow-hidden flex flex-col h-[520px]">
          {/* Chat Header */}
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-xs sm:text-sm">
                  UrjaGuru Q&A Assistant
                </h3>
                <p className="text-[10px] text-gray-500">
                  Mission LiFE Knowledge Base • Gemini 3.5 Flash &amp; Smart Math Engine
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full hidden sm:inline">
                Live &amp; Context Aware
              </span>
              <button
                onClick={() => {
                  setChatMessages([
                    {
                      id: 'welcome',
                      sender: 'ai',
                      text: buildCoachWelcomeMessage(profile),
                      timestamp: 'Just now',
                      mode: 'offline_mode',
                      modeLabel: 'Offline Mode',
                    },
                  ]);
                }}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 flex items-center gap-1 transition-colors"
                title="Clear current conversation history"
              >
                <RotateCcw className="w-3 h-3 text-slate-400" />
                <span>Clear History</span>
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar (4 focused prompts) */}
          <div className="p-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-none">
            <span className="text-gray-400 font-semibold shrink-0">Try asking:</span>
            {[
              '170W gaming laptop on charger for 8 hours: how many units?',
              '200W air cooler running 10 hours daily cost in Gujarat?',
              'How much subsidy do I get for 3 kW rooftop solar?',
              'Does leaving an idle charger plugged in consume electricity?',
            ].map((promptText, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(undefined, promptText)}
                className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 rounded-md border border-gray-200 transition-colors shrink-0 font-medium"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-[85%] ${
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    msg.sender === 'user'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {msg.sender === 'user' ? 'U' : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div
                    className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-gray-100 text-gray-900 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <span className="text-[10px] text-gray-400">
                      {msg.timestamp}
                    </span>
                    {msg.sender === 'ai' && msg.mode && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold">
                        {msg.mode === 'gemini_ai' && (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 px-1.5 py-0.5 rounded">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                            Gemini AI
                          </span>
                        )}
                        {msg.mode === 'smart_calculation' && (
                          <span className="bg-teal-100 text-teal-800 border border-teal-200 inline-flex items-center gap-1 px-1.5 py-0.5 rounded">
                            <Zap className="w-2.5 h-2.5 text-teal-600" />
                            Smart Calculation
                          </span>
                        )}
                        {msg.mode === 'offline_mode' && (
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1 px-1.5 py-0.5 rounded">
                            <ShieldCheck className="w-2.5 h-2.5 text-slate-600" />
                            Offline Mode
                          </span>
                        )}
                        {msg.mode === 'unavailable' && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1 px-1.5 py-0.5 rounded">
                            <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                            Unavailable
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-2.5 max-w-[85%] mr-auto">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="p-3 bg-gray-100 text-gray-500 rounded-2xl rounded-tl-none text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  UrjaGuru is formulating scientific advice...
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Ask a question regarding energy conservation${cleanDistrict ? ` in ${cleanDistrict}` : ''}...`}
              className="flex-1 px-3.5 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
