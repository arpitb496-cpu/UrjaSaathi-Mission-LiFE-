import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AppState,
  DEFAULT_PROFILE,
  MissionCompletionCoordinator,
  buildMissionCompletionKey,
  calculateUserAggregates,
  completeMissionOncePerDay,
  getAdoptedMissionId,
  getIndiaDateString,
  isMissionCompletedOnDate,
  reconcileStreakOnLoad,
} from './storage.ts';

function createFreshState(overrides: Partial<AppState> = {}): AppState {
  const userId = overrides.userId || 'user-test-101';
  const yesterdayKey = buildMissionCompletionKey(userId, 'seed-m0', '2026-11-01');
  return {
    userId,
    profile: { ...DEFAULT_PROFILE },
    isOnboarded: true,
    completedMissions: {
      [yesterdayKey]: {
        completionKey: yesterdayKey,
        userId,
        missionId: 'seed-m0',
        completionDate: '2026-11-01',
        completedAt: '2026-11-01T10:00:00.000Z',
        points: 100,
        co2SavedKg: 5,
        inrSaved: 250,
      },
    },
    streakDays: 3,
    lastActiveDate: '2026-11-01', // Yesterday relative to 2026-11-02 IST
    badges: ['LiFE Pioneer'],
    ...overrides,
  };
}

const SAMPLE_MISSION = {
  id: 'm1',
  title: 'AC 24°C Golden Rule',
  points: 50,
  co2SavedKg: 1.8,
  inrSaved: 36,
};

const SECOND_MISSION = {
  id: 'm2',
  title: 'Geyser Timer Discipline',
  points: 40,
  co2SavedKg: 1.5,
  inrSaved: 30,
};

const THIRD_MISSION = {
  id: 'm3',
  title: 'Eliminate Vampire Standby Loads',
  points: 25,
  co2SavedKg: 0.7,
  inrSaved: 14,
};

// Fixed timestamps in Asia/Kolkata (UTC+05:30)
const DAY_1_IST_NOON = new Date('2026-11-02T06:30:00.000Z'); // 2026-11-02 12:00:00 IST
const DAY_2_IST_NOON = new Date('2026-11-03T06:30:00.000Z'); // 2026-11-03 12:00:00 IST

describe('Mission Reward & Streak Duplication Prevention Suite (10 Mandatory Scenarios)', () => {
  it('Test 1: First click on a mission awards points once, records userId + missionId + completionDate, and increments streak by 1', () => {
    const initialState = createFreshState({ lastActiveDate: '2026-11-01', streakDays: 3 });

    const res = completeMissionOncePerDay(initialState, SAMPLE_MISSION, { now: DAY_1_IST_NOON });
    const agg = calculateUserAggregates(res.state);

    assert.equal(res.status, 'completed');
    assert.equal(res.duplicate, false);
    assert.equal(res.pointsAwarded, 50);
    assert.equal(res.streakIncremented, true);
    assert.equal(res.streakDays, 4);
    assert.equal(agg.totalPoints, 150);
    assert.equal(res.state.lastActiveDate, '2026-11-02');
    assert.equal(
      res.completionKey,
      buildMissionCompletionKey('user-test-101', 'm1', '2026-11-02')
    );
    assert.equal(isMissionCompletedOnDate(res.state, 'm1', '2026-11-02'), true);
  });

  it('Test 2: Second click on the same mission on the same day awards 0 points, 0 streak, no duplicate record, and returns already_completed', () => {
    const initialState = createFreshState({ lastActiveDate: '2026-11-01', streakDays: 3 });

    const firstClick = completeMissionOncePerDay(initialState, SAMPLE_MISSION, { now: DAY_1_IST_NOON });
    const secondClick = completeMissionOncePerDay(firstClick.state, SAMPLE_MISSION, { now: DAY_1_IST_NOON });
    const agg = calculateUserAggregates(secondClick.state);

    assert.equal(secondClick.status, 'already_completed');
    assert.equal(secondClick.duplicate, true);
    assert.equal(secondClick.pointsAwarded, 0);
    assert.equal(secondClick.streakIncremented, false);
    assert.equal(secondClick.streakDays, 4);
    assert.equal(agg.totalPoints, 150);
    assert.equal(Object.keys(secondClick.state.completedMissions).length, 2); // seed-m0 + m1
  });

  it('Test 3: Ten rapid clicks on Complete Mission and Adopt Action award points and streak only once', () => {
    const coordinator = new MissionCompletionCoordinator(
      createFreshState({ lastActiveDate: '2026-11-01', streakDays: 5 }),
      DAY_1_IST_NOON
    );

    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(coordinator.completeSync(SAMPLE_MISSION, { now: DAY_1_IST_NOON }));
    }

    assert.equal(results[0].status, 'completed');
    assert.equal(results[0].pointsAwarded, 50);
    assert.equal(results[0].streakIncremented, true);
    assert.equal(results[0].streakDays, 6);

    for (let i = 1; i < 10; i++) {
      assert.equal(results[i].status, 'already_completed');
      assert.equal(results[i].duplicate, true);
      assert.equal(results[i].pointsAwarded, 0);
      assert.equal(results[i].streakIncremented, false);
      assert.equal(results[i].streakDays, 6);
      assert.equal(calculateUserAggregates(results[i].state).totalPoints, 150);
    }

    // Also test 10 rapid clicks on AI Coach "Adopt Action" recommendation
    const recTitle = 'Set AC to 24°C and clean filters every 2 weeks';
    const adoptedMission = {
      id: getAdoptedMissionId(recTitle),
      title: recTitle,
      points: 30,
      co2SavedKg: 1.5,
      inrSaved: 15,
    };

    const adoptResults = [];
    for (let i = 0; i < 10; i++) {
      adoptResults.push(coordinator.completeSync(adoptedMission, { now: DAY_1_IST_NOON }));
    }

    assert.equal(adoptResults[0].status, 'completed');
    assert.equal(adoptResults[0].pointsAwarded, 30);
    // Streak already incremented earlier today on SAMPLE_MISSION, so streak remains 6
    assert.equal(adoptResults[0].streakIncremented, false);
    assert.equal(adoptResults[0].streakDays, 6);
    assert.equal(calculateUserAggregates(adoptResults[0].state).totalPoints, 180);

    for (let i = 1; i < 10; i++) {
      assert.equal(adoptResults[i].status, 'already_completed');
      assert.equal(adoptResults[i].pointsAwarded, 0);
      assert.equal(calculateUserAggregates(adoptResults[i].state).totalPoints, 180);
    }
  });

  it('Test 4: Page refresh / reloading state on the same day does not change streak or reset completed status', () => {
    const initialState = createFreshState({ lastActiveDate: '2026-11-01', streakDays: 3 });
    const afterFirstCompletion = completeMissionOncePerDay(initialState, SAMPLE_MISSION, {
      now: DAY_1_IST_NOON,
    }).state;

    // Simulate page reload and streak reconciliation
    const reloadedOnce = reconcileStreakOnLoad(
      JSON.parse(JSON.stringify(afterFirstCompletion)),
      DAY_1_IST_NOON
    );
    const reloadedTwice = reconcileStreakOnLoad(
      JSON.parse(JSON.stringify(reloadedOnce)),
      DAY_1_IST_NOON
    );

    assert.equal(reloadedTwice.streakDays, 4);
    assert.equal(calculateUserAggregates(reloadedTwice).totalPoints, 150);
    assert.equal(isMissionCompletedOnDate(reloadedTwice, 'm1', '2026-11-02'), true);

    // Clicking again after page reload must still be blocked
    const clickAfterRefresh = completeMissionOncePerDay(reloadedTwice, SAMPLE_MISSION, {
      now: DAY_1_IST_NOON,
    });
    assert.equal(clickAfterRefresh.status, 'already_completed');
    assert.equal(clickAfterRefresh.pointsAwarded, 0);
    assert.equal(clickAfterRefresh.streakDays, 4);
  });

  it('Test 5: Session reload / logout-login preserves per-user completion lock and isolates distinct userIds', () => {
    const userAState = createFreshState({
      userId: 'user-alpha',
      lastActiveDate: '2026-11-01',
      streakDays: 2,
    });

    // User Alpha completes mission m1
    const userAAfter = completeMissionOncePerDay(userAState, SAMPLE_MISSION, {
      now: DAY_1_IST_NOON,
    });
    assert.equal(userAAfter.status, 'completed');
    assert.equal(userAAfter.streakDays, 3);

    // User Alpha logs out and logs back in (session reload)
    const userAReloaded = reconcileStreakOnLoad(
      JSON.parse(JSON.stringify(userAAfter.state)),
      DAY_1_IST_NOON
    );
    const userARetry = completeMissionOncePerDay(userAReloaded, SAMPLE_MISSION, {
      now: DAY_1_IST_NOON,
    });
    assert.equal(userARetry.status, 'already_completed');
    assert.equal(userARetry.pointsAwarded, 0);
    assert.equal(userARetry.streakDays, 3);

    // Switching to User Beta on the same state ledger allows User Beta to complete m1 independently
    const userBState: AppState = {
      ...userAReloaded,
      userId: 'user-beta',
      lastActiveDate: '2026-11-01',
      streakDays: 1,
    };
    const userBAfter = completeMissionOncePerDay(userBState, SAMPLE_MISSION, {
      now: DAY_1_IST_NOON,
      userId: 'user-beta',
    });
    assert.equal(userBAfter.status, 'completed');
    assert.equal(userBAfter.pointsAwarded, 50);
    assert.equal(userBAfter.streakDays, 2);
  });

  it('Test 6: Completing multiple distinct missions in one day awards each mission its points but increments streak only once', () => {
    const initialState = createFreshState({ lastActiveDate: '2026-11-01', streakDays: 4 });

    const first = completeMissionOncePerDay(initialState, SAMPLE_MISSION, { now: DAY_1_IST_NOON });
    assert.equal(first.status, 'completed');
    assert.equal(first.pointsAwarded, 50);
    assert.equal(first.streakIncremented, true);
    assert.equal(first.streakDays, 5);
    assert.equal(calculateUserAggregates(first.state).totalPoints, 150);

    const second = completeMissionOncePerDay(first.state, SECOND_MISSION, { now: DAY_1_IST_NOON });
    assert.equal(second.status, 'completed');
    assert.equal(second.pointsAwarded, 40);
    assert.equal(second.streakIncremented, false);
    assert.equal(second.streakDays, 5);
    assert.equal(calculateUserAggregates(second.state).totalPoints, 190);

    const third = completeMissionOncePerDay(second.state, THIRD_MISSION, { now: DAY_1_IST_NOON });
    assert.equal(third.status, 'completed');
    assert.equal(third.pointsAwarded, 25);
    assert.equal(third.streakIncremented, false);
    assert.equal(third.streakDays, 5);
    assert.equal(calculateUserAggregates(third.state).totalPoints, 215);
  });

  it('Test 7: Recurring mission can be completed again on the next calendar day (Asia/Kolkata) and increments consecutive streak by 1', () => {
    const initialState = createFreshState({ lastActiveDate: '2026-11-01', streakDays: 3 });

    const day1Result = completeMissionOncePerDay(initialState, SAMPLE_MISSION, {
      now: DAY_1_IST_NOON,
    });
    assert.equal(day1Result.status, 'completed');
    assert.equal(day1Result.streakDays, 4);
    assert.equal(calculateUserAggregates(day1Result.state).totalPoints, 150);

    // Next day in Asia/Kolkata: same mission m1 is eligible again
    assert.equal(isMissionCompletedOnDate(day1Result.state, 'm1', '2026-11-03'), false);

    const day2Result = completeMissionOncePerDay(day1Result.state, SAMPLE_MISSION, {
      now: DAY_2_IST_NOON,
    });
    assert.equal(day2Result.status, 'completed');
    assert.equal(day2Result.duplicate, false);
    assert.equal(day2Result.pointsAwarded, 50);
    assert.equal(day2Result.streakIncremented, true);
    assert.equal(day2Result.streakDays, 5);
    assert.equal(calculateUserAggregates(day2Result.state).totalPoints, 200);
    // Both days' completion records remain preserved
    assert.equal(isMissionCompletedOnDate(day2Result.state, 'm1', '2026-11-02'), true);
    assert.equal(isMissionCompletedOnDate(day2Result.state, 'm1', '2026-11-03'), true);
  });

  it('Test 8: Missing a calendar day resets the active streak to 0 on load and starts at 1 when a mission is completed', () => {
    const initialState = createFreshState({ lastActiveDate: '2026-11-01', streakDays: 7 });

    // Opening the app on 2026-11-03 after missing 2026-11-02 completely resets active streak to 0
    const reconciled = reconcileStreakOnLoad(initialState, DAY_2_IST_NOON);
    assert.equal(reconciled.streakDays, 0);

    // Completing a mission on 2026-11-03 starts a fresh streak of 1
    const completed = completeMissionOncePerDay(reconciled, SAMPLE_MISSION, {
      now: DAY_2_IST_NOON,
    });
    assert.equal(completed.status, 'completed');
    assert.equal(completed.streakIncremented, true);
    assert.equal(completed.streakDays, 1);
    assert.equal(calculateUserAggregates(completed.state).totalPoints, 150);
  });

  it('Test 9: Two simultaneous requests for the same mission are serialized atomically so only one awards points', async () => {
    const coordinator = new MissionCompletionCoordinator(
      createFreshState({ lastActiveDate: '2026-11-01', streakDays: 2 }),
      DAY_1_IST_NOON
    );

    const [resA, resB] = await Promise.all([
      coordinator.completeAsync(SAMPLE_MISSION, { now: DAY_1_IST_NOON }),
      coordinator.completeAsync(SAMPLE_MISSION, { now: DAY_1_IST_NOON }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, ['already_completed', 'completed']);

    const totalPointsAwarded = resA.pointsAwarded + resB.pointsAwarded;
    assert.equal(totalPointsAwarded, 50);

    const finalState = coordinator.getState();
    assert.equal(calculateUserAggregates(finalState).totalPoints, 150);
    assert.equal(finalState.streakDays, 3);
    assert.equal(Object.keys(finalState.completedMissions).length, 2); // seed-m0 + m1
  });

  it('Test 10: Timezone boundary around midnight in India (Asia/Kolkata UTC+05:30) handles same-day and next-day transitions accurately', () => {
    // Case A: 23:55 IST on Nov 2 (18:25 UTC Nov 2) vs 00:05 IST on Nov 3 (18:35 UTC Nov 2)
    // Even though both timestamps have the same UTC date (2026-11-02), they are consecutive calendar days in India!
    const justBeforeMidnightIST = new Date('2026-11-02T18:25:00.000Z'); // 2026-11-02 23:55:00 IST
    const justAfterMidnightIST = new Date('2026-11-02T18:35:00.000Z');  // 2026-11-03 00:05:00 IST

    const dateBeforeIST = getIndiaDateString(justBeforeMidnightIST);
    const dateAfterIST = getIndiaDateString(justAfterMidnightIST);

    assert.equal(dateBeforeIST, '2026-11-02');
    assert.equal(dateAfterIST, '2026-11-03');

    const initialState = createFreshState({ lastActiveDate: '2026-11-01', streakDays: 1 });
    const beforeMidnightRes = completeMissionOncePerDay(initialState, SAMPLE_MISSION, {
      now: justBeforeMidnightIST,
    });
    assert.equal(beforeMidnightRes.status, 'completed');
    assert.equal(beforeMidnightRes.streakDays, 2);

    const afterMidnightRes = completeMissionOncePerDay(beforeMidnightRes.state, SAMPLE_MISSION, {
      now: justAfterMidnightIST,
    });
    assert.equal(afterMidnightRes.status, 'completed');
    assert.equal(afterMidnightRes.streakDays, 3);
    assert.equal(calculateUserAggregates(afterMidnightRes.state).totalPoints, 200);

    // Case B: 05:25 IST on Nov 3 (23:55 UTC Nov 2) vs 05:35 IST on Nov 3 (00:05 UTC Nov 3)
    // Even though UTC midnight crossed between these two timestamps, both are on 2026-11-03 in Asia/Kolkata!
    const beforeUtcMidnight = new Date('2026-11-02T23:55:00.000Z'); // 2026-11-03 05:25:00 IST
    const afterUtcMidnight = new Date('2026-11-03T00:05:00.000Z');  // 2026-11-03 05:35:00 IST

    assert.equal(getIndiaDateString(beforeUtcMidnight), '2026-11-03');
    assert.equal(getIndiaDateString(afterUtcMidnight), '2026-11-03');

    const duplicateAcrossUtcMidnight = completeMissionOncePerDay(
      afterMidnightRes.state,
      SAMPLE_MISSION,
      { now: afterUtcMidnight }
    );
    assert.equal(duplicateAcrossUtcMidnight.status, 'already_completed');
    assert.equal(duplicateAcrossUtcMidnight.pointsAwarded, 0);
    assert.equal(duplicateAcrossUtcMidnight.streakDays, 3);
  });
});
