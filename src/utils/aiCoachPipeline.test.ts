import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateApplianceConsumption,
  extractWattageFromQuery,
  extractHoursFromQuery,
  detectLanguage,
  detectQueryIntent,
  evaluateBasicMath,
  getCurrentDateInIndia,
  insertResponseForRequest,
  generateSmartFallbackResponse,
  buildCoachWelcomeMessage,
  getCleanProfileContext,
  isRefrigeratorQuery,
  ChatMessageItem,
  GUJARAT_AVG_TARIFF_INR_PER_KWH,
} from './energyMathChat';
import { HouseholdProfile } from './sustainabilityMath';

const mockProfile: HouseholdProfile = {
  name: '',
  city: '',
  district: '',
  familyMembers: 4,
  monthlyKwh: 280,
  monthlyBillInr: 1850,
  appliances: ['ac', 'refrigerator', 'fans_lights'],
  rooftopAvailableSqFt: 350,
  hasSolarInstalled: false,
};

test('Scenario 1: User asks an unrelated greeting in English', () => {
  const query = 'Hello UrjaGuru';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'greeting');
  assert.equal(result.mode, 'offline_mode');
  assert.equal(result.modeLabel, 'Offline Mode');
  assert.match(result.response, /Hello! Namaste! I am UrjaGuru/i);
  assert.match(result.response, /calculate appliance electricity consumption/i);
  assert.doesNotMatch(result.response, /Keeping your AC at 24°C/i);
  assert.doesNotMatch(result.response, /Devanshi Shah|Gandhinagar/i);
});

test('Scenario 2: User asks about a 170W laptop running for 8 hours', () => {
  const query = 'How many electricity units does a 170W laptop consume if run for 8 hours?';
  const wattage = extractWattageFromQuery(query);
  assert.equal(wattage?.watts, 170);

  const hours = extractHoursFromQuery(query);
  assert.equal(hours, 8);

  const calc = calculateApplianceConsumption(170, 8, GUJARAT_AVG_TARIFF_INR_PER_KWH, true);
  assert.equal(calc.unitsKwh, 1.36);
  assert.equal(calc.dailyCostInr, 8.50);

  const result = generateSmartFallbackResponse(query, mockProfile);
  assert.equal(result.intent, 'appliance_calculation');
  assert.equal(result.mode, 'smart_calculation');
  assert.equal(result.calculationDetails?.unitsKwh, 1.36);
  assert.equal(result.calculationDetails?.dailyCostInr, 8.50);
  assert.match(result.response, /170W/i);
  assert.match(result.response, /1\.36 units/i);
  assert.match(result.response, /₹8\.5/i);
  assert.match(result.response, /Peak Rated/i);
  assert.doesNotMatch(result.response, /Keeping your AC at 24°C/i);
});

test('Scenario 3: User asks whether 170W is actual continuous laptop consumption', () => {
  const query = 'Is 170W the actual continuous power consumption of my laptop?';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'continuous_vs_rated');
  assert.equal(result.mode, 'offline_mode');
  assert.match(result.response, /No, 170W is NOT the actual continuous power consumption/i);
  assert.match(result.response, /MAXIMUM Peak Rated capacity/i);
  assert.match(result.response, /~100W to 130W/i);
  assert.match(result.response, /~35W to 50W/i);
  assert.match(result.response, /~15W to 20W/i);
});

test('Scenario 4: User asks about charger standby power', () => {
  const query = 'Does keeping my laptop charger plugged into the wall without laptop consume standby power?';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'charger_standby');
  assert.equal(result.mode, 'offline_mode');
  assert.match(result.response, /charger/i);
  assert.match(result.response, /standby|vampire/i);
  assert.match(result.response, /0\.3W to 1\.5W/i);
  assert.match(result.response, /0\.2 to 0\.7 units/i);
});

test('Scenario 5: User asks a 200W cooler calculation in Hinglish', () => {
  const query = 'Bhai mera 200W ka cooler kitna unit khata hai din me 10 ghante chalaye toh?';
  const lang = detectLanguage(query);
  assert.equal(lang, 'hinglish');

  const result = generateSmartFallbackResponse(query, mockProfile);
  assert.equal(result.intent, 'appliance_calculation');
  assert.equal(result.mode, 'smart_calculation');
  assert.equal(result.calculationDetails?.unitsKwh, 2.0);
  assert.match(result.response, /2 units|2\.0 units/i);
  assert.match(result.response, /₹12\.5/i);
});

test('Scenario 6: User asks for monthly electricity cost without giving a tariff', () => {
  const query = 'What will be my monthly electricity cost for my appliances without knowing my tariff?';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'missing_cost_input');
  assert.equal(result.mode, 'offline_mode');
  assert.match(result.response, /clarify/i);
  assert.match(result.response, /DISCOM/i);
  assert.match(result.response, /₹6\.25\/unit/i);
});

test('Scenario 7: User asks about AC consumption without providing wattage', () => {
  const query = 'How much electricity units does my AC consume?';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'missing_appliance_input');
  assert.equal(result.mode, 'offline_mode');
  assert.match(result.response, /clarify/i);
  assert.match(result.response, /cooling capacity/i);
  assert.match(result.response, /star rating/i);
  assert.match(result.response, /hours per day/i);
});

test('Scenario 8: User asks about 3kW PM Surya Ghar subsidy', () => {
  const query = 'How much subsidy do I get for a 3kW solar panel in Gujarat under PM Surya Ghar?';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'solar_subsidy');
  assert.equal(result.mode, 'offline_mode');
  assert.match(result.response, /₹78,000/);
  assert.match(result.response, /PM Surya Ghar/i);
  assert.match(result.response, /360–400 kWh/i);
  assert.match(result.response, /2\.25\/kWh/i);
});

test('Scenario 9: Gemini API returns an error (Identifies Fallback Mode Correctly)', () => {
  const query = 'I have a 170W gaming laptop on charger. How many electricity units does it consume?';
  const result = generateSmartFallbackResponse(query, mockProfile, true);

  assert.equal(result.intent, 'appliance_calculation');
  assert.equal(result.mode, 'smart_calculation');
  assert.match(result.response, /\[UrjaGuru Offline Calculation Engine\]/i);
  assert.match(result.response, /170W/i);
  assert.match(result.response, /1\.36 units/i);
});

test('Scenario 10: User asks a follow-up question requiring conversation history', () => {
  const history = [
    {
      sender: 'user' as const,
      text: 'I have a 170W gaming laptop running for 8 hours. How many units does it consume?',
    },
    {
      sender: 'ai' as const,
      text: '170W × 8 hrs ÷ 1000 = 1.36 units (kWh) per day, costing ₹8.50.',
    },
  ];

  const followUpQuery = 'What if I run it for only 4 hours instead?';
  const result = generateSmartFallbackResponse(followUpQuery, mockProfile, false, history);

  assert.equal(result.intent, 'appliance_followup');
  assert.equal(result.mode, 'smart_calculation');
  assert.equal(result.calculationDetails?.unitsKwh, 0.68);
  assert.equal(result.calculationDetails?.dailyCostInr, 4.25);
  assert.match(result.response, /170W/i);
  assert.match(result.response, /0\.68 units/i);
  assert.match(result.response, /₹4\.25/i);
});

test('Scenario 11: Gujarati calculation query for 200W cooler running 10 hours', () => {
  const query = 'મારો 200W કૂલર 10 કલાક ચાલે તો કેટલા યુનિટ થાય?';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'appliance_calculation');
  assert.equal(result.mode, 'smart_calculation');
  assert.equal(result.calculationDetails?.unitsKwh, 2.0);
  assert.match(result.response, /૨ યુનિટ|2\.0 યુનિટ|યુનિટ/);
  assert.match(result.response, /₹12\.5/);
});

test('Scenario 12: Gujarati greeting query', () => {
  const query = 'નમસ્તે ઉર્જાગુરુ';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'greeting');
  assert.equal(result.mode, 'offline_mode');
  assert.match(result.response, /નમસ્તે! હું ઉર્જાગુરુ છું/);
});

test('Scenario 13: Hindi calculation query for 100W bulb running 10 hours', () => {
  const query = 'मेरा 100W का बल्ब 10 घंटे चलता है, कितना बिजली बिल आएगा?';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'appliance_calculation');
  assert.equal(result.mode, 'smart_calculation');
  assert.equal(result.calculationDetails?.unitsKwh, 1.0);
  assert.equal(result.calculationDetails?.dailyCostInr, 6.25);
});

test('Scenario 14: Ceiling fan BLDC upgrade comparison', () => {
  const query = 'How much power does a BLDC fan save compared to an old 75W ceiling fan?';
  const result = generateSmartFallbackResponse(query, mockProfile);

  assert.equal(result.intent, 'fan_comparison');
  assert.equal(result.mode, 'offline_mode');
  assert.match(result.response, /75W/);
  assert.match(result.response, /28W/);
  assert.match(result.response, /60%/);
});

test('Scenario 15: Repetitive queries with distinct appliance wattages yield distinct calculations', () => {
  const query1 = 'How many units does a 1500W geyser consume in 2 hours?';
  const res1 = generateSmartFallbackResponse(query1, mockProfile);
  assert.equal(res1.calculationDetails?.unitsKwh, 3.0);

  const query2 = 'How many units does a 500W mixer consume in 1 hour?';
  const res2 = generateSmartFallbackResponse(query2, mockProfile);
  assert.equal(res2.calculationDetails?.unitsKwh, 0.5);
  assert.notEqual(res1.calculationDetails?.unitsKwh, res2.calculationDetails?.unitsKwh);
});

test('Scenario 16: Unrelated non-energy query returns unavailable mode when offline', () => {
  const query = 'Can you write a poem about cricket in Mumbai?';
  const result = generateSmartFallbackResponse(query, mockProfile, true);

  assert.equal(result.intent, 'unrelated');
  assert.equal(result.mode, 'unavailable');
  assert.equal(result.response, 'UrjaGuru AI is temporarily unavailable. Please try again.');
});

test('Issue 2: Electricity bill increased by 30% diagnosis explains 7 causes, kWh vs INR, and asks for bill details', () => {
  const query =
    'My electricity bill has increased by 30% this month. Help me identify possible reasons and suggest how I should investigate it.';
  const result = generateSmartFallbackResponse(query, mockProfile, false);

  assert.equal(result.intent, 'bill_increase_diagnosis');
  assert.equal(result.mode, 'offline_mode');
  assert.match(result.response, /30%/);
  // Verify all 7 likely causes are present
  assert.match(result.response, /1\. \*\*Increased Electricity Consumption/i);
  assert.match(result.response, /2\. \*\*Seasonal AC or Cooling Usage/i);
  assert.match(result.response, /3\. \*\*Refrigerator or Appliance Efficiency Issues/i);
  assert.match(result.response, /4\. \*\*Different Billing-Cycle Duration/i);
  assert.match(result.response, /5\. \*\*Electricity Tariff Slab or Surcharge Changes/i);
  assert.match(result.response, /6\. \*\*Arrears, Adjustments, or Previous Bill Corrections/i);
  assert.match(result.response, /7\. \*\*Estimated vs\. Actual Meter Readings/i);
  // Verify guidance to compare kWh consumption, not only rupee amounts
  assert.match(result.response, /compare your actual kWh \(unit\) consumption.*not look only at the total rupee \(₹\) amount/i);
  // Verify follow-up questions
  assert.match(result.response, /Previous month's consumed units \(kWh\) and total bill amount/i);
  assert.match(result.response, /Current month's consumed units \(kWh\) and total bill amount/i);
  assert.match(result.response, /DISCOM name/i);
});

test('Issue 3: Refrigerator consumption query in Hinglish and misspellings explains BEE annual kWh formula', () => {
  const hinglishQuery =
    'Bhai mere ghar mein 3 star 555 litre ka side by side refrigerator hai. Woh kitni unit bijli khata hoga ek din mein?';
  const result = generateSmartFallbackResponse(hinglishQuery, mockProfile, false);

  assert.equal(result.intent, 'refrigerator_inquiry');
  assert.equal(result.mode, 'offline_mode');
  // Explains exact consumption cannot be determined from capacity and star rating alone
  assert.match(result.response, /capacity \(litres\) aur star rating/i);
  // Asks for manufacturer/model OR BEE label Annual Electricity Consumption (kWh/year)
  assert.match(result.response, /Manufacturer \(Brand\) aur exact Model Number/i);
  assert.match(result.response, /Annual Electricity Consumption.*kWh\/year/i);
  // Shows both formulas
  assert.match(result.response, /Daily Units \(kWh\/day\) = Annual Energy Consumption \(kWh\/year\) ÷ 365/i);
  assert.match(result.response, /Monthly Units \(kWh\/month\) = Annual Energy Consumption \(kWh\/year\) ÷ 12/i);

  // Also test common misspellings: refrigiator, refridgerator, refregerator, frigorific
  assert.equal(isRefrigeratorQuery('How much electricity does my 300L refrigiator use?'), true);
  assert.equal(isRefrigeratorQuery('My refridgerator daily kWh?'), true);
  assert.equal(isRefrigeratorQuery('My refregerator power consumption?'), true);
  assert.equal(isRefrigeratorQuery('How many units does a frigorific consume?'), true);

  const misspelledRes = generateSmartFallbackResponse(
    'How many units does my 555L 3 star refrigiator consume per day?',
    mockProfile,
    false
  );
  assert.equal(misspelledRes.intent, 'refrigerator_inquiry');
  assert.match(misspelledRes.response, /Annual Energy Consumption \(kWh\/year\) ÷ 365/i);

  // When user provides the BEE Annual Electricity Consumption (e.g. 547.5 kWh/year), it computes exact daily & monthly units
  const beeQuery = 'My 555 litre refrigerator BEE label says 547.5 kWh/year. How many units per day?';
  const beeRes = generateSmartFallbackResponse(beeQuery, mockProfile, false);
  assert.equal(beeRes.intent, 'refrigerator_inquiry');
  assert.equal(beeRes.mode, 'smart_calculation');
  assert.match(beeRes.response, /1\.5 units \(kWh\)\/day/i);
});

test('Issue 4: General knowledge question ("Bro, what do you mean by algorithm?") does not reuse previous calculations', () => {
  const history = [
    { sender: 'user' as const, text: 'How many units does my 200W cooler use for 10 hours?' },
    { sender: 'ai' as const, text: '200W × 10 hours ÷ 1000 = 2 units (kWh) per day.' },
  ];
  const query = 'Bro, what do you mean by algorithm?';
  const intent = detectQueryIntent(query, history);
  assert.equal(intent, 'unrelated');

  // When Gemini is offline/unavailable, returns honest unavailable message and never reuses cooler calculation
  const fallbackRes = generateSmartFallbackResponse(query, mockProfile, true, history);
  assert.equal(fallbackRes.mode, 'unavailable');
  assert.doesNotMatch(fallbackRes.response, /200W|Air Cooler|2 units/i);
});

test('Issue 5: Greetings and welcome messages never invent "Devanshi Shah" or "Gandhinagar"', () => {
  // Neutral profile (no name or district set)
  const neutralWelcome = buildCoachWelcomeMessage(mockProfile);
  assert.doesNotMatch(neutralWelcome, /Devanshi Shah|Gandhinagar/i);
  assert.match(neutralWelcome, /^Namaste! I am UrjaGuru/);

  const neutralGreeting = generateSmartFallbackResponse('Hello', mockProfile);
  assert.doesNotMatch(neutralGreeting.response, /Devanshi Shah|Gandhinagar/i);

  // Personalized profile (when user explicitly sets name and district)
  const customProfile: HouseholdProfile = {
    ...mockProfile,
    name: 'Aarav पटेल',
    district: 'Surat',
  };
  const cleanCtx = getCleanProfileContext(customProfile);
  assert.equal(cleanCtx.userName, 'Aarav पटेल');
  assert.equal(cleanCtx.district, 'Surat');

  const customWelcome = buildCoachWelcomeMessage(customProfile);
  assert.match(customWelcome, /Namaste Aarav पटेल!/);
  assert.match(customWelcome, /in Surat/);
});

test('Issue 6: Offline knowledge base handles Inverter vs Non-Inverter AC and kW vs kWh', () => {
  const acCompare = generateSmartFallbackResponse(
    'Compare an inverter AC and a non-inverter AC.',
    mockProfile
  );
  assert.equal(acCompare.intent, 'general_sustainability');
  assert.equal(acCompare.mode, 'offline_mode');
  assert.match(acCompare.response, /variable-frequency drive/i);
  assert.match(acCompare.response, /Fixed-Speed/i);

  const kwCompare = generateSmartFallbackResponse(
    'Explain the difference between kW and kWh.',
    mockProfile
  );
  assert.equal(kwCompare.intent, 'general_sustainability');
  assert.equal(kwCompare.mode, 'offline_mode');
  assert.match(kwCompare.response, /Kilowatt/i);
  assert.match(kwCompare.response, /Kilowatt-Hour/i);
});

test('MANDATORY REGRESSION SUITE (Tests 1 to 8 in Sequential Multi-Turn Session)', () => {
  const sessionHistory: Array<{ sender: 'user' | 'ai'; text: string }> = [];

  // Test 1: Ask about a 200W cooler for 10 hours -> Expected: 2 units
  const q1 = 'How many units does my 200W cooler use for 10 hours?';
  const r1 = generateSmartFallbackResponse(q1, mockProfile, false, sessionHistory);
  assert.equal(r1.intent, 'appliance_calculation');
  assert.equal(r1.calculationDetails?.unitsKwh, 2);
  assert.match(r1.response, /2 units \(kWh\) per day/i);
  sessionHistory.push({ sender: 'user', text: q1 }, { sender: 'ai', text: r1.response });

  // Test 2: Ask "What is the date today?" -> Expected: Actual current date in Asia/Kolkata, NOT cooler calculation
  const q2 = 'What is the date today?';
  const expectedDate = getCurrentDateInIndia();
  const r2 = generateSmartFallbackResponse(q2, mockProfile, false, sessionHistory);
  assert.equal(r2.intent, 'date_time');
  assert.match(r2.response, new RegExp(expectedDate.isoDate));
  assert.doesNotMatch(r2.response, /200W|Air Cooler|1\.36|2 units/i);
  sessionHistory.push({ sender: 'user', text: q2 }, { sender: 'ai', text: r2.response });

  // Test 3: Ask "What's 2+2?" -> Expected: 4, NOT cooler calculation
  const q3 = "What's 2+2?";
  const r3 = generateSmartFallbackResponse(q3, mockProfile, false, sessionHistory);
  assert.equal(r3.intent, 'basic_math');
  assert.equal(r3.response, '2 + 2 = 4.');
  assert.doesNotMatch(r3.response, /200W|Air Cooler/i);
  sessionHistory.push({ sender: 'user', text: q3 }, { sender: 'ai', text: r3.response });

  // Test 4: Ask "What if I use it for only 4 hours?" -> Expected: 0.8 units, referencing previous 200W cooler context
  const q4 = 'What if I use it for only 4 hours?';
  const r4 = generateSmartFallbackResponse(q4, mockProfile, false, sessionHistory);
  assert.equal(r4.intent, 'appliance_followup');
  assert.equal(r4.calculationDetails?.watts, 200);
  assert.equal(r4.calculationDetails?.hours, 4);
  assert.equal(r4.calculationDetails?.unitsKwh, 0.8);
  assert.match(r4.response, /200W Air Cooler/i);
  assert.match(r4.response, /0\.8 units/i);
  sessionHistory.push({ sender: 'user', text: q4 }, { sender: 'ai', text: r4.response });

  // Test 5: Ask "What is the weather today?" -> Expected: Honest unavailable message, NOT cooler calculation
  const q5 = 'What is the weather today?';
  const r5 = generateSmartFallbackResponse(q5, mockProfile, false, sessionHistory);
  assert.equal(r5.intent, 'weather_unavailable');
  assert.equal(r5.mode, 'unavailable');
  assert.match(r5.response, /Live weather information is currently unavailable/i);
  assert.doesNotMatch(r5.response, /200W|Air Cooler|0\.8 units/i);
  sessionHistory.push({ sender: 'user', text: q5 }, { sender: 'ai', text: r5.response });

  // Test 6: Ask about a 170W gaming laptop for 8 hours -> Expected: 1.36 units maximum-rated estimate
  const q6 = 'How many units does a 170W gaming laptop consume for 8 hours?';
  const r6 = generateSmartFallbackResponse(q6, mockProfile, false, sessionHistory);
  assert.equal(r6.intent, 'appliance_calculation');
  assert.equal(r6.calculationDetails?.watts, 170);
  assert.equal(r6.calculationDetails?.hours, 8);
  assert.equal(r6.calculationDetails?.unitsKwh, 1.36);
  assert.match(r6.response, /1\.36 units/i);
  assert.match(r6.response, /MAXIMUM Peak Rated capacity/i);
  sessionHistory.push({ sender: 'user', text: q6 }, { sender: 'ai', text: r6.response });

  // Test 7: Ask "Hi" -> Expected: Friendly greeting, NOT laptop or cooler calculation
  const q7 = 'Hi';
  const r7 = generateSmartFallbackResponse(q7, mockProfile, false, sessionHistory);
  assert.equal(r7.intent, 'greeting');
  assert.equal(r7.mode, 'offline_mode');
  assert.match(r7.response, /Hello! Namaste! I am UrjaGuru/i);
  assert.doesNotMatch(r7.response, /1\.36 units|200W/i);
  sessionHistory.push({ sender: 'user', text: q7 }, { sender: 'ai', text: r7.response });

  // Test 8: Ask "What is 5+7?" -> Expected: 12
  const q8 = 'What is 5+7?';
  const r8 = generateSmartFallbackResponse(q8, mockProfile, false, sessionHistory);
  assert.equal(r8.intent, 'basic_math');
  assert.equal(r8.response, '5 + 7 = 12.');
  assert.doesNotMatch(r8.response, /1\.36 units|200W/i);
});

test('Edge Case: Out-of-order API responses and duplicate prevention via insertResponseForRequest', () => {
  const initialMessages: ChatMessageItem[] = [
    { id: 'u1', sender: 'user', text: "What's 2+2?", timestamp: '10:00', reqId: 'req_1' },
    { id: 'u2', sender: 'user', text: 'What is 5+7?', timestamp: '10:01', reqId: 'req_2' },
  ];

  // Response 2 arrives BEFORE Response 1 (out of order)
  const reply2: ChatMessageItem = {
    id: 'ai2',
    sender: 'ai',
    text: '5 + 7 = 12.',
    timestamp: '10:01',
    reqId: 'req_2',
    mode: 'smart_calculation',
  };
  const afterReply2 = insertResponseForRequest(initialMessages, 'req_2', reply2);
  assert.equal(afterReply2.length, 3);
  assert.equal(afterReply2[2].text, '5 + 7 = 12.');

  // Response 1 arrives later: must be inserted immediately after u1 (index 1), NOT at the end after u2!
  const reply1: ChatMessageItem = {
    id: 'ai1',
    sender: 'ai',
    text: '2 + 2 = 4.',
    timestamp: '10:01',
    reqId: 'req_1',
    mode: 'smart_calculation',
  };
  const afterReply1 = insertResponseForRequest(afterReply2, 'req_1', reply1);
  assert.equal(afterReply1.length, 4);
  assert.equal(afterReply1[0].reqId, 'req_1');
  assert.equal(afterReply1[1].text, '2 + 2 = 4.');
  assert.equal(afterReply1[2].reqId, 'req_2');
  assert.equal(afterReply1[3].text, '5 + 7 = 12.');

  // Duplicate response for req_1 is ignored
  const afterDuplicate = insertResponseForRequest(afterReply1, 'req_1', reply1);
  assert.equal(afterDuplicate.length, 4);
});

test('Edge Case: Conversation reset discards stale in-flight responses and clears appliance context', () => {
  // After reset, only welcome message exists
  const resetMessages: ChatMessageItem[] = [
    { id: 'welcome', sender: 'ai', text: 'Welcome!', timestamp: '10:05' },
  ];
  const staleReply: ChatMessageItem = {
    id: 'ai_old',
    sender: 'ai',
    text: 'Stale response',
    timestamp: '10:05',
    reqId: 'req_old',
  };

  const afterStale = insertResponseForRequest(resetMessages, 'req_old', staleReply);
  assert.equal(afterStale.length, 1); // Stale response discarded

  // Asking a follow-up with empty history after reset asks for clarification instead of inventing an appliance
  const followUpAfterReset = generateSmartFallbackResponse('What if I use it for only 4 hours?', mockProfile, false, []);
  assert.equal(followUpAfterReset.intent, 'missing_appliance_input');
  assert.match(followUpAfterReset.response, /clarify which appliance/i);
});

test('Edge Case: Empty message handling and multi-user conversation isolation', () => {
  const emptyRes = generateSmartFallbackResponse('   ', mockProfile);
  assert.equal(emptyRes.mode, 'unavailable');
  assert.equal(emptyRes.intent, 'unrelated');

  // User A (200W cooler) vs User B in Surat (1500W geyser)
  const historyUserA = [{ sender: 'user' as const, text: 'How many units does my 200W cooler use for 10 hours?' }];
  const historyUserB = [{ sender: 'user' as const, text: 'How many units does my 1500W geyser use for 2 hours?' }];

  const followUpA = generateSmartFallbackResponse('What if I use it for only 4 hours?', mockProfile, false, historyUserA);
  const followUpB = generateSmartFallbackResponse('What if I use it for only 4 hours?', { ...mockProfile, district: 'Surat' }, false, historyUserB);

  assert.equal(followUpA.calculationDetails?.watts, 200);
  assert.equal(followUpA.calculationDetails?.unitsKwh, 0.8);

  assert.equal(followUpB.calculationDetails?.watts, 1500);
  assert.equal(followUpB.calculationDetails?.unitsKwh, 6.0);
});
