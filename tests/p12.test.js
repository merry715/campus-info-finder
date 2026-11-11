/**
 * P12 테스트: getPeriodDisplayRange, groupItemsByMonth
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getPeriodDisplayRange, groupItemsByMonth } from '../js/search.js';

const BASE = { summary: '', body: '', department: '', attachments: [], isSample: true };
const REF  = '2026-11-10';

// ── getPeriodDisplayRange ──────────────────────────
describe('getPeriodDisplayRange', () => {
  test('1m: from이 1개월 전, to가 기준일', () => {
    const r = getPeriodDisplayRange('1m', REF);
    assert.deepStrictEqual(r, { from: '2026-10-10', to: '2026-11-10' });
  });

  test('3m: from이 3개월 전, to가 기준일', () => {
    const r = getPeriodDisplayRange('3m', REF);
    assert.deepStrictEqual(r, { from: '2026-08-10', to: '2026-11-10' });
  });

  test('1y: from이 1년 전, to가 기준일', () => {
    const r = getPeriodDisplayRange('1y', REF);
    assert.deepStrictEqual(r, { from: '2025-11-10', to: '2026-11-10' });
  });

  test('all: null 반환', () => {
    assert.strictEqual(getPeriodDisplayRange('all', REF), null);
  });

  test('custom: null 반환', () => {
    assert.strictEqual(getPeriodDisplayRange('custom', REF), null);
  });

  test('반환된 from은 period cutoff 날짜', () => {
    assert.strictEqual(getPeriodDisplayRange('1m', REF)?.from, '2026-10-10');
  });

  test('반환된 to는 항상 referenceDate', () => {
    assert.strictEqual(getPeriodDisplayRange('3m', REF)?.to, REF);
    assert.strictEqual(getPeriodDisplayRange('1y', REF)?.to, REF);
  });
});

// ── groupItemsByMonth ──────────────────────────────
describe('groupItemsByMonth', () => {
  test('빈 배열: 빈 배열 반환', () => {
    assert.deepStrictEqual(groupItemsByMonth([]), []);
  });

  test('단일 항목: 1개 그룹', () => {
    const items = [{ ...BASE, id: 'a', postedAt: '2026-11-05' }];
    const groups = groupItemsByMonth(items);
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].monthKey, '2026-11');
    assert.strictEqual(groups[0].items.length, 1);
  });

  test('같은 달 항목들이 같은 그룹에 묶임', () => {
    const items = [
      { ...BASE, id: 'a', postedAt: '2026-11-10' },
      { ...BASE, id: 'b', postedAt: '2026-11-01' },
    ];
    const groups = groupItemsByMonth(items);
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].items.length, 2);
  });

  test('다른 달 항목들이 각각 별도 그룹에', () => {
    const items = [
      { ...BASE, id: 'a', postedAt: '2026-11-05' },
      { ...BASE, id: 'b', postedAt: '2026-10-15' },
    ];
    const groups = groupItemsByMonth(items);
    assert.strictEqual(groups.length, 2);
  });

  test('입력 순서 유지 (최신순 정렬 후 호출 가정)', () => {
    const items = [
      { ...BASE, id: 'a', postedAt: '2026-11-05' },
      { ...BASE, id: 'b', postedAt: '2026-10-15' },
      { ...BASE, id: 'c', postedAt: '2025-12-01' },
    ];
    const groups = groupItemsByMonth(items);
    assert.strictEqual(groups[0].monthKey, '2026-11');
    assert.strictEqual(groups[1].monthKey, '2026-10');
    assert.strictEqual(groups[2].monthKey, '2025-12');
  });

  test('label 형식: 앞자리 0 없는 "YYYY년 M월"', () => {
    const items = [{ ...BASE, id: 'a', postedAt: '2026-08-10' }];
    assert.strictEqual(groupItemsByMonth(items)[0].label, '2026년 8월');
  });

  test('두 자리 월 label: "2026년 11월"', () => {
    const items = [{ ...BASE, id: 'a', postedAt: '2026-11-05' }];
    assert.strictEqual(groupItemsByMonth(items)[0].label, '2026년 11월');
  });

  test('monthKey 형식: "YYYY-MM"', () => {
    const items = [{ ...BASE, id: 'a', postedAt: '2026-08-10' }];
    assert.strictEqual(groupItemsByMonth(items)[0].monthKey, '2026-08');
  });

  test('같은 달 내 항목 순서 유지', () => {
    const items = [
      { ...BASE, id: 'a', postedAt: '2026-11-10' },
      { ...BASE, id: 'b', postedAt: '2026-11-05' },
      { ...BASE, id: 'c', postedAt: '2026-11-01' },
    ];
    const groups = groupItemsByMonth(items);
    assert.deepStrictEqual(groups[0].items.map((i) => i.id), ['a', 'b', 'c']);
  });

  test('여러 달이 섞인 경우 그룹 수 정확', () => {
    const items = [
      { ...BASE, id: 'a', postedAt: '2026-11-05' },
      { ...BASE, id: 'b', postedAt: '2026-11-01' },
      { ...BASE, id: 'c', postedAt: '2026-10-15' },
      { ...BASE, id: 'd', postedAt: '2025-11-20' },
    ];
    const groups = groupItemsByMonth(items);
    assert.strictEqual(groups.length, 3);
    assert.strictEqual(groups[0].items.length, 2); // 2026-11
    assert.strictEqual(groups[1].items.length, 1); // 2026-10
    assert.strictEqual(groups[2].items.length, 1); // 2025-11
  });
});
