import { type HouseholdProfile, calculateSustainabilityMetrics } from './sustainabilityMath.ts';
import type { Mission } from '../data/missionsData.ts';

/**
 * Persistence Architecture Notice:
 * URJASAATHI uses browser localStorage ('urjasaathi_state_v1') paired with an in-memory
 * server-side idempotency ledger (/api/missions/complete) for the prototype environment.
 * Every mission completion is uniquely constrained by the composite key:
 *   `${userId}::${missionId}::${completionDate}` (where completionDate is YYYY-MM-DD in Asia/Kolkata).
 */
export interface CompletedMissionLog {
  completionKey: string; // `${userId}::${missionId}::${completionDate}`
  userId: string;
  missionId: string;
  completionDate: string; // YYYY-MM-DD in Asia/Kolkata timezone
  completedAt: string; // ISO timestamp
  points: number;
  co2SavedKg: number;
  inrSaved: number;
}

export interface AppState {
  userId?: string;
  profile: HouseholdProfile;
  isOnboarded: boolean;
  completedMissions: Record<string, CompletedMissionLog>;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD in Asia/Kolkata timezone
  badges: string[];
  persistenceMode?: 'supabase_postgres' | 'local_demo_fallback';
  durableStorageAvailable?: boolean;
  persistenceWarning?: string | null;
}

export interface MissionCompletionResult {
  status: 'completed' | 'already_completed';
  duplicate: boolean;
  userId: string;
  missionId: string;
  completionKey: string;
  completionDate: string; // YYYY-MM-DD in Asia/Kolkata
  pointsAwarded: number;
  streakDays: number;
  streakIncremented: boolean;
  message: string;
  state: AppState;
}

const STORAGE_KEY = 'urjasaathi_state_v1';
export const DEFAULT_USER_ID = 'default_household_user';

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

/**
 * Formats any Date object into YYYY-MM-DD strictly in the Asia/Kolkata (IST, UTC+05:30) timezone.
 */
export function getIndiaDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

/**
 * Computes the calendar day difference (toDate - fromDate) between two YYYY-MM-DD strings.
 * Returns:
 *   0 if same calendar day
 *   1 if toDate is the immediate next calendar day after fromDate
 *   >1 if one or more calendar days were missed between fromDate and toDate
 */
export function getDaysDifferenceIST(fromDateYYYYMMDD: string, toDateYYYYMMDD: string): number {
  if (!fromDateYYYYMMDD || !toDateYYYYMMDD) return NaN;
  const [fy, fm, fd] = fromDateYYYYMMDD.split('-').map(Number);
  const [ty, tm, td] = toDateYYYYMMDD.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return NaN;

  const fromUtcMs = Date.UTC(fy, fm - 1, fd);
  const toUtcMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtcMs - fromUtcMs) / 86400000);
}

/**
 * Returns a deterministic user identifier for mission completion records.
 */
export function getEffectiveUserId(
  stateOrUserId?: Pick<AppState, 'userId' | 'profile'> | string
): string {
  if (typeof stateOrUserId === 'string' && stateOrUserId.trim()) {
    return stateOrUserId.trim();
  }
  if (stateOrUserId && typeof stateOrUserId === 'object') {
    if (stateOrUserId.userId && stateOrUserId.userId.trim()) {
      return stateOrUserId.userId.trim();
    }
  }
  return DEFAULT_USER_ID;
}

/**
 * Generates a deterministic missionId for AI Coach "Adopt Action" items so repeated clicks
 * on the same recommendation map to the exact same missionId.
 */
export function getAdoptedMissionId(title: string): string {
  const slug = (title || 'action')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `adopted-${slug || 'action'}`;
}

/**
 * Builds the composite unique key: userId + missionId + completionDate (Asia/Kolkata).
 */
export function buildMissionCompletionKey(
  userId: string,
  missionId: string,
  completionDateIST: string
): string {
  return `${userId.trim()}::${missionId.trim()}::${completionDateIST.trim()}`;
}

/**
 * Normalizes and deduplicates a completedMissions map so every record has a valid
 * composite completionKey (`userId::missionId::completionDate` in Asia/Kolkata).
 */
export function normalizeCompletedMissions(
  rawCompleted: Record<string, any> | undefined | null,
  defaultUserId: string = DEFAULT_USER_ID,
  now: Date = new Date()
): Record<string, CompletedMissionLog> {
  const normalized: Record<string, CompletedMissionLog> = {};
  if (!rawCompleted || typeof rawCompleted !== 'object') {
    return normalized;
  }

  for (const [rawKey, entry] of Object.entries(rawCompleted)) {
    if (!entry || typeof entry !== 'object') continue;
    const missionId = String(entry.missionId || rawKey).trim();
    if (!missionId) continue;

    const userId = String(entry.userId || defaultUserId).trim() || DEFAULT_USER_ID;
    let completionDate =
      typeof entry.completionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.completionDate)
        ? entry.completionDate
        : '';

    if (!completionDate) {
      const parsedDate = entry.completedAt ? new Date(entry.completedAt) : now;
      completionDate = !isNaN(parsedDate.getTime())
        ? getIndiaDateString(parsedDate)
        : getIndiaDateString(now);
    }

    const completionKey = buildMissionCompletionKey(userId, missionId, completionDate);

    // Enforce uniqueness: keep only the first valid completion for (userId, missionId, completionDate)
    if (!normalized[completionKey]) {
      normalized[completionKey] = {
        completionKey,
        userId,
        missionId,
        completionDate,
        completedAt:
          typeof entry.completedAt === 'string' && entry.completedAt
            ? entry.completedAt
            : now.toISOString(),
        points: Number(entry.points) || 0,
        co2SavedKg: Number(entry.co2SavedKg) || 0,
        inrSaved: Number(entry.inrSaved) || 0,
      };
    }
  }

  return normalized;
}

/**
 * Checks whether a specific mission has been completed by the user on the given Asia/Kolkata date.
 */
export function isMissionCompletedOnDate(
  state: Pick<AppState, 'userId' | 'profile' | 'completedMissions'>,
  missionId: string,
  completionDateIST: string
): boolean {
  if (!state || !state.completedMissions || !missionId || !completionDateIST) {
    return false;
  }
  const userId = getEffectiveUserId(state);
  const key = buildMissionCompletionKey(userId, missionId, completionDateIST);
  if (state.completedMissions[key]) {
    return true;
  }
  return Object.values(state.completedMissions).some(
    (log) =>
      (log.userId || userId) === userId &&
      log.missionId === missionId &&
      log.completionDate === completionDateIST
  );
}

/**
 * Checks whether a specific mission has already been completed today (Asia/Kolkata).
 */
export function isMissionCompletedToday(
  state: Pick<AppState, 'userId' | 'profile' | 'completedMissions'> | undefined | null,
  missionId: string,
  now: Date = new Date()
): boolean {
  if (!state) return false;
  return isMissionCompletedOnDate(state, missionId, getIndiaDateString(now));
}

/**
 * Checks whether a mission has ever been completed by the user (used for lifetime achievement badges).
 */
export function hasEverCompletedMission(
  state: Pick<AppState, 'userId' | 'profile' | 'completedMissions'> | undefined | null,
  missionId: string
): boolean {
  if (!state || !state.completedMissions || !missionId) return false;
  if (state.completedMissions[missionId]) return true;
  const userId = getEffectiveUserId(state);
  return Object.values(state.completedMissions).some(
    (log) => (!log.userId || log.userId === userId) && log.missionId === missionId
  );
}

/**
 * Counts how many unique missions the user has completed today (Asia/Kolkata).
 */
export function getCompletedMissionsTodayCount(
  state: Pick<AppState, 'userId' | 'profile' | 'completedMissions'> | undefined | null,
  now: Date = new Date()
): number {
  if (!state || !state.completedMissions) return 0;
  const userId = getEffectiveUserId(state);
  const todayIST = getIndiaDateString(now);
  const uniqueIds = new Set<string>();

  for (const log of Object.values(state.completedMissions)) {
    const logUser = log.userId || userId;
    const logDate =
      log.completionDate ||
      (log.completedAt ? getIndiaDateString(new Date(log.completedAt)) : '');
    if (logUser === userId && logDate === todayIST) {
      uniqueIds.add(log.missionId);
    }
  }
  return uniqueIds.size;
}

/**
 * Reconciles streak on app load or date rollover without EVER incrementing streak on load.
 * - If lastActiveDate is today or yesterday (in Asia/Kolkata), streakDays is preserved unchanged.
 * - If the user missed one or more full calendar days (diffDays > 1), active streak resets to 0.
 */
export function reconcileStreakOnLoad(state: AppState, now: Date = new Date()): AppState {
  const userId = getEffectiveUserId(state);
  const normalizedMissions = normalizeCompletedMissions(state.completedMissions, userId, now);
  const todayIST = getIndiaDateString(now);

  let lastActiveDate = state.lastActiveDate || '';
  // Ensure lastActiveDate reflects the latest valid completion date if present
  for (const log of Object.values(normalizedMissions)) {
    if ((log.userId || userId) === userId && log.completionDate > lastActiveDate) {
      lastActiveDate = log.completionDate;
    }
  }

  let streakDays = Math.max(0, Number(state.streakDays) || 0);
  if (lastActiveDate) {
    const diffDays = getDaysDifferenceIST(lastActiveDate, todayIST);
    if (diffDays > 1) {
      // User missed at least one full calendar day in Asia/Kolkata
      streakDays = 0;
    }
  } else {
    streakDays = 0;
  }

  return {
    ...state,
    userId,
    completedMissions: normalizedMissions,
    streakDays,
    lastActiveDate,
  };
}

/**
 * Pure, atomic, idempotent function to complete a mission at most once per calendar day (Asia/Kolkata).
 * Enforces:
 * - Unique constraint: userId + missionId + completionDate (Asia/Kolkata)
 * - First valid mission today updates today's activity and increments streak at most once
 *   (increments by 1 if yesterday was active, or starts at 1 if previous day was missed).
 * - Additional missions today award their mission points but do NOT increment streak again.
 * - Clicking an already-completed mission today awards 0 points, 0 streak change, and returns status 'already_completed'.
 */
export function completeMissionOncePerDay(
  prevState: AppState,
  mission: Pick<Mission, 'id' | 'title' | 'points' | 'co2SavedKg' | 'inrSaved'>,
  options?: { now?: Date; userId?: string }
): MissionCompletionResult {
  const now = options?.now ?? new Date();
  const userId = getEffectiveUserId(options?.userId || prevState);
  const reconciledState = reconcileStreakOnLoad(
    { ...prevState, userId },
    now
  );

  const completionDate = getIndiaDateString(now);
  const missionId = String(mission.id).trim();
  const completionKey = buildMissionCompletionKey(userId, missionId, completionDate);

  // 1. Check unique constraint: userId + missionId + completionDate
  if (isMissionCompletedOnDate(reconciledState, missionId, completionDate)) {
    return {
      status: 'already_completed',
      duplicate: true,
      userId,
      missionId,
      completionKey,
      completionDate,
      pointsAwarded: 0,
      streakDays: reconciledState.streakDays,
      streakIncremented: false,
      message: `"${mission.title}" is already completed today (${completionDate}). Come back tomorrow!`,
      state: reconciledState,
    };
  }

  // 2. Check if user already completed another valid mission today (Asia/Kolkata)
  const alreadyActiveToday =
    reconciledState.lastActiveDate === completionDate ||
    getCompletedMissionsTodayCount(reconciledState, now) > 0;

  let nextStreakDays = reconciledState.streakDays;
  let streakIncremented = false;

  if (alreadyActiveToday) {
    // Additional mission on the same day: award mission points, do NOT increment streak again
    nextStreakDays = Math.max(1, reconciledState.streakDays);
    streakIncremented = false;
  } else {
    // First valid mission completed today
    if (reconciledState.lastActiveDate) {
      const diffDays = getDaysDifferenceIST(reconciledState.lastActiveDate, completionDate);
      if (diffDays === 1) {
        // Yesterday was an active day -> increment consecutive day streak by 1
        nextStreakDays = Math.max(1, reconciledState.streakDays) + 1;
        streakIncremented = true;
      } else if (diffDays === 0) {
        nextStreakDays = Math.max(1, reconciledState.streakDays);
        streakIncremented = false;
      } else {
        // Missed one or more calendar days -> reset active streak to 1 for today
        nextStreakDays = 1;
        streakIncremented = true;
      }
    } else {
      // Very first active day
      nextStreakDays = 1;
      streakIncremented = true;
    }
  }

  const newLog: CompletedMissionLog = {
    completionKey,
    userId,
    missionId,
    completionDate,
    completedAt: now.toISOString(),
    points: Number(mission.points) || 0,
    co2SavedKg: Number(mission.co2SavedKg) || 0,
    inrSaved: Number(mission.inrSaved) || 0,
  };

  const nextState: AppState = {
    ...reconciledState,
    userId,
    completedMissions: {
      ...reconciledState.completedMissions,
      [completionKey]: newLog,
    },
    streakDays: nextStreakDays,
    lastActiveDate: completionDate,
  };

  const streakMsg = streakIncremented
    ? ` Daily streak is now ${nextStreakDays} ${nextStreakDays === 1 ? 'day' : 'days'}!`
    : '';

  return {
    status: 'completed',
    duplicate: false,
    userId,
    missionId,
    completionKey,
    completionDate,
    pointsAwarded: newLog.points,
    streakDays: nextStreakDays,
    streakIncremented,
    message: `Completed "${mission.title}"! +${newLog.points} LiFE points credited.${streakMsg}`,
    state: nextState,
  };
}

/**
 * Concurrency-safe coordinator that serializes simultaneous completion requests
 * (e.g. 10 rapid clicks or parallel Promise.all calls) against a single authoritative state.
 */
export class MissionCompletionCoordinator {
  private state: AppState;
  private lockChain: Promise<void> = Promise.resolve();

  constructor(initialState: AppState, now?: Date) {
    this.state = reconcileStreakOnLoad(initialState, now);
  }

  public getState(now?: Date): AppState {
    if (now) {
      this.state = reconcileStreakOnLoad(this.state, now);
    }
    return this.state;
  }

  public setState(nextState: AppState, now?: Date): AppState {
    this.state = reconcileStreakOnLoad(nextState, now);
    return this.state;
  }

  /**
   * Synchronous atomic completion (handles rapid synchronous clicks in the same event loop tick).
   */
  public completeSync(
    mission: Pick<Mission, 'id' | 'title' | 'points' | 'co2SavedKg' | 'inrSaved'>,
    options?: { now?: Date; userId?: string }
  ): MissionCompletionResult {
    const result = completeMissionOncePerDay(this.state, mission, options);
    this.state = result.state;
    return result;
  }

  /**
   * Asynchronous serialized completion (handles simultaneous network/async requests safely).
   */
  public async completeAsync(
    mission: Pick<Mission, 'id' | 'title' | 'points' | 'co2SavedKg' | 'inrSaved'>,
    options?: { now?: Date; userId?: string }
  ): Promise<MissionCompletionResult> {
    let result!: MissionCompletionResult;
    const nextOp = this.lockChain.then(async () => {
      result = completeMissionOncePerDay(this.state, mission, options);
      this.state = result.state;
    });
    this.lockChain = nextOp.catch(() => {});
    await nextOp;
    return result;
  }
}

export function getStorageKeyForUser(userId?: string): string {
  const cleanId = (userId || '').trim();
  if (!cleanId || cleanId === DEFAULT_USER_ID) {
    return STORAGE_KEY;
  }
  return `urjasaathi_user_state_v2_${cleanId}`;
}

export function getChatStorageKeyForUser(userId?: string): string {
  const cleanId = (userId || '').trim() || DEFAULT_USER_ID;
  return `urjasaathi_chat_history_v2_${cleanId}`;
}

/**
 * Creates a clean, isolated initial state for an authenticated Google user.
 * - Uses the authenticated Supabase user UUID as internal userId.
 * - Pre-fills only the authenticated Google user's name (never hardcodes names or districts).
 * - Never transfers anonymous or demo mission records into the authenticated Google account.
 */
export function createInitialAuthenticatedUserState(
  authUser: {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string | null;
  },
  now: Date = new Date()
): AppState {
  const userId = authUser.id.trim();
  return reconcileStreakOnLoad(
    {
      userId,
      profile: {
        ...DEFAULT_PROFILE,
        name: (authUser.name || '').trim(),
        city: '',
        district: '',
      },
      isOnboarded: false,
      completedMissions: {},
      streakDays: 0,
      lastActiveDate: '',
      badges: ['LiFE Pioneer'],
    },
    now
  );
}

export function createInitialSeedState(now: Date = new Date()): AppState {
  const userId = DEFAULT_USER_ID;
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const twoDaysAgoDate = new Date(now.getTime() - 2 * 86400000);

  const yesterdayIST = getIndiaDateString(yesterdayDate);
  const twoDaysAgoIST = getIndiaDateString(twoDaysAgoDate);

  const key1 = buildMissionCompletionKey(userId, 'm-phantom-power', twoDaysAgoIST);
  const key2 = buildMissionCompletionKey(userId, 'm-ac-24', yesterdayIST);

  return {
    userId,
    profile: DEFAULT_PROFILE,
    isOnboarded: false,
    completedMissions: {
      [key1]: {
        completionKey: key1,
        userId,
        missionId: 'm-phantom-power',
        completionDate: twoDaysAgoIST,
        completedAt: twoDaysAgoDate.toISOString(),
        points: 20,
        co2SavedKg: 1.2,
        inrSaved: 9,
      },
      [key2]: {
        completionKey: key2,
        userId,
        missionId: 'm-ac-24',
        completionDate: yesterdayIST,
        completedAt: yesterdayDate.toISOString(),
        points: 25,
        co2SavedKg: 2.8,
        inrSaved: 22,
      },
    },
    streakDays: 4,
    lastActiveDate: yesterdayIST,
    badges: ['LiFE Pioneer', 'AC Whisperer', 'GEDA Enthusiast'],
  };
}

export function loadAppState(now: Date = new Date(), userId?: string): AppState {
  const cleanUserId = (userId || '').trim();
  const isAuthenticatedUser = Boolean(cleanUserId && cleanUserId !== DEFAULT_USER_ID);
  const storageKey = getStorageKeyForUser(cleanUserId);

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.profile) {
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
          // Strictly isolate mission completions to this user ID
          const targetId = isAuthenticatedUser ? cleanUserId : parsed.userId || DEFAULT_USER_ID;
          const filteredMissions: Record<string, CompletedMissionLog> = {};
          for (const [k, v] of Object.entries(parsed.completedMissions || {})) {
            const log = v as CompletedMissionLog;
            if (!log.userId || log.userId === targetId) {
              filteredMissions[k] = { ...log, userId: targetId };
            }
          }
          return reconcileStreakOnLoad(
            {
              ...(parsed as AppState),
              userId: targetId,
              completedMissions: filteredMissions,
            },
            now
          );
        }
      }
    }
  } catch (e) {
    console.warn('Could not read localStorage state:', e);
  }

  if (isAuthenticatedUser) {
    return createInitialAuthenticatedUserState({ id: cleanUserId }, now);
  }

  return createInitialSeedState(now);
}

export function saveAppState(state: AppState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const key = getStorageKeyForUser(state.userId);
      localStorage.setItem(key, JSON.stringify(state));
    }
  } catch (e) {
    console.error('Failed to save app state:', e);
  }
}

export function calculateUserAggregates(state: AppState) {
  const userId = getEffectiveUserId(state);
  const normalized = normalizeCompletedMissions(state.completedMissions, userId);
  const completedList = Object.values(normalized).filter(
    (entry) => (entry.userId || userId) === userId
  );

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

