import test from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../dist/plan.js';
import { createSession, summary, validSet, previousSets, exerciseSeries, validateBackup, weekDays, localDate } from '../dist/domain.js';

const completedSession = (kg = 70, reps = 8, date = '2026-10-26T12:00:00Z') => {
  const session = createSession(plan[0], new Date(date));
  session.exercises[0].sets[0] = { kg, reps, done: true };
  session.finishedAt = new Date(Date.parse(date) + 3600000).toISOString();
  return session;
};
test('the source split and exercise counts are preserved', () => {
  assert.deepEqual(plan.map(w => w.name), ['Push', 'Pull', 'Legs + Core', 'Upper', 'Lower']);
  assert.deepEqual(plan.map(w => w.exercises.length), [6, 6, 8, 7, 8]);
  assert.equal(plan[0].exercises[0].name, 'Bench Press');
  assert.equal(plan[4].exercises.at(-1).name, 'Landmine Twist');
});
test('starting a session never invents performed weights or reps', () => {
  const session = createSession(plan[0]);
  assert.equal(summary(session).sets, 0);
  assert.equal(session.exercises[0].sets[0].kg, '');
  assert.equal(session.exercises[1].sets[0].kg, 0);
  assert.equal(session.exercises[1].sets[0].reps, '');
});
test('completion requires integer reps and explicit valid weight, allowing bodyweight', () => {
  for (const s of [{ reps: '', kg: 50 }, { reps: 8, kg: '' }, { reps: 1.5, kg: 20 }, { reps: 0, kg: 50 }, { reps: 6, kg: -1 }, { reps: 7, kg: Infinity }]) assert.equal(validSet(s), false);
  assert.equal(validSet({ reps: '8', kg: '72.5' }), true);
  assert.equal(validSet({ reps: 20, kg: 0 }), true);
});
test('only completed, valid sets contribute to volume and reps', () => {
  const session = completedSession();
  session.exercises[0].sets[1] = { kg: 90, reps: 8, done: false };
  session.exercises[1].sets[0] = { kg: 0, reps: 20, done: true };
  assert.deepEqual(summary(session), { sets: 2, reps: 28, volume: 560, minutes: 60 });
});
test('previous values use latest completed sets even with unsorted history', () => {
  const old = completedSession(60, 8), recent = completedSession(75, 6, '2026-11-02T12:00:00Z');
  assert.equal(previousSets([recent, old], 'bench-press')[0].kg, 75);
  assert.deepEqual(previousSets([old], 'deadlift'), []);
});
test('exercise graphs aggregate actual values and exclude high rep e1RM estimates', () => {
  const s = completedSession(70, 8);
  assert.equal(exerciseSeries([s], 'bench-press', 'weight')[0].value, 70);
  assert.equal(exerciseSeries([s], 'bench-press', 'volume')[0].value, 560);
  assert.equal(exerciseSeries([s], 'bench-press', 'reps')[0].value, 8);
  assert.equal(exerciseSeries([completedSession(100, 1)], 'bench-press', 'e1rm')[0].value, 100);
  assert.equal(exerciseSeries([completedSession(50, 15)], 'bench-press', 'e1rm').length, 0);
});
test('backup round trip preserves records, active timer and notes safely', () => {
  const active = createSession(plan[2]); active.restUntil = Date.now() + 60000;
  active.exercises[0].note = '<img src=x onerror=alert(1)>';
  const backup = { version: 1, sessions: [completedSession()], active, preferences: { name: 'Alex', theme: 'dark', restSeconds: 180 } };
  const result = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(result.sessions[0].exercises[0].sets[0].kg, 70);
  assert.equal(result.active.restUntil, active.restUntil);
  assert.equal(result.active.exercises[0].note, active.exercises[0].note);
  assert.equal(result.preferences.name, 'Alex');
});
test('malformed backups and duplicate session IDs are rejected', () => {
  for (const input of [null, {}, { version: 2, sessions: [] }, { version: 1, sessions: [{ workoutId: 'unknown' }] }]) assert.throws(() => validateBackup(input));
  const s = completedSession();
  assert.throws(() => validateBackup({ version: 1, sessions: [s, s] }));
  s.exercises[0].sets[0].kg = -5;
  assert.throws(() => validateBackup({ version: 1, sessions: [s] }));
});
test('week navigation uses calendar days across daylight saving and year boundaries', () => {
  assert.deepEqual(weekDays(new Date('2026-10-25T12:00:00')).map(localDate), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  assert.equal(localDate(weekDays(new Date('2027-01-01T12:00:00'))[0]), '2026-12-28');
});
