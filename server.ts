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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Initialize server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY;
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

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    appName: 'URJASAATHI',
    version: '1.0.0',
    geminiConfigured: !!apiKey,
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
      description: `With ${profile.rooftopAvailableSqFt} sq.ft of terrace in ${profile.district}, you are eligible for up to ₹78,000 Central financial subsidy. This can slash your electricity bill by 75-90%.`,
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
      'Replacing 3 conventional 75W induction ceiling fans with 28W brushless DC (BLDC) fans saves over 60% fan electricity in hot Gujarat weather.',
    estimatedMonthlyKwhSaved: 35,
    estimatedMonthlyInrSaved: Math.round(35 * 6.25),
    difficulty: 'Medium',
    badge: 'Smart Upgrade',
  });

  return {
    summary: `Analysis for ${profile.name} in ${profile.district}: Your household uses ${profile.monthlyKwh} kWh/month (${metrics.perCapitaKwh} kWh per capita). You can potentially save ~${metrics.potentialMonthlySavingKwh} kWh and ₹${metrics.potentialMonthlySavingInr} every month through Mission LiFE habits.`,
    greenScore: metrics.greenScore,
    tier: metrics.tier.name,
    districtNotes: `${profile.district} enjoys high solar irradiance (~5.2 kWh/m²/day). Participating in GEDA LiFE initiatives directly offsets the Western Grid fossil generation.`,
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
    const prompt = `You are UrjaGuru, the AI Green Energy Coach for URJASAATHI, certified by Gujarat Energy Development Agency (GEDA) Mission LiFE.
Analyze this Gujarat household:
- Resident Name: ${profile.name || 'Citizen'}
- District: ${profile.district || 'Ahmedabad'}, Gujarat
- Family Size: ${profile.familyMembers || 4} members
- Monthly Electricity Consumption: ${profile.monthlyKwh} kWh
- Monthly Bill: ₹${profile.monthlyBillInr || 1800}
- Major Appliances: ${(profile.appliances || []).join(', ')}
- Rooftop Space: ${profile.rooftopAvailableSqFt || 0} sq.ft
- Solar Installed: ${profile.hasSolarInstalled ? 'Yes' : 'No'}

Generate a structured JSON response with:
1. "summary": A motivating, concise executive summary (2-3 sentences) evaluating their current consumption.
2. "districtNotes": 1-2 sentences regarding solar and climate factors specific to ${profile.district}, Gujarat.
3. "recommendations": An array of 4 to 5 high-impact, practical actions. Each action must have:
   - "title": Action name
   - "description": Concrete how-to instruction tailored for Gujarat households
   - "estimatedMonthlyKwhSaved": Integer number of kWh saved
   - "estimatedMonthlyInrSaved": Integer amount in INR saved (assume ~₹6.25/kWh)
   - "difficulty": "Instant", "Easy", "Medium", or "High Impact"
   - "badge": 1-2 word catchy achievement title
Return ONLY valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);
    res.json({ source: 'gemini_ai', ...parsed });
  } catch (error) {
    console.warn('Gemini coach call failed, falling back to rule engine:', error);
    const fallback = getRuleBasedCoachAdvice(profile);
    res.json({ source: 'fallback_engine', ...fallback });
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
      task: 'Run washing machine with cold water cycle and hang all clothes on the balcony or terrace under Gujarat sun instead of tumble dry.',
      kwhSavings: 3.5,
      impact: 'Eliminates high-power heating elements',
      focus: 'Renewable Utilisation',
    },
    {
      day: 6,
      title: 'Rooftop & Terrace Solar Assessment',
      task: 'Measure your terrace shadow-free footprint and log onto the GEDA PM Surya Ghar portal or URJASAATHI solar calculator.',
      kwhSavings: 0,
      impact: 'Unlocks long-term 80%+ clean generation',
      focus: 'Clean Energy Transition',
    },
    {
      day: 7,
      title: 'Household LiFE Review & Green Pledge',
      task: 'Gather family members, review week electricity meter reading against last week, and sign the digital GEDA Mission LiFE pledge.',
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
    const prompt = `Create a customized 7-day green action plan for a household in ${profile.district || 'Gujarat'}, India with ${profile.familyMembers || 4} members consuming ${profile.monthlyKwh || 300} kWh/month.
Appliances: ${(profile.appliances || []).join(', ')}.
Return a JSON array of 7 objects with keys:
- "day": integer (1 to 7)
- "title": string short title
- "task": specific practical action
- "kwhSavings": estimated daily kWh saved as float
- "impact": 1 sentence reason
- "focus": focus area string
Return ONLY valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    res.json({ plan: parsed.length ? parsed : defaultPlan, source: 'gemini' });
  } catch (error) {
    console.warn('Action plan Gemini failed, using default:', error);
    res.json({ plan: defaultPlan, source: 'fallback' });
  }
});

// Interactive Ask UrjaAI Chat Endpoint
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const { message, profile } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const district = profile?.district || 'Gujarat';
  const kwh = profile?.monthlyKwh || 300;

  if (!ai) {
    // Intelligent contextual response
    const msgLower = message.toLowerCase();
    let reply = `Namaste! As your UrjaSaathi Green Coach in ${district}, here is my advice: `;
    if (msgLower.includes('solar') || msgLower.includes('subsidy') || msgLower.includes('surya')) {
      reply +=
        'Under PM Surya Ghar Muft Bijli Yojana & GEDA, residential consumers in Gujarat get ₹30,000 subsidy for 1 kW, ₹60,000 for 2 kW, and ₹78,000 for 3 kW or higher. Gujarat has top-tier net-metering settlement with DISCOMs like UGVCL, DGVCL, PGVCL, MGVCL, and Torrent Power!';
    } else if (msgLower.includes('ac') || msgLower.includes('cooling') || msgLower.includes('temperature')) {
      reply +=
        'Setting your air conditioner to 24°C instead of 18°C saves about 24% of power because the outdoor compressor cycles off properly. In hot Gujarat summers, using ceiling fans simultaneously at low speed creates a pleasant wind-chill effect!';
    } else if (msgLower.includes('bill') || msgLower.includes('reduce') || msgLower.includes('save money')) {
      reply += `For your ${kwh} kWh monthly consumption, the top 3 highest impact actions are: 1) Shifting AC to 24°C (+₹500/mo savings), 2) Upgrading 75W ceiling fans to 28W BLDC motors (+₹250/mo savings), and 3) Installing 2kW to 3kW rooftop solar to wipe out up to 90% of your bill.`;
    } else {
      reply +=
        'Every unit (kWh) of electricity saved in Gujarat offsets ~0.82 kg of CO2 emissions (derived from CEA National Grid baseline with avoided technical losses). Try completing today’s Mission LiFE daily challenges to maintain your green streak!';
    }
    res.json({ response: reply, source: 'knowledge_base' });
    return;
  }

  try {
    const prompt = `You are UrjaGuru, an encouraging, authoritative green energy & sustainability advisor for the Gujarat Energy Development Agency (GEDA) Mission LiFE program.
User Context:
- District: ${district}, Gujarat
- Household Monthly Consumption: ${kwh} kWh
- Question: "${message}"

Answer the citizen's question in a warm, concise, and scientifically accurate manner. Include specific numbers (kWh savings, INR amounts, solar subsidies under PM Surya Ghar, or Gujarat DISCOM facts) where relevant. Keep the tone inspiring and under 150 words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({ response: response.text, source: 'gemini' });
  } catch (error) {
    console.error('Gemini chat error:', error);
    res.status(500).json({
      response:
        'I am currently operating in eco-cached mode. Remember that keeping your AC at 24°C and switching off idle appliances saves up to 20% on your monthly Gujarat power bill!',
      source: 'offline_guard',
    });
  }
});

// Community and Leaderboard Data
app.get('/api/community/stats', (_req: Request, res: Response) => {
  // Realistic demonstration data clearly labelled for GEDA Mission LiFE
  const districtStats = [
    { district: 'Ahmedabad', households: 48200, mwhSaved: 1420, co2ReducedTonnes: 1164, avgScore: 78 },
    { district: 'Surat', households: 39500, mwhSaved: 1180, co2ReducedTonnes: 967, avgScore: 76 },
    { district: 'Vadodara', households: 28400, mwhSaved: 890, co2ReducedTonnes: 729, avgScore: 75 },
    { district: 'Rajkot', households: 24100, mwhSaved: 760, co2ReducedTonnes: 623, avgScore: 74 },
    { district: 'Gandhinagar', households: 18900, mwhSaved: 630, co2ReducedTonnes: 516, avgScore: 82 },
    { district: 'Bhavnagar', households: 14200, mwhSaved: 440, co2ReducedTonnes: 360, avgScore: 72 },
    { district: 'Kutch', households: 12800, mwhSaved: 410, co2ReducedTonnes: 336, avgScore: 73 },
    { district: 'Anand', households: 11500, mwhSaved: 360, co2ReducedTonnes: 295, avgScore: 71 },
    { district: 'Jamnagar', households: 10400, mwhSaved: 320, co2ReducedTonnes: 262, avgScore: 70 },
    { district: 'Mehsana', households: 9800, mwhSaved: 295, co2ReducedTonnes: 241, avgScore: 69 },
    { district: 'Bharuch', households: 9200, mwhSaved: 280, co2ReducedTonnes: 229, avgScore: 70 },
    { district: 'Junagadh', households: 8600, mwhSaved: 255, co2ReducedTonnes: 209, avgScore: 68 },
  ];

  const topChampions = [
    { rank: 1, name: 'Bhavik Patel', district: 'Gandhinagar', greenScore: 96, missionsCompleted: 48, solarUser: true, streakDays: 34 },
    { rank: 2, name: 'Ananya Shah', district: 'Ahmedabad', greenScore: 94, missionsCompleted: 42, solarUser: true, streakDays: 28 },
    { rank: 3, name: 'Dhaval Joshi', district: 'Vadodara', greenScore: 92, missionsCompleted: 39, solarUser: false, streakDays: 21 },
    { rank: 4, name: 'Meera Trivedi', district: 'Rajkot', greenScore: 90, missionsCompleted: 36, solarUser: true, streakDays: 19 },
    { rank: 5, name: 'Kinjal Mehta', district: 'Surat', greenScore: 89, missionsCompleted: 35, solarUser: false, streakDays: 16 },
    { rank: 6, name: 'Hitesh Parmar', district: 'Bhavnagar', greenScore: 88, missionsCompleted: 31, solarUser: true, streakDays: 14 },
    { rank: 7, name: 'Pooja Barot', district: 'Kutch', greenScore: 87, missionsCompleted: 29, solarUser: false, streakDays: 12 },
    { rank: 8, name: 'Jayesh Dave', district: 'Anand', greenScore: 86, missionsCompleted: 27, solarUser: true, streakDays: 11 },
  ];

  const activeChallenges = [
    {
      id: 'summer-24c-drive',
      title: 'Gujarat 24°C Summer AC Drive',
      description: 'Run AC at or above 24°C during peak afternoon hours (1 PM – 4 PM) for 7 consecutive days.',
      participants: 14500,
      targetGoal: '50,000 kWh saved across Gujarat',
      progressPct: 68,
      rewardBadge: 'Master of Chill',
      daysRemaining: 12,
    },
    {
      id: 'saurashtra-solar-surge',
      title: 'Terrace Solar Survey Sprint',
      description: 'Assess rooftop solar potential and inspect shading to fast-track PM Surya Ghar adoption.',
      participants: 8200,
      targetGoal: '10,000 terraces surveyed',
      progressPct: 82,
      rewardBadge: 'Sun Seeker',
      daysRemaining: 5,
    },
    {
      id: 'phantom-zero-weekend',
      title: 'Zero Vampire Power Weekend',
      description: 'Turn off all main switches for unused entertainment systems and chargers before sleeping.',
      participants: 19800,
      targetGoal: '100% phantom cut-off',
      progressPct: 91,
      rewardBadge: 'Ghost Slayer',
      daysRemaining: 2,
    },
  ];

  const aggregateTotals = {
    totalHouseholdsJoined: 247600,
    totalMwhSaved: 6850,
    totalCo2AvertedTonnes: 5617,
    totalRupeesSavedLakhs: 428,
    equivalentTreesPlanted: 280850,
  };

  res.json({
    aggregateTotals,
    districtStats,
    topChampions,
    activeChallenges,
    isDemoData: true,
    dataNotice: 'Aggregated demonstration figures benchmarked against GEDA Mission LiFE residential surveys across Gujarat.',
  });
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
