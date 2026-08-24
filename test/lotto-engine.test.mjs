import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyDraw,
  costForWeeks,
  rankFromMatches,
  ticketsForWeeks,
  yearsForWeeks,
} from '../public/lotto-engine.js';

const selected = [1, 2, 3, 4, 5, 6];

test('공식 조건에 맞게 1~5등을 판정한다', () => {
  assert.equal(classifyDraw(selected, [1, 2, 3, 4, 5, 6], 7), 1);
  assert.equal(classifyDraw(selected, [1, 2, 3, 4, 5, 7], 6), 2);
  assert.equal(classifyDraw(selected, [1, 2, 3, 4, 5, 7], 8), 3);
  assert.equal(classifyDraw(selected, [1, 2, 3, 4, 7, 8], 9), 4);
  assert.equal(classifyDraw(selected, [1, 2, 3, 7, 8, 9], 10), 5);
  assert.equal(classifyDraw(selected, [1, 2, 7, 8, 9, 10], 3), null);
});

test('보너스 번호는 5개 일치일 때만 2등을 만든다', () => {
  assert.equal(rankFromMatches(5, true), 2);
  assert.equal(rankFromMatches(5, false), 3);
  assert.equal(rankFromMatches(4, true), 4);
});

test('동일 번호 100장 기준 구매량과 금액을 계산한다', () => {
  assert.equal(ticketsForWeeks(12), 1_200);
  assert.equal(costForWeeks(12), 1_200_000);
  assert.equal(yearsForWeeks(104), 2);
});

test('중복 번호 조합을 거부한다', () => {
  assert.throws(() => classifyDraw([1, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6], 7));
});
