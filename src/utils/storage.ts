import { HouseholdProfile, SustainabilityMetrics, calculateSustainabilityMetrics } from './sustainabilityMath';
import { MISSIONS_LIST, Mission } from '../data/missionsData';

export interface CompletedMissionLog {
  missionId: string;
  completedAt: string; // ISO date
  points: number;
  co2SavedKg: number;
  inrSaved: number;
}

export interface AppState {
  profile: HouseholdProfile;
  isOnboarded: boolean;
  completedMissions: Record<string, CompletedMissionLog>;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  badges: string[];
}

const STORAGE_KEY = 'urjasaathi_state_v1';

export const DEFAULT_PROFILE: HouseholdProfile = {
  name: '',
  city: '',
  district: '',
  familyMembers: 4,
  monthlyKwh: 280,
  monthlyBillInr: 1850,
  appliances: ['ac', 'refrigerator', 'fans_lights', 'washing_machine'],
  rooftopAvailableSqFt: 350,
  hasSolarInstalled: false,
};

export const DEMO_PROFILES: Record<string, HouseholdProfile> = {
  gandhinagar: {
    name: '',
    city: 'Gandhinagar',
    district: 'Gandhinagar',
    familyMembers: 4,
    monthlyKwh: 280,
    monthlyBillInr: 1850,
    appliances: ['ac', 'refrigerator', 'fans_lights', 'washing_machine'],
    rooftopAvailableSqFt: 350,
    hasSolarInstalled: false,
  },
  ahmedabad: {
    name: '',
    city: 'Ahmedabad',
    district: 'Ahmedabad',
    familyMembers: 5,
    monthlyKwh: 420,
    monthlyBillInr: 2950,
    appliances: ['ac', 'refrigerator', 'geyser', 'fans_lights', 'water_pump'],
    rooftopAvailableSqFt: 500,
    hasSolarInstalled: false,
  },
  surat: {
    name: '',
    city: 'Surat',
    district: 'Surat',
    familyMembers: 3,
    monthlyKwh: 210,
    monthlyBillInr: 1350,
    appliances: ['refrigerator', 'fans_lights', 'washing_machine'],
    rooftopAvailableSqFt: 180,
    hasSolarInstalled: true,
  },
};

function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.profile) {
        if (
          !parsed.isOnboarded &&
          (parsed.profile.name === 'Devanshi Shah' ||
            parsed.profile.name === 'Jignesh & Hetal Patel' ||
            parsed.profile.name === 'Pooja Choksi')
        ) {
          parsed.profile.name = '';
          parsed.profile.city = '';
          parsed.profile.district = '';
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read localStorage state:', e);
  }

  // Initial seed state
  return {
    profile: DEFAULT_PROFILE,
    isOnboarded: false,
    completedMissions: {
      'm-ac-24': {
        missionId: 'm-ac-24',
        completedAt: new Date(Date.now() - 86400000).toISOString(),
        points: 25,
        co2SavedKg: 2.8,
        inrSaved: 22,
      },
      'm-phantom-power': {
        missionId: 'm-phantom-power',
        completedAt: new Date().toISOString(),
        points: 20,
        co2SavedKg: 1.2,
        inrSaved: 9,
      },
    },
    streakDays: 4,
    lastActiveDate: getTodayString(),
    badges: ['LiFE Pioneer', 'AC Whisperer', 'GEDA Enthusiast'],
  };
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save app state:', e);
  }
}

export function calculateUserAggregates(state: AppState) {
  const completedList = Object.values(state.completedMissions);
  const totalMissions = completedList.length;
  const totalPoints = completedList.reduce((acc, curr) => acc + (curr.points || 0), 0);
  const totalCo2SavedKg = completedList.reduce((acc, curr) => acc + (curr.co2SavedKg || 0), 0);
  const totalInrSaved = completedList.reduce((acc, curr) => acc + (curr.inrSaved || 0), 0);

  const baselineMetrics = calculateSustainabilityMetrics(state.profile);

  // Bonus points boost Green Score
  const scoreBoost = Math.min(10, Math.floor(totalPoints / 25));
  const effectiveGreenScore = Math.min(100, baselineMetrics.greenScore + scoreBoost);

  return {
    totalMissions,
    totalPoints,
    totalCo2SavedKg: Number(totalCo2SavedKg.toFixed(1)),
    totalInrSaved: Math.round(totalInrSaved),
    effectiveGreenScore,
    baselineMetrics,
  };
}
