import test from 'node:test';
import assert from 'node:assert/strict';
import { restoredDeadline } from './timer.mjs';

test('expired saved timer starts a new timed session', () => {
  const now = 1_000_000;
  assert.equal(restoredDeadline(now - 1, 60, now), null);
  assert.equal(restoredDeadline(now, 60, now), null);
});

test('active saved timer resumes at its existing deadline', () => {
  const now = 1_000_000;
  assert.equal(restoredDeadline(now + 15 * 60_000, 60, now), now + 15 * 60_000);
});

test('invalid or out-of-range saved timers are discarded', () => {
  const now = 1_000_000;
  assert.equal(restoredDeadline(now + 61 * 60_000, 60, now), null);
  assert.equal(restoredDeadline('tomorrow', 60, now), null);
  assert.equal(restoredDeadline(now + 60_000, null, now), null);
});
