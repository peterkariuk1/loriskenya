import assert from 'node:assert/strict';
import test from 'node:test';
import { getReceiptGreeting, isWalkInName } from './receipt.js';

test('uses a generic greeting for walk-in labels', () => {
  ['Walk-in', 'walk in', 'walkin', 'walk-in customer'].forEach((name) => {
    assert.equal(isWalkInName(name), true);
    assert.equal(getReceiptGreeting(name), 'Hello,');
  });
});

test('uses only the first name for registered customers', () => {
  assert.equal(getReceiptGreeting('Jane Wanjiku'), 'Hello Jane,');
  assert.equal(getReceiptGreeting(''), 'Hello,');
});
