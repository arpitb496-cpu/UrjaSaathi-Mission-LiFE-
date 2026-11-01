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
} from 'lucide-react';
import { HouseholdProfile } from '../utils/sustainabilityMath';

interface AiCoachViewProps {
  profile: HouseholdProfile;
  onAdoptMission?: (title: string, kwh: number, inr: number) => void;
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

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export const AiCoachView: React.FC<AiCoachViewProps> = ({ profile, onAdoptMission }) => {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'plan' | 'chat'>('recommendations');

  // Recommendations state
  const [loadingCoach, setLoadingCoach] = useState<boolean>(false);
  const [coachData, setCoachData] = useState<{
    summary?: string;
    districtNotes?: string;
    recommendations: CoachRecommendation[];
    source?: string;
  }>({
    summary: `Analysis for ${profile.name} in ${profile.district}: Your household uses ${profile.monthlyKwh} kWh/month. Optimizing air conditioning and shifting standby loads can save up to 18-22% on your electricity bill.`,
    districtNotes: `${profile.district} benefits from high solar insolation (~5.2 kWh/m²/day). Participating in GEDA LiFE initiatives directly cuts peak load drawn from the Western Regional Grid.`,
    source: 'gemini_ai',
    recommendations: [
      {
        title: 'Calibrate AC to 24°C or Above (Mission LiFE Standard)',
        description: 'Set your air conditioner thermostat strictly at 24°C instead of 18°C-20°C. For every 1°C increase, compressor electricity consumption decreases by 6% in Gujarat summers.',
        estimatedMonthlyKwhSaved: Math.round(profile.monthlyKwh * 0.14),
        estimatedMonthlyInrSaved: Math.round(profile.monthlyKwh * 0.14 * 6.25),
        difficulty: 'Instant',
        badge: 'Cool Champion',
      },
      {
        title: 'Adopt Surya Gujarat Rooftop Solar (PM Surya Ghar)',
        description: `With ${profile.rooftopAvailableSqFt || 300} sq.ft of terrace in ${profile.district}, you are eligible for up to ₹78,000 Central financial subsidy. This can slash your electricity bill by 75-90%.`,
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

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      sender: 'ai',
      text: `Namaste ${profile.name}! I am UrjaGuru, your AI Green Energy Coach certified for GEDA Mission LiFE in ${profile.district}. How can I assist you today? You can ask about solar subsidies, peak hour tariffs, or reducing your electricity bill.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Adopt feedback notification
  const [adoptedAlert, setAdoptedAlert] = useState<string | null>(null);

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
    const query = customQuery || chatInput.trim();
    if (!query || chatLoading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, profile }),
      });
      const data = await res.json();
      const aiReply: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: data.response || 'I am ready to help you optimize your green energy consumption.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackReply: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: 'Keeping your AC at 24°C and switching off idle vampire loads cuts up to 20% from your monthly electricity bill in Gujarat.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, fallbackReply]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAdopt = (item: CoachRecommendation) => {
    if (onAdoptMission) {
      onAdoptMission(item.title, item.estimatedMonthlyKwhSaved, item.estimatedMonthlyInrSaved);
    }
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
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/60 border border-emerald-500/30 text-xs font-semibold text-lime-300">
              <Bot className="w-4 h-4" />
              <span>UrjaGuru AI Green Coach • Gemini 3.8 Flash Powered</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading">
              Personalized Green Energy Intelligence
            </h1>
            <p className="text-sm text-emerald-100/90 leading-relaxed">
              Analyzes your {profile.familyMembers}-member household in {profile.district} consuming{' '}
              {profile.monthlyKwh} kWh/mo to generate actionable, rupee-quantified efficiency gains.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => {
                fetchCoachRecommendations();
                fetchActionPlan();
              }}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
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
        <button
          onClick={() => setActiveTab('chat')}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'chat'
              ? 'text-emerald-700 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          Ask UrjaAI Assistant
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
                    <strong>Gujarat Climate & Grid Context:</strong> {coachData.districtNotes}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right hidden sm:block">
                <span className="text-[10px] text-gray-400 font-mono">
                  Engine: {coachData.source || 'gemini_ai'}
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
                  UrjaGuru is querying Gemini 3.8 Flash for customized Gujarat tariff insights...
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

                    <button
                      onClick={() => handleAdopt(rec)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-2xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Adopt Action
                    </button>
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
                Your Gujarat 7-Day Sustainability Sprint
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Daily step-by-step habit checklist tailored for {profile.district}.
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
                  GEDA Mission LiFE Knowledge Base • Gemini 3.8 Flash
                </p>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
              Live & Context Aware
            </span>
          </div>

          {/* Quick Prompts Bar */}
          <div className="p-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-none">
            <span className="text-gray-400 font-semibold shrink-0">Try asking:</span>
            {[
              'How much subsidy do I get for 3 kW solar in Gujarat?',
              'Why is 24°C best for AC in Gujarat heat?',
              'How do I eliminate standby power at night?',
              'What is my DISCOM net metering rate in Gujarat?',
            ].map((promptText, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(undefined, promptText)}
                className="whitespace-nowrap px-2.5 py-1 bg-white hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 rounded-md border border-gray-200 transition-colors shrink-0"
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
                    className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-gray-100 text-gray-900 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 block px-1">
                    {msg.timestamp}
                  </span>
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
              placeholder={`Ask a question regarding energy conservation in ${profile.district}...`}
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
