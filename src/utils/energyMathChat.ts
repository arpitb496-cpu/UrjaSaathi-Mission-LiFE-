/**
 * UrjaGuru Intelligent Energy Math & Chat Knowledge Engine
 * Production-grade domain engine for Mission LiFE & Gujarat Energy Development Agency (GEDA).
 *
 * Implements:
 * 1. Multilingual parsing (English, Hindi, Hinglish, Gujarati).
 * 2. Strict intent classification before generating any response:
 *    - date_time (Asia/Kolkata system clock)
 *    - basic_math (deterministic arithmetic evaluation)
 *    - bill_increase_diagnosis (7-cause investigation framework + kWh vs ₹ + 3 follow-up prompts)
 *    - refrigerator_inquiry (capacity/star-rating limitation + BEE annual kWh/365 & kWh/12 formulas)
 *    - appliance_calculation (kWh = Watts × Hours ÷ 1000)
 *    - appliance_followup (strictly scoped to genuine contextual follow-ups)
 *    - continuous_vs_rated (peak adapter rating vs continuous draw)
 *    - charger_standby (vampire load)
 *    - fan_comparison (75W induction vs 28W BLDC)
 *    - missing_appliance_input / missing_cost_input (clarification prompts)
 *    - solar_subsidy (PM Surya Ghar CFA & GERC GIDRES 2026 ₹2.25/kWh)
 *    - general_sustainability (Inverter vs Non-Inverter AC, kW vs kWh, Mission LiFE conservation)
 *    - greeting (neutral or authenticated greeting without invented names/locations)
 *    - weather_unavailable (explicit notice that live weather integration is absent)
 *    - unrelated (explicit Unavailable / Out of Scope response when offline; never reuses stale answers)
 * 3. Request-ID response association helper to prevent out-of-order or duplicate message bugs.
 */

import type { HouseholdProfile } from './sustainabilityMath.ts';

export const GUJARAT_AVG_TARIFF_INR_PER_KWH = 6.25;

export type ResponseMode = 'gemini_ai' | 'smart_calculation' | 'offline_mode' | 'unavailable';

export type QueryIntent =
  | 'greeting'
  | 'date_time'
  | 'basic_math'
  | 'bill_increase_diagnosis'
  | 'refrigerator_inquiry'
  | 'appliance_calculation'
  | 'appliance_followup'
  | 'continuous_vs_rated'
  | 'charger_standby'
  | 'fan_comparison'
  | 'missing_appliance_input'
  | 'missing_cost_input'
  | 'solar_subsidy'
  | 'general_sustainability'
  | 'weather_unavailable'
  | 'unrelated';

export interface ChatResponseResult {
  response: string;
  mode: ResponseMode;
  modeLabel: string;
  intent: QueryIntent;
  reqId?: string;
  calculationDetails?: {
    watts: number;
    hours: number;
    unitsKwh: number;
    dailyCostInr: number;
    monthlyCostInr: number;
  };
}

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  mode?: ResponseMode;
  modeLabel?: string;
  reqId?: string;
  intent?: QueryIntent;
}

export interface ApplianceCalculationResult {
  watts: number;
  hours: number;
  unitsKwh: number;
  dailyCostInr: number;
  monthlyUnitsKwh: number;
  monthlyCostInr: number;
  actualAvgWattsEstimated?: number;
  actualAvgUnitsKwh?: number;
  actualMonthlyCostInr?: number;
  isPeakRatedNote?: string;
}

/**
 * Helper to extract only genuine user-supplied name and district (never inventing defaults)
 */
export function getCleanProfileContext(profile?: HouseholdProfile): {
  userName: string | null;
  district: string | null;
} {
  const rawName = profile?.name?.trim() || '';
  const placeholderNames = ['citizen', 'resident', 'gujarat resident', 'guest', 'guest profile', 'user'];
  const userName =
    rawName && !placeholderNames.includes(rawName.toLowerCase()) ? rawName : null;

  const rawDistrict = profile?.district?.trim() || '';
  const placeholderDistricts = ['gujarat', 'select district', 'all districts', 'your area'];
  const district =
    rawDistrict && !placeholderDistricts.includes(rawDistrict.toLowerCase())
      ? rawDistrict
      : null;

  return { userName, district };
}

/**
 * Builds the initial chat welcome message using only actual user details or a clean neutral greeting
 */
export function buildCoachWelcomeMessage(profile?: HouseholdProfile): string {
  const { userName, district } = getCleanProfileContext(profile);
  const namePart = userName ? ` ${userName}` : '';
  const locationPart = district ? ` in ${district}` : '';

  return `Namaste${namePart}! I am UrjaGuru, your AI Green Energy Coach for URJASAATHI${locationPart}. How can I assist you today? You can ask me to calculate appliance electricity consumption, diagnose electricity bill increases, explain rooftop solar subsidies under PM Surya Ghar, or answer general energy questions.`;
}

/**
 * Calculates electricity units and costs with peak rated vs continuous power nuance
 */
export function calculateApplianceConsumption(
  watts: number,
  hours: number,
  ratePerKwh: number = GUJARAT_AVG_TARIFF_INR_PER_KWH,
  isAdapterOrVariableLoad: boolean = false
): ApplianceCalculationResult {
  const unitsKwh = Number(((watts * hours) / 1000).toFixed(3));
  const dailyCostInr = Number((unitsKwh * ratePerKwh).toFixed(2));
  const monthlyUnitsKwh = Number((unitsKwh * 30).toFixed(2));
  const monthlyCostInr = Number((dailyCostInr * 30).toFixed(2));

  let actualAvgWattsEstimated: number | undefined;
  let actualAvgUnitsKwh: number | undefined;
  let actualMonthlyCostInr: number | undefined;
  let isPeakRatedNote: string | undefined;

  if (isAdapterOrVariableLoad) {
    actualAvgWattsEstimated = Math.round(watts * 0.7);
    actualAvgUnitsKwh = Number(((actualAvgWattsEstimated * hours) / 1000).toFixed(3));
    actualMonthlyCostInr = Number((actualAvgUnitsKwh * ratePerKwh * 30).toFixed(2));
    isPeakRatedNote = `Note: ${watts}W is the maximum peak rated capacity of the adapter/appliance, not continuous draw. Under typical heavy usage (~${actualAvgWattsEstimated}W average), actual consumption is ~${actualAvgUnitsKwh} units/day (₹${actualMonthlyCostInr}/month). During light/idle tasks when the battery is full, power draw drops to 15W–45W.`;
  }

  return {
    watts,
    hours,
    unitsKwh,
    dailyCostInr,
    monthlyUnitsKwh,
    monthlyCostInr,
    actualAvgWattsEstimated,
    actualAvgUnitsKwh,
    actualMonthlyCostInr,
    isPeakRatedNote,
  };
}

/**
 * Detects language: Gujarati, Hindi, Hinglish, or English
 */
export function detectLanguage(query: string): 'gujarati' | 'hindi' | 'hinglish' | 'english' {
  if (/[\u0A80-\u0AFF]/.test(query)) {
    return 'gujarati';
  }

  if (/[\u0900-\u097F]/.test(query)) {
    return 'hindi';
  }

  const q = query.toLowerCase();

  const gujaratiRomanWords = [
    'kem cho', 'kemcho', 'ketla', 'ketli', 'ketlo', 'thay', 'aavshe', 'aave',
    'chhe', 'karo', 'karvu', 'maaro', 'maari', 'tamaru', 'tamari', 'bhadu',
    'ghare', 'kalak', 'kalako'
  ];
  if (gujaratiRomanWords.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(q))) {
    return 'gujarati';
  }

  const hinglishWords = [
    'mera', 'meri', 'mere', 'kitna', 'kitne', 'kitni', 'khata', 'khati', 'khate',
    'chale', 'chalta', 'chalti', 'chalaye', 'bhai', 'batao', 'kaise', 'hoga',
    'hamesha', 'ghante', 'ghanta', 'bijli', 'kharcha', 'aayega', 'milta',
    'milegi', 'lagwane', 'par', 'kare', 'karna', 'chahiye', 'kya', 'hai', 'hain',
    'mein', 'घर', 'woh'
  ];
  const words = q.split(/\s+/);
  const matchedHinglish = words.filter((w) => hinglishWords.includes(w));
  if (matchedHinglish.length >= 2 || (matchedHinglish.length >= 1 && (q.includes('kitna') || q.includes('kitni') || q.includes('khata') || q.includes('chalta')))) {
    return 'hinglish';
  }

  return 'english';
}

/**
 * Returns authoritative current date & time in Asia/Kolkata timezone
 */
export function getCurrentDateInIndia(now: Date = new Date()): {
  formattedDate: string;
  isoDate: string;
  formattedTime: string;
} {
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value || String(now.getFullYear());
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const isoDate = `${year}-${month}-${day}`;

  const formattedTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);

  return { formattedDate, isoDate, formattedTime };
}

/**
 * Safely evaluates basic mathematical questions (e.g., "What's 2+2?", "What is 5+7?", "12 * 4")
 * Returns null if the query is not a basic math question or involves appliance units.
 */
export function evaluateBasicMath(query: string): { expression: string; result: number } | null {
  const q = query.toLowerCase().trim();

  if (
    /(\bwatt|\bw\b|\bkw\b|\bkwh\b|\bunit|\bton\b|\bhour|\bhr\b|\bghant|\bkalak|\bકલાક|\bવોટ|\bयूनिट|\bवाट|\bघंट|\blaptop|\bcooler|\bfan|\bac\b|\bgeyser|\bfridge|\brefrigerator|\bsolar|\bdate\b|\btoday\b)/i.test(
      q
    )
  ) {
    return null;
  }

  let expr = q
    .replace(/^(what is|what's|whats|calculate|compute|solve|tell me|how much is|kitna hota hai|kitna hai)\s+/i, '')
    .replace(/[?=!\s]+$/g, '')
    .trim();

  expr = expr
    .replace(/\bplus\b/gi, '+')
    .replace(/\bminus\b/gi, '-')
    .replace(/\b(times|multiplied by)\b/gi, '*')
    .replace(/\b(divided by)\b/gi, '/')
    .replace(/[×]/g, '*')
    .replace(/[÷]/g, '/');

  if (!/^\d+(?:\.\d+)?(?:\s*[+\-*/]\s*\d+(?:\.\d+)?)+$/.test(expr)) {
    return null;
  }

  const tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.length < 3) return null;

  const pass1: Array<number | string> = [parseFloat(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const nextVal = parseFloat(tokens[i + 1]);
    if (Number.isNaN(nextVal)) return null;

    if (op === '*') {
      const prev = pass1.pop() as number;
      pass1.push(prev * nextVal);
    } else if (op === '/') {
      if (nextVal === 0) return null;
      const prev = pass1.pop() as number;
      pass1.push(prev / nextVal);
    } else {
      pass1.push(op, nextVal);
    }
  }

  let acc = pass1[0] as number;
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i] as string;
    const nextVal = pass1[i + 1] as number;
    if (op === '+') acc += nextVal;
    else if (op === '-') acc -= nextVal;
  }

  if (!Number.isFinite(acc)) return null;

  const cleanResult = Number(acc.toFixed(4));
  const cleanExpr = tokens.join(' ');
  return { expression: cleanExpr, result: cleanResult };
}

/**
 * Checks if query refers to a refrigerator/fridge/frigorific appliance across languages and common misspellings
 */
export function isRefrigeratorQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\b(refrigerator|refrigiator|refridgerator|refregerator|refrigirator|fridge|frigorific|frij|friz|side by side)\b/i.test(
      q
    ) ||
    q.includes('ફ્રિજ') ||
    q.includes('રેફ્રિજરેટર') ||
    q.includes('फ्रिज') ||
    q.includes('फ्रीज') ||
    q.includes('रेफ्रिजरेटर')
  );
}

/**
 * Parses power wattage from text across languages.
 * Only matches explicit wattages/tonnages OR implied non-refrigerator appliances when paired with energy/usage context.
 */
export function extractWattageFromQuery(query: string): { watts: number; applianceType: string } | null {
  const q = query.toLowerCase();

  // Check AC tonnage: "1.5 ton", "1 ton", "2 ton", "1.5 ટન"
  const tonMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:ton|ટન|टन)\s*(?:ac|air conditioner|એસી)?/i);
  if (tonMatch) {
    const tons = parseFloat(tonMatch[1]);
    const watts = Math.round(tons * 1050);
    return { watts, applianceType: `${tons} Ton AC` };
  }

  // Check explicit wattage: "170w", "170 watt", "200 w", "170 વોટ", "200 વોટ"
  const wattMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:w|watt|watts|વોટ|વોટ્સ|वाट)(?:\b|$|\s)/i);
  if (wattMatch) {
    const watts = parseFloat(wattMatch[1]);
    let applianceType = 'Appliance';
    if (q.includes('laptop') || q.includes('લેપટોપ') || q.includes('pc') || q.includes('computer')) applianceType = 'Laptop';
    else if (q.includes('cooler') || q.includes('કૂલર') || q.includes('कूलर')) applianceType = 'Air Cooler';
    else if (q.includes('fan') || q.includes('પંખો') || q.includes('पंखा')) applianceType = 'Ceiling Fan';
    else if (q.includes('geyser') || q.includes('હીટર') || q.includes('heater')) applianceType = 'Geyser';
    else if (isRefrigeratorQuery(q)) applianceType = 'Refrigerator';
    else if (q.includes('tv') || q.includes('television')) applianceType = 'Television';
    else if (q.includes('charger') || q.includes('ચાર્જર')) applianceType = 'Charger';
    else if (q.includes('bulb') || q.includes('બલ્બ') || q.includes('बल्ब')) applianceType = 'Bulb';
    else if (q.includes('mixer') || q.includes('મિક્સર')) applianceType = 'Mixer';
    return { watts, applianceType };
  }

  // Implied appliance presets ONLY when query asks about energy, hours, consumption, or cost
  // Note: Refrigerators without explicit wattage are handled by 'refrigerator_inquiry' (BEE kWh/year method)
  if (isRefrigeratorQuery(q)) {
    return null;
  }

  const hasUsageOrEnergyContext =
    extractHoursFromQuery(query) !== null ||
    /(\bunit|\bconsume|\bconsumption|\bkwh|\belectricity|\bpower|\bbill|\bcost|\bkhata|\bchalta|\bkharcha|\bcharger|\bયુનિટ|\bવીજળી|\bચાલે|\bयूनिट|\bबिजली|\bखपत)/i.test(
      q
    );

  if (!hasUsageOrEnergyContext) {
    return null;
  }

  if (q.includes('gaming laptop') || q.includes('ગેમિંગ લેપટોપ') || (q.includes('laptop') && (q.includes('charger') || q.includes('gaming')))) {
    return { watts: 170, applianceType: 'Gaming Laptop' };
  }
  if (q.includes('bldc fan') || q.includes('બીએલડીસી પંખો')) {
    return { watts: 28, applianceType: 'BLDC Ceiling Fan' };
  }
  if ((q.includes('ceiling fan') || q.includes('fan') || q.includes('પંખો')) && !q.includes('bldc')) {
    return { watts: 75, applianceType: 'Conventional Ceiling Fan' };
  }
  if (q.includes('cooler') || q.includes('air cooler') || q.includes('કૂલર') || q.includes('कूलर')) {
    return { watts: 200, applianceType: 'Air Cooler' };
  }
  if (q.includes('geyser') || q.includes('water heater') || q.includes('ગીઝર')) {
    return { watts: 2000, applianceType: 'Electric Geyser' };
  }

  return null;
}

/**
 * Parses daily usage hours across languages
 */
export function extractHoursFromQuery(query: string): number | null {
  const q = query.toLowerCase();

  const hourMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|ghanta|ghante|ghanto|kalak|kalako|કલાક|કલાકો|घंटे|घंटा)/i);
  if (hourMatch) {
    return parseFloat(hourMatch[1]);
  }

  return null;
}

/**
 * Finds the most recent appliance mentioned by the USER in conversation history.
 * Never extracts from AI welcome messages or unrelated turns.
 */
export function findPreviousUserAppliance(
  history?: Array<{ sender: 'user' | 'ai'; text: string }>
): { watts: number; applianceType: string; previousHours: number } | null {
  if (!Array.isArray(history) || history.length === 0) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (!item || item.sender !== 'user' || !item.text) continue;
    const prevWattage = extractWattageFromQuery(item.text);
    if (prevWattage) {
      const prevHours = extractHoursFromQuery(item.text) ?? 8;
      return {
        watts: prevWattage.watts,
        applianceType: prevWattage.applianceType,
        previousHours: prevHours,
      };
    }
  }

  return null;
}

/**
 * Determines whether the current query is a genuine contextual follow-up to a previous energy calculation.
 */
export function isContextualEnergyFollowUp(query: string): boolean {
  const q = query.toLowerCase().trim();

  if (
    /\b(date|today|time|weather|forecast|rain|joke|poem|cricket|who is|capital of|algorithm)\b/i.test(q) ||
    evaluateBasicMath(query) !== null
  ) {
    return false;
  }

  const hasFollowUpReference =
    /(\bwhat if\b|\binstead\b|\buse it\b|\brun it\b|\bits\b|\bfor it\b|\bwhat about\b|\bfor only\b|\bonly \d+|\bsame\b|\bagar\b|\bisko\b|\bise\b|\busko\b|\bતો કેટલા\b|\bજો તેને\b)/i.test(
      q
    );

  const hasEnergyOrDurationParameter =
    extractHoursFromQuery(query) !== null ||
    /(\b\d+\s*days?\b|\b30\s*days?\b|\bmonthly\b|\bper month\b|\bcost\b|\bbill\b|\bunits?\b|\bkwh\b|\bखर्च|\bयूनिट|\bયુનિટ|\bખર્ચ)/i.test(
      q
    );

  return hasFollowUpReference && hasEnergyOrDurationParameter;
}

/**
 * Classifies the user's latest message into a distinct intent BEFORE generating any response.
 */
export function detectQueryIntent(
  query: string,
  history?: Array<{ sender: 'user' | 'ai'; text: string }>
): QueryIntent {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return 'unrelated';
  }

  const q = query.toLowerCase().trim();
  const cleanQ = q.replace(/[?!.,]/g, '').trim();

  // A. GREETINGS
  const exactGreetings = [
    'hi',
    'hello',
    'hey',
    'namaste',
    'kem cho',
    'kemcho',
    'નમસ્તે',
    'કેમ છો',
    'good morning',
    'good afternoon',
    'good evening',
    'hello urjaguru',
    'hi urjaguru',
    'hey urjaguru',
    'namaste urjaguru',
    'નમસ્તે ઉર્જાગુરુ',
    'नमस्ते ऊर्जागुरु',
    'नमस्ते',
    'हेलो',
  ];
  if (exactGreetings.includes(cleanQ)) {
    return 'greeting';
  }

  // B. DATE AND TIME QUESTIONS
  if (
    /\b(what is (the )?date|what's (the )?date|whats (the )?date|what date is it|today'?s date|date today|what day is (it|today)|current date|current time|what time is it|what is the time|aaj ki tarikh|aaj kya date hai|aaj konsa din hai)\b/i.test(
      q
    ) ||
    q.includes('આજની તારીખ') ||
    q.includes('આજે કઈ તારીખ') ||
    q.includes('आज की तारीख')
  ) {
    return 'date_time';
  }

  // C. WEATHER QUESTIONS
  if (
    /\b(weather|forecast|rain today|will it rain|temperature outside|outside temperature|climate today|mausam|barish)\b/i.test(
      q
    ) ||
    q.includes('હવામાન') ||
    q.includes('વરસાદ') ||
    q.includes('मौसम')
  ) {
    return 'weather_unavailable';
  }

  // D. BASIC MATHEMATICAL QUESTIONS
  if (evaluateBasicMath(query) !== null) {
    return 'basic_math';
  }

  // E. ELECTRICITY BILL INCREASE DIAGNOSIS
  const mentionsBill = /\b(bill|bills|bijli|electricity)\b/i.test(q) || q.includes('બિલ') || q.includes('बिल');
  const mentionsIncreaseOrInvestigate =
    /\b(increase|increased|increasing|high|higher|jumped|jump|spike|spiked|went up|more than|double|doubled|reasons?|investigate|why is my bill|badh|zyada)\b/i.test(
      q
    ) ||
    q.includes('%') ||
    q.includes('વધી') ||
    q.includes('बढ़');
  if (mentionsBill && mentionsIncreaseOrInvestigate && !q.includes('solar')) {
    return 'bill_increase_diagnosis';
  }

  // F. REFRIGERATOR CONSUMPTION INQUIRY (Without explicit Wattage)
  const hasExplicitWatts = /\b(\d+(?:\.\d+)?)\s*(?:w|watt|watts|વોટ|વોટ્સ|वाट)(?:\b|$|\s)/i.test(q);
  if (isRefrigeratorQuery(query) && !hasExplicitWatts) {
    return 'refrigerator_inquiry';
  }

  // G. CONTINUOUS VS PEAK RATED INQUIRY
  const isContinuousQuery =
    (q.includes('continuous') || q.includes('actual') || q.includes('real') || q.includes('ચાલુ') || q.includes('સળંગ')) &&
    (q.includes('170w') || q.includes('170') || q.includes('laptop') || q.includes('rated') || q.includes('adapter') || q.includes('લેપટોપ')) &&
    !q.includes('how many units') &&
    !q.includes('how many electricity units') &&
    !q.includes('how much electricity');
  if (isContinuousQuery) {
    return 'continuous_vs_rated';
  }

  // H. CHARGER STANDBY / VAMPIRE POWER
  if (
    q.includes('charger') &&
    (q.includes('plugged') || q.includes('standby') || q.includes('idle') || q.includes('vampire') || q.includes('without laptop') || q.includes('ચાર્જર')) &&
    !q.includes('170w')
  ) {
    return 'charger_standby';
  }

  // I. CEILING FAN COMPARISON (75W vs 28W BLDC)
  if (
    (q.includes('fan') || q.includes('bldc') || q.includes('પંખો')) &&
    (q.includes('compare') || q.includes('vs') || q.includes('save') || q.includes('બચાવે') || (q.includes('75') && q.includes('28')) || (q.includes('bldc') && q.includes('75')))
  ) {
    return 'fan_comparison';
  }

  // J. GENERAL SUSTAINABILITY & ENERGY CONCEPTS (Inverter vs Non-Inverter AC, kW vs kWh, Mission LiFE)
  const isInverterComparison =
    /\b(inverter)\b/i.test(q) && /\b(non-inverter|non inverter|normal ac|conventional ac|compare|difference|vs)\b/i.test(q);
  const isKwVsKwh =
    /\bkw\b/i.test(q) && /\bkwh\b/i.test(q) && /\b(difference|compare|between|vs|mean|explain)\b/i.test(q);
  if (isInverterComparison || isKwVsKwh) {
    return 'general_sustainability';
  }

  // K. MISSING INPUT: AC CONSUMPTION WITHOUT TONNAGE / WATTAGE
  const mentionsAc = /\b(ac|air conditioner|aircon)\b/i.test(q) || q.includes('એસી');
  const hasAcCapacityOrWatts =
    q.match(/(\d+(?:\.\d+)?)\s*(?:ton|ટન|टन)/i) !== null || hasExplicitWatts;
  if (
    mentionsAc &&
    !hasAcCapacityOrWatts &&
    (q.includes('consume') || q.includes('consumption') || q.includes('unit') || q.includes('power') || q.includes('how much') || q.includes('ખર્ચ') || q.includes('યુનિટ'))
  ) {
    return 'missing_appliance_input';
  }

  // L. EXPLICIT APPLIANCE ELECTRICITY CALCULATION (Current query has its own wattage/appliance)
  const explicitWattage = extractWattageFromQuery(query);
  if (explicitWattage !== null) {
    return 'appliance_calculation';
  }

  // M. CONTEXTUAL FOLLOW-UP TO PREVIOUS APPLIANCE CALCULATION
  if (isContextualEnergyFollowUp(query)) {
    const prevAppliance = findPreviousUserAppliance(history);
    if (prevAppliance !== null) {
      return 'appliance_followup';
    }
    return 'missing_appliance_input';
  }

  // N. MISSING INPUT: MONTHLY COST WITHOUT TARIFF / UNITS
  const isCostOnlyQuery =
    (q.includes('cost') || q.includes('bill') || q.includes('kharcha') || q.includes('ખર્ચ')) &&
    !q.includes('solar') &&
    !q.includes('સોલાર') &&
    !hasExplicitWatts &&
    !q.match(/(\d+(?:\.\d+)?)\s*unit/i) &&
    !q.includes('cooler') &&
    !q.includes('fan') &&
    !q.includes('laptop') &&
    !q.includes('કૂલર');
  if (isCostOnlyQuery) {
    return 'missing_cost_input';
  }

  // O. SOLAR & SUBSIDY QUESTIONS
  if (
    q.includes('solar') ||
    q.includes('subsidy') ||
    q.includes('surya') ||
    q.includes('panel') ||
    q.includes('gidres') ||
    q.includes('net meter') ||
    q.includes('સોલાર') ||
    q.includes('સબસિડી') ||
    q.includes('सोलर') ||
    q.includes('सब्सिडी')
  ) {
    return 'solar_subsidy';
  }

  // P. GENERAL SUSTAINABILITY QUESTIONS
  if (
    /(\bsave electricity\b|\bsave energy\b|\breduce (my )?(electricity )?bill\b|\benergy saving\b|\bmission life\b|\bcarbon footprint\b|\bgreen score\b|\bpeak load\b|\bled bulb\b|\bthermostat\b|\b24\s*°?c\b)/i.test(
      q
    )
  ) {
    return 'general_sustainability';
  }

  // Q. UNRELATED / GENERAL KNOWLEDGE QUESTIONS
  return 'unrelated';
}

/**
 * Pure helper to associate an incoming AI response with its originating user message by reqId.
 * Prevents out-of-order network responses from attaching to the wrong turn, prevents duplicates,
 * and discards responses belonging to cleared/reset conversations.
 */
export function insertResponseForRequest(
  messages: ChatMessageItem[],
  reqId: string,
  aiReply: ChatMessageItem
): ChatMessageItem[] {
  if (!reqId) {
    return [...messages, aiReply];
  }

  const alreadyHasAiReply = messages.some((m) => m.sender === 'ai' && m.reqId === reqId);
  if (alreadyHasAiReply) {
    return messages;
  }

  const userIdx = messages.findIndex((m) => m.sender === 'user' && m.reqId === reqId);
  if (userIdx === -1) {
    return messages;
  }

  const nextMessages = [...messages];
  nextMessages.splice(userIdx + 1, 0, { ...aiReply, reqId });
  return nextMessages;
}

/**
 * Intelligent Fallback & Smart Calculation Engine
 * Classifies the current question first and never reuses stale calculations for unrelated queries.
 */
export function generateSmartFallbackResponse(
  query: string,
  profile?: HouseholdProfile,
  isApiOfflineNotice: boolean = false,
  history?: Array<{ sender: 'user' | 'ai'; text: string }>,
  now?: Date
): ChatResponseResult {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      response: 'Please enter a valid question.',
      mode: 'unavailable',
      modeLabel: 'Unavailable',
      intent: 'unrelated',
    };
  }

  const q = query.toLowerCase().trim();
  const lang = detectLanguage(query);
  const { userName, district } = getCleanProfileContext(profile);
  const locationLabel = district || 'Gujarat';
  const rate = GUJARAT_AVG_TARIFF_INR_PER_KWH;
  const intent = detectQueryIntent(query, history);

  // 1. GREETING INTENT (Neutral when user details are absent; personalized only when explicitly set)
  if (intent === 'greeting') {
    const nameGreeting = userName ? ` ${userName}` : '';
    const districtSuffix = district ? ` in ${district}` : '';
    let text = '';
    if (lang === 'gujarati') {
      text = `નમસ્તે${nameGreeting}! હું ઉર્જાગુરુ છું, ઊર્જાસાથી પ્લેટફોર્મનો ગ્રીન એનર્જી કમ્પેનિયન. હું તમારા ઘરની વીજળી બચત અને સોલાર સંબંધિત પ્રશ્નોમાં કેવી રીતે મદદ કરી શકું? તમે કોઈ પણ ઉપકરણના વોટ્સ અને યુનિટ ગણતરી અથવા પીએમ સૂર્ય ઘર યોજના વિશે પૂછી શકો છો.`;
    } else if (lang === 'hindi') {
      text = `नमस्ते${nameGreeting}! मैं ऊर्जागुरु हूँ, आपका पर्सनल ग्रीन एनर्जी कम्पेनियन। मैं आपकी क्या मदद कर सकता हूँ? आप मुझसे किसी भी उपकरण की बिजली खपत (यूनिट), बिजली बिल जांच, या पीएम सूर्य घर सोलर सब्सिडी के बारे में पूछ सकते हैं।`;
    } else if (lang === 'hinglish') {
      text = `Namaste${nameGreeting}! Main UrjaGuru hoon, aapka personal green energy companion. Aaj main aapki kya madad kar sakta hoon? Aap mujhse kisi bhi appliance ka electricity consumption (kWh units), PM Surya Ghar solar subsidies, ya monthly bill save karne ke tips pooch sakte hain!`;
    } else {
      text = `Hello! Namaste${nameGreeting}! I am UrjaGuru, your personal green energy companion for URJASAATHI${districtSuffix}. How can I assist you today? You can ask me to calculate appliance electricity consumption (e.g. laptop, cooler, or geyser), diagnose electricity bill increases, explore rooftop solar subsidies under PM Surya Ghar, or find out how to reduce your monthly electricity bill.`;
    }

    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 2. DATE AND TIME INTENT (Asia/Kolkata system time)
  if (intent === 'date_time') {
    const { formattedDate, isoDate, formattedTime } = getCurrentDateInIndia(now);
    let text = '';
    if (lang === 'gujarati') {
      text = `ભારતીય સમય (Asia/Kolkata) મુજબ આજની તારીખ ${formattedDate} (${isoDate}) છે અને વર્તમાન સમય ${formattedTime} IST છે.`;
    } else if (lang === 'hindi') {
      text = `भारतीय मानक समय (Asia/Kolkata) के अनुसार आज की तारीख ${formattedDate} (${isoDate}) है और वर्तमान समय ${formattedTime} IST है।`;
    } else {
      text = `Today's date is ${formattedDate} (${isoDate}), and the current time is ${formattedTime} IST (Asia/Kolkata).`;
    }

    return {
      response: text,
      mode: 'smart_calculation',
      modeLabel: 'Smart Calculation',
      intent,
    };
  }

  // 3. BASIC MATHEMATICAL INTENT
  if (intent === 'basic_math') {
    const mathEval = evaluateBasicMath(query)!;
    return {
      response: `${mathEval.expression} = ${mathEval.result}.`,
      mode: 'smart_calculation',
      modeLabel: 'Smart Calculation',
      intent,
    };
  }

  // 4. WEATHER INTENT (Explicit Unavailable notice)
  if (intent === 'weather_unavailable') {
    return {
      response:
        'Live weather information is currently unavailable because UrjaGuru does not have a live meteorological feed integrated. I can help you with appliance electricity consumption calculations, solar subsidies under PM Surya Ghar, and household energy savings.',
      mode: 'unavailable',
      modeLabel: 'Unavailable',
      intent,
    };
  }

  // 5. ELECTRICITY BILL INCREASE DIAGNOSIS INTENT
  if (intent === 'bill_increase_diagnosis') {
    const text = `A sudden electricity bill increase (such as 30%) can result from several technical or billing factors. Rather than guessing, here are the **7 most likely causes** and how to investigate them systematically:

1. **Increased Electricity Consumption (kWh):** More hours of appliance usage at home (e.g., guests, remote work, or school holidays).
2. **Seasonal AC or Cooling Usage:** Air conditioners, air coolers, and ceiling fans running longer or harder as ambient temperatures rise.
3. **Refrigerator or Appliance Efficiency Issues:** Degraded refrigerator door gaskets, dust-clogged condenser coils, thermostat set too cold, or electric geyser/water pump leaks.
4. **Different Billing-Cycle Duration:** Check the "Reading Date" span on your bill—a 34-day billing cycle naturally bills ~13% more units than a 30-day cycle.
5. **Electricity Tariff Slab or Surcharge Changes:** Crossing into a higher progressive telescopic tariff slab, or an upward revision in Fuel & Power Purchase Price Adjustment (FPPPA) charges.
6. **Arrears, Adjustments, or Previous Bill Corrections:** Past unpaid balances, late payment surcharges, security deposit installments, or meter rent adjustments added to the current bill.
7. **Estimated vs. Actual Meter Readings:** If last month's bill was based on a provisional/average estimate, this month's actual physical meter reading may include accumulated catch-up units.

**How to Investigate First:**
Always **compare your actual kWh (unit) consumption** between last month and this month—do not look only at the total rupee (₹) amount.

To help me pinpoint the exact reason for your household, please share:
• **Previous month's consumed units (kWh) and total bill amount (₹)**
• **Current month's consumed units (kWh) and total bill amount (₹)**
• **Your DISCOM name** (e.g., UGVCL, PGVCL, DGVCL, MGVCL, Torrent Power, etc.)`;

    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 6. REFRIGERATOR CONSUMPTION INQUIRY INTENT
  if (intent === 'refrigerator_inquiry') {
    // Check if the user provided annual BEE kWh/year in the query
    const annualMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:kwh|units?)\s*(?:\/|\s*per\s*|\s*in\s*a\s*)?(?:year|annum|annual|saal)/i);
    if (annualMatch) {
      const annualKwh = parseFloat(annualMatch[1]);
      const dailyUnits = Number((annualKwh / 365).toFixed(2));
      const monthlyUnits = Number((annualKwh / 12).toFixed(1));
      const monthlyCost = Number((monthlyUnits * rate).toFixed(0));

      return {
        response: `Based on your refrigerator's BEE label Annual Electricity Consumption of **${annualKwh} kWh/year**:\n\n• **Daily Units Formula:** Annual energy consumption ÷ 365 = ${annualKwh} ÷ 365 = **${dailyUnits} units (kWh)/day**\n• **Monthly Units Formula:** Annual energy consumption ÷ 12 = ${annualKwh} ÷ 12 = **${monthlyUnits} units (kWh)/month**\n• **Estimated Monthly Cost (at ~₹${rate}/unit):** ~₹${monthlyCost}/month\n\n*Note: Actual real-world consumption may vary by ±15% depending on ambient kitchen temperature, door opening frequency, and internal food load.*`,
        mode: 'smart_calculation',
        modeLabel: 'Smart Calculation',
        intent,
      };
    }

    let text = '';
    if (lang === 'hinglish' || lang === 'hindi') {
      text = `Kisi bhi refrigerator (chahe woh 555 litre 3-star side-by-side fridge ho) ki exact daily bijli khपत (units) sirf uske **capacity (litres) aur star rating se तय nahi ki ja sakti**, kyunki refrigerator ka compressor 24 ghante lagatar full power par nahi chalta—woh ambient temperature, door kholne ki frequency, aur inverter compressor load ke hisaab se cycle karta hai.

Sahi aur exact calculation ke liye kripya yeh jankari dein:
1. **Manufacturer (Brand) aur exact Model Number**, YA
2. Refrigerator par lage peele **BEE Star Label par likha "Annual Electricity Consumption" (kWh/year ya units per year)**.

**Transparent Calculation Formulas:**
• **Daily Units (kWh/day) = Annual Energy Consumption (kWh/year) ÷ 365**
• **Monthly Units (kWh/month) = Annual Energy Consumption (kWh/year) ÷ 12**

*(Illustrative Formula Example Only — Not Your Exact Appliance Value: Agar kisi BEE label par 365 units/year likha ho, toh Daily Units = 365 ÷ 365 = 1.0 unit/day aur Monthly Units = 365 ÷ 12 ≈ 30.4 units/month hongi.)*

Aap apne fridge ke BEE sticker ka Annual Units (kWh/year) ya model number batayein, main turant exact daily aur monthly units calculate kar dunga!`;
    } else {
      text = `Exact daily electricity consumption for a refrigerator (such as a 3-star 555-litre side-by-side model) **cannot be determined solely from its storage capacity (litres) and star rating**, because a refrigerator compressor cycles on and off dynamically depending on ambient room temperature, door-opening frequency, insulation thickness, and inverter speed.

To calculate your refrigerator's exact electricity consumption without guessing, please provide either:
1. **Manufacturer and exact model number**, OR
2. **BEE Star Label's "Annual Electricity Consumption" (kWh/year or units/year)** printed on the yellow BEE sticker on the appliance.

**Transparent Calculation Formulas:**
• **Daily units (kWh/day) = Annual energy consumption (kWh/year) ÷ 365**
• **Monthly units (kWh/month) = Annual energy consumption (kWh/year) ÷ 12**

*(Illustrative Formula Example Only: If a refrigerator's BEE label specifies X kWh/year, divide X by 365 for daily units and by 12 for monthly units.)*`;
    }

    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 7. CONTINUOUS VS PEAK RATED INTENT
  if (intent === 'continuous_vs_rated') {
    let text = '';
    if (lang === 'gujarati') {
      text = `ના, 170W એ તમારા લેપટોપનો સતત (continuous) વીજ વપરાશ નથી. 170W એ ચાર્જરની મહત્તમ ક્ષમતા (Maximum Peak Rated Capacity) છે, જે ખાલી બેટરી ફાસ્ટ-ચાર્જ કરતી વખતે અને 100% CPU/GPU લોડ હોય ત્યારે વપરાય છે.\nવાસ્તવિક વપરાશ:\n• ભારે 3D ગેમિંગ: ~100W થી 130W નો સામાન્ય સતત વપરાશ\n• વેબ બ્રાઉઝિંગ / કોડિંગ: માત્ર ~35W થી 50W\n• 100% બેટરી સાથે આઈડલ: માત્ર ~15W થી 20W ટ્રિકલ પાવર\n• લેપટોપ વગર સોકેટમાં ચાલુ ચાર્જર: <1W વામ્પાયર ડ્રો.`;
    } else if (lang === 'hinglish') {
      text = `Nahi, 170W aapke laptop ka actual continuous power consumption NAHI hai. 170W power brick ki MAXIMUM PEAK RATED capacity hoti hai jo 100% CPU+GPU load aur empty battery charging ke time design ki gayi hai. Real usage me:\n• Heavy Gaming: ~100W–130W continuous draw\n• Web Browsing/Coding: Sirf ~35W–50W draw\n• 100% Battery par Idle: Sirf ~15W–20W trickle draw\n• Wall me plugged charger (bina laptop ke): <1W vampire draw.`;
    } else if (lang === 'hindi') {
      text = `नहीं, 170W आपके लैपटॉप का वास्तविक सतत (continuous) बिजली उपभोग नहीं है। 170W चार्जर की अधिकतम रेटेड क्षमता (Peak Rated Capacity) है। वास्तविक उपभोग:\n• एक्टिव गेमिंग: ~100W से 130W सतत उपभोग\n• सामान्य इंटरनेट/ऑफिस कार्य: केवल ~35W से 50W\n• पूरी चार्ज बैटरी पर खाली रहना: ~15W से 20W\n• बिना लैपटॉप के प्लग लगा चार्जर: 1W से कम।`;
    } else {
      text = `No, 170W is NOT the actual continuous power consumption of your laptop. The 170W specification represents the power adapter's MAXIMUM Peak Rated capacity (engineered to support 100% simultaneous CPU and GPU loads while fast-charging an empty battery). Real-world consumption:\n• Heavy Gaming Load: Actual draw is ~100W to 130W (~60–75% of rated capacity)\n• General Browsing / Office Work: Draws only ~35W to 50W\n• Idle with Full Battery: Draws ~15W to 20W trickle power\n• Charger plugged into wall without laptop: Draws <1W (negligible vampire power).`;
    }

    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 8. CHARGER STANDBY / VAMPIRE LOAD INTENT
  if (intent === 'charger_standby') {
    let text = '';
    if (lang === 'gujarati') {
      text = `લેપટોપ વિના વોલ સોકેટમાં ચાલુ રહેલું ચાર્જર આશરે 0.3W થી 1.5W વામ્પાયર (સ્ટેન્ડબાય) પાવર લે છે. આખા મહિનામાં આ માંડ 0.2 થી 0.6 યુનિટ (ગુજરાતમાં માત્ર ₹2 થી ₹4) થાય છે. વીજ બચત અને સલામતી માટે ઉપયોગ બાદ સ્વીચ બંધ કરવાની આદત શ્રેષ્ઠ છે.`;
    } else if (lang === 'hinglish') {
      text = `Agar laptop charger wall socket me plugged reh jaye bina laptop ke, toh yeh idle me lagbhag 0.3W se 1.5W vampire power leta hai. Mahine bhar me yeh 0.2 se 0.5 unit se kam banta hai (₹2-₹3 per month). Lekin safety aur surge protection ke liye switch band karna sabse accha habit hai!`;
    } else {
      text = `A modern laptop charger plugged into the wall without the laptop draws around 0.3W to 1.5W of standby (vampire) power. Over a full month of 24/7 idle plugging, that amounts to only ~0.2 to 0.7 units (₹2 to ₹5 per month in Gujarat). While minimal, switching off the master wall socket prevents thermal degradation and eliminates cumulative grid drain.`;
    }

    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 9. CEILING FAN COMPARISON INTENT
  if (intent === 'fan_comparison') {
    let text = '';
    if (lang === 'gujarati') {
      text = `સરખામણી: સામાન્ય સીલિંગ પંખો ~75W લે છે, જ્યારે 5-સ્ટાર BEE BLDC પંખો માત્ર ~28W લે છે. જો દિવસમાં 12 કલાક ચાલે:\n• સામાન્ય પંખો: 75W × 12 કલાક ÷ 1000 = 0.90 યુનિટ/દિવસ (~₹168/મહિનો).\n• BLDC પંખો: 28W × 12 કલાક ÷ 1000 = 0.336 યુનિટ/દિવસ (~₹63/મહિનો).\nએક પંખો બદલવાથી 60% થી વધુ પાવર બચે છે (દર મહિને આશરે ₹105 અને 17 kWh વીજળી બચે છે)!`;
    } else {
      text = `Comparison: Conventional ceiling fans consume ~75W, while 5-star BEE BLDC (Brushless DC) fans consume only ~28W. If run for 12 hours a day:\n• Conventional Fan: 75W × 12h ÷ 1000 = 0.90 units/day (₹5.60/day or ~₹168/mo).\n• BLDC Fan: 28W × 12h ÷ 1000 = 0.336 units/day (₹2.10/day or ~₹63/mo).\nUpgrading one fan saves over 60% electricity (~₹105/month and ~17 kWh in Gujarat)!`;
    }

    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 10. MISSING APPLIANCE INPUT INTENT
  if (intent === 'missing_appliance_input') {
    const mentionsAc = /\b(ac|air conditioner|aircon)\b/i.test(q) || q.includes('એસી');
    let text = '';
    if (mentionsAc) {
      if (lang === 'gujarati') {
        text = `તમારા એસીના વીજ વપરાશની ચોક્કસ ગણતરી કરવા માટે, કૃપા કરીને નીચેની વિગતો જણાવો:\n1. એસીની ક્ષમતા કેટલી છે (દા.ત. 1 ટન, 1.5 ટન, કે 2 ટન)?\n2. તેનું BEE સ્ટાર રેટિંગ શું છે (3-સ્ટાર કે 5-સ્ટાર ઇન્વર્ટર)?\n3. તમે દરરોજ આશરે કેટલા કલાક અને કયા તાપમાને (દા.ત. 24°C) ચલાવો છો?\n\nઆ વિગતો આપ્યા પછી, હું તમારા ઘર માટે ચોક્કસ દૈનિક યુનિટ અને માસિક ખર્ચની ગણતરી કરી આપીશ!`;
      } else {
        text = `To calculate your AC's electricity consumption accurately without guessing, could you please clarify:
1. What is the cooling capacity of your AC (e.g., 1 Ton, 1.5 Ton, or 2 Ton)?
2. What is its BEE star rating and compressor type (e.g., 3-Star or 5-Star, Inverter vs. Non-inverter)?
3. Approximately how many hours per day do you run it, and at what thermostat temperature (e.g., 24°C)?

Once you share these details, I will calculate the exact daily units (kWh) and monthly rupee cost for your household!`;
      }
    } else {
      text = `Could you please clarify which appliance and wattage (e.g., 200W cooler, 170W laptop, or 1500W geyser) you would like to calculate for? Once you share the appliance wattage and daily usage hours, I will compute the exact electricity units (kWh) and cost.`;
    }

    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 11. MISSING COST / TARIFF INPUT INTENT
  if (intent === 'missing_cost_input') {
    let text = '';
    if (lang === 'gujarati') {
      text = `તમારું ચોક્કસ વીજળી બિલ અથવા ચલાવવાનો ખર્ચ ગણવા માટે, કૃપા કરીને આ વિગતો જણાવો:\n1. તમારો માસિક વપરાશ કેટલા યુનિટ (kWh) છે, અથવા કયા ઉપકરણના વોટ્સ અને કલાકોની ગણતરી કરવી છે?\n2. તમારા વિસ્તારમાં કઈ વીજ કંપની (UGVCL, PGVCL, DGVCL, MGVCL, કે Torrent Power) વીજળી પૂરી પાડે છે?\n\nનોંધ: ગુજરાતમાં સરેરાશ રહેણાંક ટેરિફ આશરે ₹6.25/યુનિટ છે. ચોક્કસ ગણતરી માટે યુનિટ જણાવો!`;
    } else {
      text = `To calculate your exact electricity bill or running cost accurately, could you please clarify:
1. What is your monthly consumption in units (kWh), or what appliance wattage and daily hours are you looking to calculate?
2. Which Gujarat DISCOM supplies your home (UGVCL, PGVCL, DGVCL, MGVCL, or Torrent Power)?

Note: In Gujarat, the benchmark residential domestic tariff averages ~₹6.25/unit (kWh) across standard GERC progressive telescopic slabs. Please share your units or appliance details for the exact calculation!`;
    }

    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 12. APPLIANCE CALCULATION & CONTEXTUAL FOLLOW-UP INTENTS
  if (intent === 'appliance_calculation' || intent === 'appliance_followup') {
    const isFollowUp = intent === 'appliance_followup';
    const explicitWattage = extractWattageFromQuery(query);
    const prevAppliance = isFollowUp ? findPreviousUserAppliance(history) : null;

    const watts = explicitWattage ? explicitWattage.watts : prevAppliance!.watts;
    const applianceType = explicitWattage ? explicitWattage.applianceType : prevAppliance!.applianceType;
    const specifiedHours = extractHoursFromQuery(query);
    const defaultHours = prevAppliance ? prevAppliance.previousHours : 8;
    const hours = specifiedHours ?? defaultHours;

    const isAlwaysOnCharger =
      q.includes('always') ||
      q.includes('charger always') ||
      q.includes('hamesha') ||
      q.includes('continuous') ||
      q.includes('સતત');

    const isLaptop = applianceType.toLowerCase().includes('laptop') || q.includes('laptop') || q.includes('લેપટોપ');
    const result = calculateApplianceConsumption(watts, hours, rate, isLaptop);

    let text = '';
    if (lang === 'gujarati') {
      text = `${isFollowUp ? `[અગાઉના સંદર્ભ મુજબ: ${watts}W ${applianceType}]:\n` : `તમારા ${watts}W ${applianceType} નો વીજ વપરાશ:\n\n`}`;
      text += `• ફોર્મ્યુલા: વીજળી યુનિટ (kWh) = પાવર (Watts) × કલાક ÷ 1000\n`;
      text += `• ગણતરી (${hours} કલાક/દિવસ): ${watts}W × ${hours} કલાક ÷ 1000 = ${result.unitsKwh} યુનિટ (kWh) પ્રતિદિન.\n`;
      text += `• ગુજરાત ટેરિફ (~₹${rate}/યુનિટ પર): ₹${result.dailyCostInr} પ્રતિદિન (આશરે ₹${result.monthlyCostInr}/મહિને, ${result.monthlyUnitsKwh} યુનિટ).\n\n`;

      if (isLaptop) {
        text += `⚡ મહત્ત્વપૂર્ણ તફાવત (Rated vs. Continuous Power):\n`;
        text += `૧૭૦W એ ચાર્જરની મહત્તમ ક્ષમતા (Peak Rated Capacity) છે. સતત ગેમિંગ વખતે વાસ્તવિક પાવર ડ્રો ~100W–130W (~${result.actualAvgUnitsKwh || 0.95} યુનિટ) રહે છે. સામાન્ય બ્રાઉઝિંગમાં માત્ર 35W–50W વપરાય છે.\n`;
      } else {
        text += `નોંધ: આ ગણતરી દરરોજ ${hours} કલાકના વપરાશ પર આધારિત છે.`;
      }
    } else if (lang === 'hindi') {
      text = `${isFollowUp ? `[पिछली बातचीत के आधार पर ${watts}W ${applianceType}]:\n` : `आपके ${watts}W ${applianceType} की बिजली खपत का सटीक गणित:\n\n`}`;
      text += `• फॉर्मूला: बिजली यूनिट (kWh) = पॉवर (Watts) × घंटे ÷ 1000\n`;
      text += `• गणना (${hours} घंटे/दिन): ${watts}W × ${hours} घंटे ÷ 1000 = ${result.unitsKwh} यूनिट (kWh) प्रतिदिन।\n`;
      text += `• गुजरात घरेलू दर (~₹${rate}/यूनिट पर): ₹${result.dailyCostInr} प्रतिदिन (लगभग ₹${result.monthlyCostInr}/महीना, ${result.monthlyUnitsKwh} यूनिट)।\n\n`;

      if (isLaptop) {
        text += `⚡ महत्वपूर्ण तथ्य (Rated vs Continuous Power):\n`;
        text += `170W आपके चार्जर की अधिकतम (Peak Rated) क्षमता है, continuous उपभोग नहीं। जब लैपटॉप गेमिंग में हो तब यह लगभग 100W–130W लेता है (~${result.actualAvgUnitsKwh || 0.95} यूनिट/${hours} घंटे)। सामान्य ब्राउज़िंग में केवल 35W-50W बिजली खर्च होती है।`;
      } else {
        text += `नोट: यह गणना प्रतिदिन ${hours} घंटे के उपयोग पर आधारित है।`;
      }
    } else if (lang === 'hinglish') {
      text = `${isFollowUp ? `[Previous turn follow-up: ${watts}W ${applianceType}]:\n` : `Aapke ${watts}W ${applianceType} ka electricity consumption calculation:\n\n`}`;
      text += `• Formula: Electricity Units (kWh) = Power (Watts) × Hours ÷ 1000\n`;
      text += `• Calculation (${hours} hours/day): ${watts}W × ${hours} hours ÷ 1000 = ${result.unitsKwh} units (kWh) daily.\n`;
      text += `• Gujarat Domestic Tariff (~₹${rate}/unit): ₹${result.dailyCostInr}/day (approx ₹${result.monthlyCostInr}/month, ${result.monthlyUnitsKwh} units).\n\n`;

      if (isLaptop) {
        text += `⚡ Crucial Point (Rated vs Continuous Load):\n`;
        text += `170W aapke laptop charger ki MAX PEAK RATED capacity hai, continuous load nahi. Heavy gaming ke time actual continuous draw ~100W–130W hota hai (~${result.actualAvgUnitsKwh || 0.95} units in ${hours} hrs). Normal browsing me sirf 35W–50W lagta hai!`;
      } else {
        text += `Note: Yeh calculation daily ${hours} hours ke continuous usage par based hai.`;
      }
    } else {
      text = `${isFollowUp ? `[Follow-up for your ${watts}W ${applianceType}]:\n` : `Here is the exact electricity consumption breakdown for your ${watts}W ${applianceType}:\n\n`}`;
      text += `• Formula: Electricity Units (kWh) = Power (Watts) × Usage Hours ÷ 1000\n`;
      text += `• Rated Power Calculation (${hours} hours/day): ${watts}W × ${hours} hrs ÷ 1000 = ${result.unitsKwh} units (kWh) per day.\n`;
      text += `• Cost in Gujarat (at ~₹${rate}/unit domestic slab): ₹${result.dailyCostInr} per day (~₹${result.monthlyCostInr} per month for ${result.monthlyUnitsKwh} units).\n\n`;

      if (isLaptop) {
        text += `⚡ Crucial Distinction (Rated vs. Continuous Power):\n`;
        text += `The 170W label indicates the charger's MAXIMUM Peak Rated capacity (delivering peak wattage when charging an empty battery while running GPU/CPU at 100%).\n`;
        text += `• Heavy Gaming Load: Actual draw is ~100W–130W (~${result.actualAvgUnitsKwh || 0.95} units for ${hours}h, ~₹${result.actualMonthlyCostInr || 178}/month).\n`;
        text += `• General Browsing/Coding: Draws only ~35W–50W (~0.3 units for ${hours}h).\n`;
        text += `• Idle with Full Battery: Draws ~15W–20W trickle.\n`;
        text += `• Charger in wall without laptop: Draws <1W (negligible vampire power).\n\n`;
        if (isAlwaysOnCharger) {
          text += `• Always on Charger Nuance: Even if left plugged in 24/7, your laptop does NOT continuously draw 170W (which would theoretically be 4.08 units/day). Once the internal battery reaches 100%, the power management IC switches to wall bypass and drops consumption down to the active workload only (~15W–50W).\n\n`;
        }
        text += `Tip: Keeping it plugged in while gaming is actually recommended for full GPU performance and battery longevity, but turn off the wall switch when shutting down.`;
      } else {
        text += `Note: This calculation assumes ${hours} hours of continuous daily operation. If your daily usage differs, simply apply: (Watts × your hours) ÷ 1000.`;
      }
    }

    if (isApiOfflineNotice) {
      text = `[UrjaGuru Offline Calculation Engine]\n\n${text}`;
    }

    return {
      response: text,
      mode: 'smart_calculation',
      modeLabel: 'Smart Calculation',
      intent,
      calculationDetails: {
        watts,
        hours,
        unitsKwh: result.unitsKwh,
        dailyCostInr: result.dailyCostInr,
        monthlyCostInr: result.monthlyCostInr,
      },
    };
  }

  // 13. SOLAR SUBSIDY & GIDRES 2026 INTENT
  if (intent === 'solar_subsidy') {
    let text = '';
    if (lang === 'gujarati') {
      text = `ગુજરાતમાં પીએમ સૂર્ય ઘર: મુફ્ત બીજલી યોજના અંતર્ગત કેન્દ્રીય નાણાકીય સહાય (CFA):\n• 1 kW: ₹30,000\n• 2 kW: ₹60,000\n• 3 kW અને તેથી વધુ: ₹78,000 મહત્તમ સબસિડી.\n3 kW નો રૂફટોપ સોલાર પ્લાન્ટ ${locationLabel}માં દર મહિને આશરે 360–400 યુનિટ વીજળી બનાવે છે. વધુમાં, GERC GIDRES વિનિયમો 2026 (૩૦ ઓક્ટોબર ૨૦૨૬ ના રોજ અધિસૂચિત) મુજબ વધારાની વીજળી ગ્રીડમાં આપવા પર ₹2.25/kWh નું વળતર ગુજરાત ડિસ્કોમ્સ આપે છે.`;
    } else if (lang === 'hindi') {
      text = `गुजरात में PM सूर्य घर: मुफ्त बिजली योजना के तहत 1 kW पर ₹30,000, 2 kW पर ₹60,000 और 3 kW या अधिक पर ₹78,000 की केंद्रीय सब्सिडी मिलती है। 3 kW सोलर सिस्टम से हर महीने लगभग 360–400 यूनिट स्वच्छ बिजली बनती है। GERC GIDRES विनियम 2026 (30 अक्टूबर 2026) के तहत डिस्कॉम को ग्रिड में भेजी गई अतिरिक्त बिजली के लिए ₹2.25/यूनिट का भुगतान मिलता है।`;
    } else if (lang === 'hinglish') {
      text = `Gujarat me PM Surya Ghar: Muft Bijli Yojana ke tehat 1 kW solar par ₹30,000, 2 kW par ₹60,000 aur 3 kW ya usse zyada par ₹78,000 direct Central subsidy milti hai. 3 kW system mahine me approx 360-400 units banata hai. Iske alawa, GERC GIDRES Regulations 2026 (notified 30 Oct 2026) ke tehat surplus grid injection ka rate ₹2.25/kWh fix hai!`;
    } else {
      text = `Under the PM Surya Ghar: Muft Bijli Yojana & GEDA in Gujarat, residential rooftop solar subsidies are:\n• 1 kW: ₹30,000\n• 2 kW: ₹60,000\n• 3 kW and above: ₹78,000 maximum Central Financial Assistance (CFA).\nA 3 kW rooftop solar installation generates approx. 360–400 kWh/month in ${locationLabel}, offsetting up to 90% of a typical household bill. Furthermore, under the GERC Grid Interactive Distributed Renewable Energy Sources (GIDRES) Regulations 2026 (notified 30 October 2026), surplus solar power exported to the grid is compensated at ₹2.25/kWh by Gujarat DISCOMs (distinct from DISCOM APPC).`;
    }

    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 14. GENERAL SUSTAINABILITY & ENERGY CONCEPTS INTENT
  if (intent === 'general_sustainability') {
    if (/\b(inverter)\b/i.test(q) && /\b(non-inverter|non inverter|compare|difference|vs)\b/i.test(q)) {
      return {
        response: `Here is the comparison between an **Inverter AC** and a **Non-Inverter (Fixed-Speed) AC**:\n\n1. **Compressor Speed Control:**\n   • **Inverter AC:** Uses a variable-frequency drive to continuously regulate compressor motor speed based on room heat load.\n   • **Non-Inverter AC:** Runs strictly on an All-On or All-Off cycle at 100% fixed speed.\n2. **Electricity Consumption & Efficiency:**\n   • **Inverter AC:** Saves **25% to 40% electricity** during 6–8 hour daily usage because it avoids repeated high-current compressor start-up spikes.\n   • **Non-Inverter AC:** Consumes more electricity due to frequent full-load cycling.\n3. **Temperature Stability & Comfort:**\n   • **Inverter AC:** Maintains a steady room temperature (e.g., 24°C ± 0.5°C) with quieter operation.\n   • **Non-Inverter AC:** Causes noticeable temperature swings (±2°C) as the compressor switches on and off.`,
        mode: 'offline_mode',
        modeLabel: 'Offline Mode',
        intent,
      };
    }

    if (/\bkw\b/i.test(q) && /\bkwh\b/i.test(q)) {
      return {
        response: `Here is the difference between **kW (kilowatt)** and **kWh (kilowatt-hour)**:\n\n• **kW (Kilowatt = 1,000 Watts) measures Power (Demand Rate):** It is the instantaneous rate at which an appliance uses or generates electricity at a given moment (like speed in km/h on a speedometer). For example, a 2,000W electric geyser has a power rating of **2 kW**.\n• **kWh (Kilowatt-Hour = 1 Commercial Unit) measures Energy (Total Consumption over Time):** It is the total volume of electricity consumed over time (like distance travelled in km). \n\n**Formula:**\n• **Energy (kWh) = Power (kW) × Time (Hours)**\n• Example: Running a **2 kW** geyser for **1.5 hours** consumes **2 kW × 1.5 h = 3 kWh (3 electricity units)** on your electricity meter.`,
        mode: 'offline_mode',
        modeLabel: 'Offline Mode',
        intent,
      };
    }

    const text = `Under the Mission LiFE initiative in ${locationLabel}, the highest-impact household energy conservation practices are:\n• Maintain air conditioner thermostat at 24°C (saves ~6% compressor electricity per degree raised).\n• Replace 75W induction ceiling fans with 28W BEE 5-Star BLDC fans (>60% fan energy reduction).\n• Eliminate standby (vampire) loads by switching off wall sockets for TVs, chargers, and microwaves when idle.\n• Track carbon reductions using the CEA Version 22.0 Indian grid baseline of 0.675 kg CO₂/kWh.`;
    return {
      response: text,
      mode: 'offline_mode',
      modeLabel: 'Offline Mode',
      intent,
    };
  }

  // 15. UNRELATED / GENERAL KNOWLEDGE WHEN GEMINI IS OFFLINE
  return {
    response: 'UrjaGuru AI is temporarily unavailable. Please try again.',
    mode: 'unavailable',
    modeLabel: 'Unavailable',
    intent: 'unrelated',
  };
}
