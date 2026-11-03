import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  calculateSolarFeasibility,
  calculateSustainabilityMetrics,
  HouseholdProfile,
  GUJARAT_DISTRICTS,
} from './src/utils/sustainabilityMath';
import {
  generateSmartFallbackResponse,
  calculateApplianceConsumption,
  extractWattageFromQuery,
  extractHoursFromQuery,
  detectQueryIntent,
  getCurrentDateInIndia,
  getCleanProfileContext,
  GUJARAT_AVG_TARIFF_INR_PER_KWH,
} from './src/utils/energyMathChat';
import {
  DurablePersistenceEngine,
  getPersistenceStatus,
  verifyServerUserIdentity,
} from './src/db/supabasePersistence.ts';
import {
  generateSolarFeasibilityPdf,
  generateGreenPassportPdf,
  generateQrCodeDataUrl,
  resolveVerificationBaseUrl,
  PROTOTYPE_PASSPORT_DISCLAIMER,
  SOLAR_REPORT_FILENAME,
  PASSPORT_REPORT_FILENAME,
} from './src/utils/pdfGenerator.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Initialize server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Valid Gemini models verified against project API key availability
const GEMINI_CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
] as const;

// Helper to safeguard external AI requests with bounded timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 12000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

// Helper that attempts configured Gemini models sequentially if the primary model experiences 503/404/overload
async function generateGeminiContentWithFallback(params: {
  contents: any;
  config?: any;
  timeoutMs?: number;
}): Promise<{ text: string; modelUsed: string }> {
  if (!ai) {
    throw new Error('Gemini client not initialized (missing GEMINI_API_KEY)');
  }
  const errors: string[] = [];
  for (const modelName of GEMINI_CANDIDATE_MODELS) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        }),
        params.timeoutMs ?? 9000
      );
      const text = response.text?.trim() || '';
      if (text) {
        return { text, modelUsed: modelName };
      }
      errors.push(`${modelName}: empty response`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      errors.push(`${modelName}: ${msg.slice(0, 140)}`);
      if (msg.includes('API_KEY_INVALID') || msg.includes('401')) {
        throw err;
      }
    }
  }
  throw new Error(`All candidate Gemini models failed: ${errors.join(' | ')}`);
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const persistence = getPersistenceStatus();
  res.json({
    status: 'ok',
    appName: 'URJASAATHI',
    version: '1.0.0',
    geminiConfigured: !!apiKey,
    primaryModel: GEMINI_CANDIDATE_MODELS[0],
    candidateModels: GEMINI_CANDIDATE_MODELS,
    persistenceMode: persistence.persistenceMode,
    supabaseConfigured: persistence.supabaseConfigured,
    durableStorageAvailable: persistence.durableStorageAvailable,
    persistenceNotice: persistence.persistenceNotice,
    persistenceWarning: persistence.persistenceWarning,
    timestamp: new Date().toISOString(),
  });
});

// Calculate Solar Feasibility
app.post('/api/solar/calculate', (req: Request, res: Response) => {
  try {
    const { monthlyKwh, rooftopAreaSqFt, district, monthlyBillInr, unitRateInr, hasBatteryBackup } = req.body;
    const result = calculateSolarFeasibility({
      monthlyKwh: Number(monthlyKwh) || 200,
      rooftopAreaSqFt: Number(rooftopAreaSqFt) || 0,
      district: district || 'Ahmedabad',
      monthlyBillInr: Number(monthlyBillInr) || 1500,
      unitRateInr: Number(unitRateInr) || 6.25,
      hasBatteryBackup: !!hasBatteryBackup,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error calculating solar feasibility:', error);
    res.status(400).json({ success: false, error: 'Invalid input parameters' });
  }
});

// Fallback recommendations if Gemini is unavailable
function getRuleBasedCoachAdvice(profile: HouseholdProfile) {
  const metrics = calculateSustainabilityMetrics(profile);
  const appliances = profile.appliances || [];
  const { userName, district } = getCleanProfileContext(profile);
  const locationLabel = district ? ` in ${district}` : '';
  const subjectLabel = userName ? `Analysis for ${userName}${locationLabel}` : `Household Analysis${locationLabel}`;

  const tips = [];

  if (appliances.includes('ac')) {
    tips.push({
      title: 'Optimal AC Setpoint (Mission LiFE Standard)',
      description:
        'Set your Air Conditioner thermostat strictly at 24°C instead of 18°C-20°C. For every 1°C increase, compressor electricity consumption decreases by 6%.',
      estimatedMonthlyKwhSaved: Math.round(profile.monthlyKwh * 0.12),
      estimatedMonthlyInrSaved: Math.round(profile.monthlyKwh * 0.12 * 6.25),
      difficulty: 'Easy',
      badge: 'Cool saver',
    });
  }

  if (profile.rooftopAvailableSqFt >= 150 && !profile.hasSolarInstalled) {
    tips.push({
      title: 'Adopt Surya Gujarat / PM Surya Ghar Rooftop Solar',
      description: `With ${profile.rooftopAvailableSqFt} sq.ft of terrace${locationLabel}, you are eligible for up to ₹78,000 Central financial subsidy. This can slash your electricity bill by 75-90%.`,
      estimatedMonthlyKwhSaved: Math.round(profile.monthlyKwh * 0.75),
      estimatedMonthlyInrSaved: Math.round(profile.monthlyKwh * 0.75 * 6.25),
      difficulty: 'High Impact',
      badge: 'Solar Hero',
    });
  }

  if (appliances.includes('geyser')) {
    tips.push({
      title: 'Smart Geyser Operation & Pre-Heating',
      description:
        'Keep water heater on for only 15-20 minutes prior to bathing rather than leaving it on continuous thermostat cycle. Better yet, install solar water heating backed by GEDA.',
      estimatedMonthlyKwhSaved: 25,
      estimatedMonthlyInrSaved: Math.round(25 * 6.25),
      difficulty: 'Easy',
      badge: 'Thermal efficiency',
    });
  }

  tips.push({
    title: 'Zero Vampire Power (Standby Elimination)',
    description:
      'Turn off entertainment consoles, Wi-Fi routers at night, microwave displays, and phone chargers at the master switch. Standby draws up to 8% of residential power.',
    estimatedMonthlyKwhSaved: 18,
    estimatedMonthlyInrSaved: Math.round(18 * 6.25),
    difficulty: 'Instant',
    badge: 'Ghost Buster',
  });

  tips.push({
    title: 'BEE 5-Star BLDC Fan Upgrade',
    description:
      'Replacing 3 conventional 75W induction ceiling fans with 28W brushless DC (BLDC) fans saves over 60% fan electricity in hot weather.',
    estimatedMonthlyKwhSaved: 35,
    estimatedMonthlyInrSaved: Math.round(35 * 6.25),
    difficulty: 'Medium',
    badge: 'Smart Upgrade',
  });

  return {
    summary: `${subjectLabel}: Your household uses ${profile.monthlyKwh} kWh/month (${metrics.perCapitaKwh} kWh per capita). You can potentially save ~${metrics.potentialMonthlySavingKwh} kWh and ₹${metrics.potentialMonthlySavingInr} every month through Mission LiFE habits.`,
    greenScore: metrics.greenScore,
    tier: metrics.tier.name,
    districtNotes: `${district || 'Your region'} enjoys high solar irradiance (~5.2 kWh/m²/day). Participating in GEDA LiFE initiatives directly offsets the Western Grid fossil generation.`,
    recommendations: tips,
  };
}

// AI Green Coach Endpoint
app.post('/api/gemini/coach', async (req: Request, res: Response) => {
  const profile: HouseholdProfile = req.body.profile;

  if (!profile || !profile.monthlyKwh) {
    res.status(400).json({ error: 'Household profile is required' });
    return;
  }

  // If Gemini is not configured, send rule-based recommendations
  if (!ai) {
    const fallback = getRuleBasedCoachAdvice(profile);
    res.json({ source: 'local_engine', ...fallback });
    return;
  }

  try {
    const { userName, district } = getCleanProfileContext(profile);
    const prompt = `You are UrjaGuru, the AI Green Energy Coach for URJASAATHI, aligned with the Gujarat Energy Development Agency (GEDA) Mission LiFE initiative (prototype digital companion).
Analyze this household:
- Resident: ${userName || 'Household Resident'}
- Location: ${district ? `${district}, Gujarat` : 'Gujarat, India'}
- Family Size: ${profile.familyMembers || 4} members
- Monthly Electricity Consumption: ${profile.monthlyKwh} kWh
- Monthly Bill: ₹${profile.monthlyBillInr || 1800}
- Major Appliances: ${(profile.appliances || []).join(', ')}
- Rooftop Space: ${profile.rooftopAvailableSqFt || 0} sq.ft
- Solar Installed: ${profile.hasSolarInstalled ? 'Yes' : 'No'}

Generate a structured JSON response with:
1. "summary": A motivating, concise executive summary (2-3 sentences) evaluating their current consumption. Do not invent a resident name or city if not explicitly provided.
2. "districtNotes": 1-2 sentences regarding solar and climate factors specific to ${district || 'Gujarat'}.
3. "recommendations": An array of 4 to 5 high-impact, practical actions. Each action must have:
   - "title": Action name
   - "description": Concrete how-to instruction tailored for Indian households
   - "estimatedMonthlyKwhSaved": Integer number of kWh saved
   - "estimatedMonthlyInrSaved": Integer amount in INR saved (assume ~₹6.25/kWh)
   - "difficulty": "Instant", "Easy", "Medium", or "High Impact"
   - "badge": 1-2 word catchy achievement title
Return ONLY valid JSON.`;

    const { text: rawText, modelUsed } = await generateGeminiContentWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
      timeoutMs: 12000,
    });

    let text = rawText.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(text);
    res.json({ source: 'gemini_ai', modelUsed, ...parsed });
  } catch (error: any) {
    const reason = error?.message?.includes('503')
      ? 'Gemini model high demand'
      : error?.message?.includes('timed out')
      ? 'Request timed out'
      : 'Gemini service unavailable';
    console.info(`Gemini coach note: ${reason}, activating certified Gujarat rule engine.`);
    const fallback = getRuleBasedCoachAdvice(profile);
    res.json({ source: 'fallback_engine', fallbackReason: reason, ...fallback });
  }
});

// 7-Day Green Action Plan Endpoint
app.post('/api/gemini/action-plan', async (req: Request, res: Response) => {
  const profile: HouseholdProfile = req.body.profile;

  const defaultPlan = [
    {
      day: 1,
      title: 'Vampire Power Audit & Night Cut-Off',
      task: 'Inspect all multi-plugs, TV units, and chargers. Switch off wall points for appliances in standby mode before sleeping.',
      kwhSavings: 1.5,
      impact: 'Reduces passive grid drain by 8%',
      focus: 'Habit Formation',
    },
    {
      day: 2,
      title: 'AC 24°C Calibration & Filter Wash',
      task: 'Clean the front mesh filters of all AC indoor units and configure default temperature to 24°C with fan speed on Auto.',
      kwhSavings: 4.0,
      impact: 'Saves up to 18% AC compressor draw',
      focus: 'Thermal Efficiency',
    },
    {
      day: 3,
      title: 'Daylight Harvesting Challenge',
      task: 'Open curtains and keep indoor artificial lights completely switched off until 5:30 PM across living areas.',
      kwhSavings: 2.0,
      impact: 'Reduces daytime lighting demand to zero',
      focus: 'Natural Living',
    },
    {
      day: 4,
      title: 'Refrigerator Coil & Seal Inspection',
      task: 'Ensure minimum 3-inch gap between fridge back and wall. Wipe dust off condenser coil and check gasket airtightness with a paper test.',
      kwhSavings: 2.5,
      impact: 'Prevents compressor overworking',
      focus: 'Appliance Care',
    },
    {
      day: 5,
      title: 'Cold Wash & Solar Line-Drying',
      task: 'Run washing machine with cold water cycle and hang all clothes on the balcony or terrace under the sun instead of tumble dry.',
      kwhSavings: 3.5,
      impact: 'Eliminates high-power heating elements',
      focus: 'Renewable Utilisation',
    },
    {
      day: 6,
      title: 'Rooftop & Terrace Solar Assessment',
      task: 'Measure your terrace shadow-free footprint and log onto the PM Surya Ghar portal or URJASAATHI solar calculator.',
      kwhSavings: 0,
      impact: 'Unlocks long-term 80%+ clean generation',
      focus: 'Clean Energy Transition',
    },
    {
      day: 7,
      title: 'Household LiFE Review & Green Pledge',
      task: 'Gather family members, review weekly electricity meter reading against last week, and sign the digital Mission LiFE pledge.',
      kwhSavings: 5.0,
      impact: 'Solidifies community green habit',
      focus: 'Citizen Stewardship',
    },
  ];

  if (!ai || !profile) {
    res.json({ plan: defaultPlan, source: 'local' });
    return;
  }

  try {
    const { district } = getCleanProfileContext(profile);
    const prompt = `Create a customized 7-day green action plan for a household in ${district || 'Gujarat, India'} with ${profile.familyMembers || 4} members consuming ${profile.monthlyKwh || 300} kWh/month.
Appliances: ${(profile.appliances || []).join(', ')}.
Return a JSON array of 7 objects with keys:
- "day": integer (1 to 7)
- "title": string short title
- "task": specific practical action
- "kwhSavings": estimated daily kWh saved as float
- "impact": 1 sentence reason
- "focus": focus area string
Return ONLY valid JSON.`;

    const { text: rawJson, modelUsed } = await generateGeminiContentWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
      timeoutMs: 12000,
    });

    let cleanJson = (rawJson || '[]').trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(cleanJson);
    res.json({ plan: Array.isArray(parsed) && parsed.length ? parsed : defaultPlan, source: 'gemini', modelUsed });
  } catch (error: any) {
    const reason = error?.message?.includes('503')
      ? 'Gemini model high demand'
      : error?.message?.includes('timed out')
      ? 'Request timed out'
      : 'Gemini service unavailable';
    console.info(`Action plan note: ${reason}, activating default Gujarat 7-day sprint.`);
    res.json({ plan: defaultPlan, source: 'fallback', fallbackReason: reason });
  }
});

// Interactive Ask UrjaGuru Chat Endpoint with Context Awareness & Smart Energy Math
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const { message, profile, history, simulateError } = req.body || {};
  const reqId =
    typeof req.body?.reqId === 'string' && req.body.reqId.trim()
      ? req.body.reqId.trim()
      : `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Message is required', reqId });
    return;
  }

  const cleanMessage = message.trim();
  const { userName: cleanName, district: cleanDistrict } = getCleanProfileContext(profile);
  const kwh = profile?.monthlyKwh || 280;

  // 1. Server-side Intent Detection on the latest user message
  const detectedIntent = detectQueryIntent(cleanMessage, history);

  // 2. Context Isolation: Only pass history when the latest query is a genuine contextual follow-up
  const contextualHistory =
    detectedIntent === 'appliance_followup' && Array.isArray(history) ? history : [];

  // 3. Deterministic System Intents (Date/Time in Asia/Kolkata, Basic Math, Weather Unavailability)
  const isDeterministicSystemIntent =
    detectedIntent === 'date_time' ||
    detectedIntent === 'basic_math' ||
    detectedIntent === 'weather_unavailable';

  if ((!ai || isDeterministicSystemIntent) && !simulateError) {
    const smartResult = generateSmartFallbackResponse(cleanMessage, profile, false, contextualHistory);
    console.info(
      JSON.stringify({
        event: 'urjaguru_chat_trace',
        reqId,
        latestUserMessage: cleanMessage,
        detectedIntent,
        selectedResponseMode: smartResult.mode,
        responseReqId: reqId,
      })
    );
    res.json({
      response: smartResult.response,
      mode: smartResult.mode,
      modeLabel: smartResult.modeLabel,
      intent: detectedIntent,
      source: smartResult.mode,
      reqId,
      responseReqId: reqId,
    });
    return;
  }

  try {
    if (simulateError === 'timeout') {
      await withTimeout(
        new Promise((_resolve) => {
          // Intentionally exceeds timeout
        }),
        50
      );
    } else if (simulateError === 'invalid_key') {
      throw new Error('400 API_KEY_INVALID: API key not valid. Please pass a valid API key.');
    }

    const { formattedDate, isoDate, formattedTime } = getCurrentDateInIndia();
    const profileContextLine =
      cleanName || cleanDistrict
        ? `User profile context (use ONLY if directly relevant): Name=${cleanName || 'Not specified'}, District=${cleanDistrict || 'Not specified'}, Monthly Consumption=${kwh} kWh.`
        : `User profile context: Name and city/district are not set. Do NOT invent any name (like "Devanshi Shah") or city (like "Gandhinagar").`;

    const systemInstruction = `You are UrjaGuru, an encouraging, highly intelligent green energy and sustainability advisor for URJASAATHI, aligned with the Mission LiFE initiative in India (prototype digital companion).
Current System Date & Time (Asia/Kolkata): ${formattedDate} (${isoDate}), ${formattedTime} IST.
${profileContextLine}

CORE DIRECTIVES:
1. ALWAYS DIRECTLY ANSWER the user's specific latest question ("${cleanMessage}") first! Never ignore their query. Never reply with unrelated canned advice or reuse previous appliance answers.
2. GREETINGS: If the user sends a greeting (e.g., 'Hello', 'Hi', 'Namaste', 'Kem cho', 'નમસ્તે'), respond warmly and politely introduce your capabilities without dumping unsolicited AC or solar advice. Never invent a user name or city if none is set.
3. ELECTRICITY BILL INCREASE DIAGNOSIS:
   If the user asks why their electricity bill increased (e.g., by 30% this month) or how to investigate a high bill:
   • FIRST explain the 7 most likely causes clearly:
     1. Increased electricity consumption (higher actual kWh drawn)
     2. Seasonal AC / air cooler usage (higher ambient temperatures forcing compressors to run longer)
     3. Refrigerator or heavy appliance usage changes (door seal wear, condenser dust, geyser/washing machine loads)
     4. Different billing-cycle duration (e.g., 35–40 billing days vs 28–30 days)
     5. Electricity tariff slab changes (crossing into a higher progressive DISCOM consumption slab or FPPPA fuel surcharge revision)
     6. Arrears, adjustments, or previous bill corrections carried forward
     7. Estimated vs. actual meter readings (previous door-locked average reading reconciled with an actual meter reading)
   • Explicitly explain that the user should compare **kWh (units) consumed** between the two bills, not only the rupee (₹) amount.
   • Then ask for these 3 details to pinpoint the exact cause:
     - Previous month's units (kWh) and bill amount (₹)
     - Current month's units (kWh) and bill amount (₹)
     - DISCOM name (e.g., UGVCL, PGVCL, DGVCL, MGVCL, Torrent Power, etc.)
   • Never invent the reason for their specific bill increase.
4. REFRIGERATOR / FRIDGE CONSUMPTION QUESTIONS:
   If the user asks how many units a refrigerator/fridge consumes (including capacity & star rating like "3 star 555 litre side by side refrigerator", or misspellings like refrigiator / refridgerator):
   • Explicitly explain that **exact daily consumption cannot be determined from storage capacity (litres) and star rating alone**, because a refrigerator's compressor cycles on and off based on ambient temperature, door-opening frequency, and cooling load.
   • Ask the user to check and share:
     1. Manufacturer and model number, OR
     2. The BEE Star Label's **"Annual Electricity Consumption (Units/Year or kWh/Year)"** sticker on the refrigerator door.
   • Provide the exact BEE conversion formulas:
     - Daily units (kWh/day) = Annual energy consumption ÷ 365
     - Monthly units (kWh/month) = Annual energy consumption ÷ 12
   • You may also share a realistic reference range (e.g. a 500L–600L 3-star side-by-side fridge typically has a BEE rating around 480–620 kWh/year, or ~1.3 to 1.7 units/day), while clearly stating it is an illustrative range and not an exact figure for their unit.
5. APPLIANCE WATTAGE CALCULATIONS:
   When the user provides a specific appliance wattage and hours (e.g. 170W laptop for 8 hours, 200W cooler for 10 hours):
   • Formula: Electricity Units (kWh) = Power (Watts) × Usage Hours ÷ 1000.
   • For example: 170W × 8 hours ÷ 1000 = 1.36 units (kWh).
   • Cost in Gujarat: Multiply units by ~₹6.25/kWh (average domestic tariff).
   • Nuance (Continuous vs Peak Rated): For laptops/chargers, explicitly explain that rated adapter wattage (such as a 170W power brick) is the maximum peak capacity, not continuous draw (gaming ~100W-130W, web browsing ~35W-50W, idle ~15W, unplugged charger standby <1.5W).
6. MISSING INPUTS: If the user asks about AC or heater consumption without specifying wattage/tonnage, ask relevant clarification questions (tonnage, star rating, daily hours) rather than inventing a single arbitrary number.
7. GENERAL & TECHNICAL QUESTIONS: Answer general concepts (such as "What is an algorithm?", "Compare inverter AC vs non-inverter AC", "Difference between kW and kWh") clearly, accurately, and helpfully.
8. LANGUAGE: Fluently understand and reply in the user's language (English, Hindi, Hinglish, or Gujarati).
9. GUJARAT ENERGY CONTEXT:
   • 1 unit = 1 kWh. Average domestic tariff in Gujarat is ~₹6.25/kWh.
   • PM Surya Ghar Central subsidy: ₹30,000 for 1 kW, ₹60,000 for 2 kW, ₹78,000 for 3 kW+.
   • GERC GIDRES Regulations 2026: Surplus solar injection compensation is ₹2.25/kWh.
Keep responses clear, structured with bullet points where helpful, and directly focused on the user's question.`;

    const formattedContents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];

    if (contextualHistory.length > 0) {
      for (const item of contextualHistory.slice(-6)) {
        if (!item.text || typeof item.text !== 'string') continue;
        const role: 'user' | 'model' = item.sender === 'user' ? 'user' : 'model';
        if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === role) {
          formattedContents[formattedContents.length - 1].parts[0].text += `\n${item.text}`;
        } else {
          formattedContents.push({ role, parts: [{ text: item.text }] });
        }
      }
    }

    while (formattedContents.length > 0 && formattedContents[0].role === 'model') {
      formattedContents.shift();
    }

    if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === 'user') {
      formattedContents[formattedContents.length - 1].parts[0].text += `\n${cleanMessage}`;
    } else {
      formattedContents.push({ role: 'user', parts: [{ text: cleanMessage }] });
    }

    const { text: replyText, modelUsed } = await generateGeminiContentWithFallback({
      contents: formattedContents,
      config: {
        systemInstruction,
      },
      timeoutMs: 8000,
    });

    console.info(
      JSON.stringify({
        event: 'urjaguru_chat_trace',
        reqId,
        latestUserMessage: cleanMessage,
        detectedIntent,
        selectedResponseMode: 'gemini_ai',
        modelUsed,
        responseReqId: reqId,
      })
    );

    res.json({
      response: replyText,
      mode: 'gemini_ai',
      modeLabel: 'Gemini AI',
      intent: detectedIntent,
      source: 'gemini',
      modelUsed,
      reqId,
      responseReqId: reqId,
    });
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const reason = errMsg.includes('503')
      ? 'Gemini model high demand'
      : errMsg.includes('timed out')
      ? 'Request timed out'
      : errMsg.includes('API_KEY_INVALID')
      ? 'Invalid API key'
      : `Gemini service unavailable (${errMsg.slice(0, 180)})`;

    const smartResult = generateSmartFallbackResponse(cleanMessage, profile, true, contextualHistory);

    console.info(
      JSON.stringify({
        event: 'urjaguru_chat_trace',
        reqId,
        latestUserMessage: cleanMessage,
        detectedIntent,
        selectedResponseMode: smartResult.mode,
        fallbackReason: reason,
        responseReqId: reqId,
      })
    );

    res.json({
      response: smartResult.response,
      mode: smartResult.mode,
      modeLabel: smartResult.modeLabel,
      intent: detectedIntent,
      source: smartResult.mode,
      fallbackReason: reason,
      reqId,
      responseReqId: reqId,
    });
  }
});

// Gujarat Regional Reference Benchmarks (No fabricated user profiles, rankings, or environmental savings)
app.get('/api/community/stats', (_req: Request, res: Response) => {
  const districtBenchmarks = [
    { district: 'Ahmedabad', discom: 'Torrent Power / UGVCL', solarInsolationPsh: 5.3, ceaEmissionFactorKgPerKwh: 0.675, surplusFeedInInrPerKwh: 2.25 },
    { district: 'Surat', discom: 'DGVCL / Torrent Power', solarInsolationPsh: 5.15, ceaEmissionFactorKgPerKwh: 0.675, surplusFeedInInrPerKwh: 2.25 },
    { district: 'Vadodara', discom: 'MGVCL', solarInsolationPsh: 5.2, ceaEmissionFactorKgPerKwh: 0.675, surplusFeedInInrPerKwh: 2.25 },
    { district: 'Rajkot', discom: 'PGVCL', solarInsolationPsh: 5.4, ceaEmissionFactorKgPerKwh: 0.675, surplusFeedInInrPerKwh: 2.25 },
    { district: 'Gandhinagar', discom: 'UGVCL / Torrent Power', solarInsolationPsh: 5.35, ceaEmissionFactorKgPerKwh: 0.675, surplusFeedInInrPerKwh: 2.25 },
    { district: 'Bhavnagar', discom: 'PGVCL', solarInsolationPsh: 5.35, ceaEmissionFactorKgPerKwh: 0.675, surplusFeedInInrPerKwh: 2.25 },
  ];

  res.json({
    districtBenchmarks,
    topChampions: [],
    dataNotice:
      'UrjaSaathi reports only authentic user-recorded mission completions and official Gujarat regulatory/engineering reference parameters (CEA Version 22.0 & GERC GIDRES 2026). No fabricated user profiles, rankings, or environmental savings are generated.',
  });
});

// Production Persistence Engine:
// - Uses Supabase PostgreSQL (`public.mission_completions` with UNIQUE(user_id, mission_id, completion_date)
//   and atomic `complete_mission_atomic` transaction) when SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are configured.
// - Never relies on in-memory JavaScript locks across requests or instances.
// - Never trusts arbitrary `user_id` values supplied in request bodies; verifies identity server-side.
// - Clearly reports when persistent production storage is unconfigured and operates in Local Demo Fallback mode.
const persistenceEngine = new DurablePersistenceEngine();

function setSessionCookie(res: Response, sessionToken: string) {
  if (!sessionToken) return;
  res.setHeader(
    'Set-Cookie',
    `urjasaathi_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );
}

// Server-side Session & Persistence Status Endpoint
app.get('/api/auth/session', async (req: Request, res: Response) => {
  try {
    const identity = await verifyServerUserIdentity({
      authorizationHeader: req.headers.authorization,
      sessionHeader: req.headers['x-urjasaathi-session'] as string | undefined,
      cookieHeader: req.headers.cookie,
      untrustedBodyUserId: (req.query.userId as string) || (req.query.user_id as string),
    });

    if (!identity.authenticated) {
      res.status(401).json({ error: identity.error || 'Unauthorized session token' });
      return;
    }

    setSessionCookie(res, identity.sessionToken);
    const status = persistenceEngine.getStatus();

    res.json({
      authenticated: true,
      userId: identity.userId,
      authMethod: identity.authMethod,
      sessionToken: identity.sessionToken,
      bodyUserIdIgnored: identity.bodyUserIdIgnored,
      ...status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Session verification failed' });
  }
});

// Get authoritative user mission state from durable storage (never trusts client localStorage as authoritative)
app.get('/api/missions/state', async (req: Request, res: Response) => {
  try {
    const identity = await verifyServerUserIdentity({
      authorizationHeader: req.headers.authorization,
      sessionHeader: req.headers['x-urjasaathi-session'] as string | undefined,
      cookieHeader: req.headers.cookie,
      untrustedBodyUserId: (req.query.userId as string) || (req.query.user_id as string),
    });

    if (!identity.authenticated) {
      res.status(401).json({ error: identity.error || 'Unauthorized session token' });
      return;
    }

    setSessionCookie(res, identity.sessionToken);
    const state = await persistenceEngine.getUserAuthoritativeState(identity.userId, new Date());
    const status = persistenceEngine.getStatus();

    res.json({
      userId: identity.userId,
      authMethod: identity.authMethod,
      sessionToken: identity.sessionToken,
      bodyUserIdIgnored: identity.bodyUserIdIgnored,
      state,
      ...status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load authoritative mission state' });
  }
});

// Atomic, idempotent mission completion endpoint backed by UNIQUE(user_id, mission_id, completion_date)
app.post('/api/missions/complete', async (req: Request, res: Response) => {
  try {
    const { userId: rawUserId, user_id: rawSnakeUserId, mission, timestamp } = req.body || {};
    if (!mission || !mission.id || !mission.title) {
      res.status(400).json({ error: 'Valid mission object (id, title, points) is required' });
      return;
    }

    // Verify user identity server-side. Arbitrary user_id values in request body are NEVER trusted.
    const identity = await verifyServerUserIdentity({
      authorizationHeader: req.headers.authorization,
      sessionHeader: req.headers['x-urjasaathi-session'] as string | undefined,
      cookieHeader: req.headers.cookie,
      untrustedBodyUserId: rawUserId || rawSnakeUserId || req.body?.state?.userId,
    });

    if (!identity.authenticated) {
      res.status(401).json({ error: identity.error || 'Unauthorized session token' });
      return;
    }

    setSessionCookie(res, identity.sessionToken);
    const evalDate = timestamp ? new Date(timestamp) : new Date();

    const result = await persistenceEngine.completeMissionAtomically({
      verifiedUserId: identity.userId,
      mission: {
        id: String(mission.id),
        title: String(mission.title),
        points: Number(mission.points) || 0,
        co2SavedKg: Number(mission.co2SavedKg) || 0,
        inrSaved: Number(mission.inrSaved) || 0,
      },
      now: evalDate,
    });

    res.json({
      ...result,
      authMethod: identity.authMethod,
      sessionToken: identity.sessionToken,
      bodyUserIdIgnored: identity.bodyUserIdIgnored,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to process mission completion' });
  }
});

function getRequestVerificationBaseUrl(req: Request): string {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim();
  const forwardedHost = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim();
  return resolveVerificationBaseUrl({
    env: process.env,
    requestProtocol: forwardedProto || req.protocol || 'https',
    requestHost: forwardedHost || req.get('host') || undefined,
  });
}

// Issue or refresh a verifiable Green Impact Passport credential record from authoritative mission ledger
app.post('/api/passport/credentials/issue', async (req: Request, res: Response) => {
  try {
    const identity = await verifyServerUserIdentity({
      authorizationHeader: req.headers.authorization,
      sessionHeader: req.headers['x-urjasaathi-session'] as string | undefined,
      cookieHeader: req.headers.cookie,
      untrustedBodyUserId: req.body?.userId || req.body?.user_id,
    });

    if (!identity.authenticated) {
      res.status(401).json({ error: identity.error || 'Unauthorized session token' });
      return;
    }

    setSessionCookie(res, identity.sessionToken);
    const {
      holderName,
      district,
      greenScore,
      publicDisplayConsent,
      unlockedBadgeIds,
      rotateToken,
    } = req.body || {};

    const issued = await persistenceEngine.upsertCredentialRecord({
      verifiedUserId: identity.userId,
      holderName,
      district,
      greenScore: Number(greenScore) || 74,
      publicDisplayConsent:
        typeof publicDisplayConsent === 'boolean' ? publicDisplayConsent : undefined,
      unlockedBadgeIds: Array.isArray(unlockedBadgeIds) ? unlockedBadgeIds : undefined,
      rotateToken: Boolean(rotateToken),
    });

    const baseUrl = getRequestVerificationBaseUrl(req);
    const verificationUrl = `${baseUrl}/verify/${encodeURIComponent(issued.verificationToken)}`;
    const qrDataUrl = await generateQrCodeDataUrl(verificationUrl);

    res.json({
      credential: issued.record,
      verificationToken: issued.verificationToken,
      tokenHash: issued.tokenHash,
      verificationUrl,
      qrDataUrl,
      publicDisplayConsent: issued.publicDisplayConsent,
      unlockedBadgeIds: issued.unlockedBadgeIds,
      disclaimer: PROTOTYPE_PASSPORT_DISCLAIMER,
      bodyUserIdIgnored: identity.bodyUserIdIgnored,
      ...issued.statusReport,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to issue credential record' });
  }
});

// Update passport credential status (active | revoked), public display consent, or rotate QR token
app.post('/api/passport/credentials/status', async (req: Request, res: Response) => {
  try {
    const identity = await verifyServerUserIdentity({
      authorizationHeader: req.headers.authorization,
      sessionHeader: req.headers['x-urjasaathi-session'] as string | undefined,
      cookieHeader: req.headers.cookie,
      untrustedBodyUserId: req.body?.userId || req.body?.user_id,
    });

    if (!identity.authenticated) {
      res.status(401).json({ error: identity.error || 'Unauthorized session token' });
      return;
    }

    setSessionCookie(res, identity.sessionToken);
    const { status, publicDisplayConsent, rotateToken } = req.body || {};
    const validStatus =
      status === 'revoked' ? 'revoked' : status === 'active' ? 'active' : undefined;

    const updated = await persistenceEngine.updateCredentialLifecycle({
      verifiedUserId: identity.userId,
      status: validStatus,
      publicDisplayConsent:
        typeof publicDisplayConsent === 'boolean' ? publicDisplayConsent : undefined,
      rotateToken: Boolean(rotateToken),
    });

    const baseUrl = getRequestVerificationBaseUrl(req);
    const verificationUrl = `${baseUrl}/verify/${encodeURIComponent(updated.verificationToken)}`;
    const qrDataUrl = await generateQrCodeDataUrl(verificationUrl);

    res.json({
      credential: updated.record,
      verificationToken: updated.verificationToken,
      tokenHash: updated.tokenHash,
      verificationUrl,
      qrDataUrl,
      publicDisplayConsent: updated.publicDisplayConsent,
      unlockedBadgeIds: updated.unlockedBadgeIds,
      disclaimer: PROTOTYPE_PASSPORT_DISCLAIMER,
      ...updated.statusReport,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update credential lifecycle' });
  }
});

// Public QR Token Verification Endpoint (never exposes private bills, phone numbers, or internal user_id)
app.get('/api/passport/verify/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const result = await persistenceEngine.verifyPublicPassportToken(token);

    res.json({
      verified: result.verified,
      verificationState: result.verificationState,
      signatureValid: result.signatureValid,
      reason: result.reason,
      error: result.verified ? undefined : result.reason || 'Credential verification failed',
      disclaimer: PROTOTYPE_PASSPORT_DISCLAIMER,
      publicCredential: result.publicCredential,
      ...result.statusReport,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to verify passport token' });
  }
});

// Legacy / Direct Credential ID Verification Endpoint
app.get('/api/passport/credentials/:credentialId/verify', async (req: Request, res: Response) => {
  try {
    const { credentialId } = req.params;
    const verification = await persistenceEngine.verifyCredentialRecord(credentialId);
    if (!verification.record) {
      res.status(404).json({
        verified: false,
        signatureValid: false,
        error: verification.reason || 'Credential record not found',
        ...verification.statusReport,
      });
      return;
    }

    res.json({
      verified: verification.verified,
      signatureValid: verification.signatureValid,
      credential: verification.record,
      reason: verification.reason,
      ...verification.statusReport,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to verify credential record' });
  }
});

// Server-side Solar Feasibility PDF Download Endpoint (application/pdf)
app.post('/api/reports/solar-pdf', async (req: Request, res: Response) => {
  try {
    const {
      applicantName,
      district,
      monthlyKwh,
      monthlyBillInr,
      rooftopAreaSqFt,
      unitRateInr,
      hasBatteryBackup,
      systemLossesPercent,
    } = req.body || {};

    const cleanKwh = Math.max(10, Number(monthlyKwh) || 300);
    const cleanArea = Math.max(20, Number(rooftopAreaSqFt) || 350);
    const cleanDistrict = (district || 'Ahmedabad').trim();
    const cleanTariff = Number(unitRateInr) || 6.25;
    const cleanBill =
      monthlyBillInr !== undefined
        ? Number(monthlyBillInr)
        : Math.round(cleanKwh * cleanTariff);
    const cleanLosses =
      systemLossesPercent !== undefined ? Number(systemLossesPercent) : 17.5;

    const calculation = calculateSolarFeasibility({
      monthlyKwh: cleanKwh,
      rooftopAreaSqFt: cleanArea,
      district: cleanDistrict,
      monthlyBillInr: cleanBill,
      unitRateInr: cleanTariff,
      hasBatteryBackup: Boolean(hasBatteryBackup),
      systemLossesPercent: cleanLosses,
    });

    const pdfBytes = await generateSolarFeasibilityPdf({
      applicantName: (applicantName || 'Household Applicant').trim(),
      district: cleanDistrict,
      monthlyKwh: cleanKwh,
      monthlyBillInr: cleanBill,
      rooftopAreaSqFt: cleanArea,
      hasBatteryBackup: Boolean(hasBatteryBackup),
      calculation,
      generatedAt: new Date(),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${SOLAR_REPORT_FILENAME}"`
    );
    res.setHeader('Content-Length', String(pdfBytes.byteLength));
    res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate Solar Feasibility PDF' });
  }
});

// Server-side Green Impact Passport PDF Download Endpoint (application/pdf)
app.post('/api/reports/passport-pdf', async (req: Request, res: Response) => {
  try {
    const identity = await verifyServerUserIdentity({
      authorizationHeader: req.headers.authorization,
      sessionHeader: req.headers['x-urjasaathi-session'] as string | undefined,
      cookieHeader: req.headers.cookie,
      untrustedBodyUserId: req.body?.userId || req.body?.user_id,
    });

    setSessionCookie(res, identity.sessionToken);

    const {
      holderName,
      district,
      greenScore,
      tierName,
      completedMissionsCount,
      completedMissionTitles,
      co2SavedKg,
      treeEquivalent,
      streakDays,
      badges,
      publicDisplayConsent,
    } = req.body || {};

    const unlockedBadgeIds = Array.isArray(badges)
      ? badges.filter((b: any) => b && b.unlocked).map((b: any) => String(b.id))
      : ['pioneer'];

    const issued = await persistenceEngine.upsertCredentialRecord({
      verifiedUserId: identity.userId,
      holderName,
      district,
      greenScore: Number(greenScore) || 74,
      publicDisplayConsent:
        typeof publicDisplayConsent === 'boolean' ? publicDisplayConsent : undefined,
      unlockedBadgeIds,
    });

    const baseUrl = getRequestVerificationBaseUrl(req);
    const verificationUrl = `${baseUrl}/verify/${encodeURIComponent(issued.verificationToken)}`;

    const pdfBytes = await generateGreenPassportPdf({
      holderName: issued.record.holder_name,
      publicDisplayConsent: issued.publicDisplayConsent,
      passportId: issued.record.credential_id,
      district: issued.record.district,
      greenScore: Number(greenScore) || issued.record.green_score,
      tierName: (tierName || 'Active Eco-Warrior').trim(),
      completedMissionsCount:
        completedMissionsCount !== undefined
          ? Number(completedMissionsCount)
          : issued.record.missions_completed,
      completedMissionTitles: Array.isArray(completedMissionTitles)
        ? completedMissionTitles
        : [],
      co2SavedKg:
        co2SavedKg !== undefined ? Number(co2SavedKg) : Number(issued.record.co2_saved_kg),
      treeEquivalent:
        treeEquivalent !== undefined
          ? Number(treeEquivalent)
          : Math.max(1, Math.round((Number(co2SavedKg) || 1) / 1.67)),
      streakDays:
        streakDays !== undefined ? Number(streakDays) : Number(issued.record.streak_days),
      badges: Array.isArray(badges)
        ? badges
        : [
            {
              id: 'pioneer',
              name: 'Mission LiFE Pioneer',
              category: 'Foundation',
              unlocked: true,
              description: 'Completed onboarding and established household carbon baseline.',
            },
          ],
      issueDate: issued.record.issued_at,
      verificationUrl,
      persistenceMode: issued.statusReport.persistenceMode,
      durableStorageAvailable: issued.statusReport.durableStorageAvailable,
      credentialStatus: issued.record.status,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${PASSPORT_REPORT_FILENAME}"`
    );
    res.setHeader('Content-Length', String(pdfBytes.byteLength));
    res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate Green Impact Passport PDF' });
  }
});

// Serve frontend with Vite in development or static files in production
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`URJASAATHI server running on http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
