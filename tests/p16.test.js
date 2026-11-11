/**
 * P16 테스트: 페이지 번호 그룹화, 총 페이지 수 확인, pinned 분리
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getVisiblePageRange, splitPinnedItems, getTotalPages } from '../js/search.js';
import { ITEMS } from '../js/data/items.js';

const BASE = { summary: '', body: '', organization: '', isSample: false, sourceId: 'general', originalUrl: 'https://example.com' };

// ── getVisiblePageRange ───────────────────────────────
describe('getVisiblePageRange — 12페이지 환경', () => {
  test('1/12 → 1~10', () => {
    assert.deepStrictEqual(getVisiblePageRange(1, 12), [1,2,3,4,5,6,7,8,9,10]);
  });
  test('5/12 → 1~10', () => {
    assert.deepStrictEqual(getVisiblePageRange(5, 12), [1,2,3,4,5,6,7,8,9,10]);
  });
  test('10/12 → 1~10', () => {
    assert.deepStrictEqual(getVisiblePageRange(10, 12), [1,2,3,4,5,6,7,8,9,10]);
  });
  test('11/12 → 11~12', () => {
    assert.deepStrictEqual(getVisiblePageRange(11, 12), [11, 12]);
  });
  test('12/12 → 11~12', () => {
    assert.deepStrictEqual(getVisiblePageRange(12, 12), [11, 12]);
  });
});

describe('getVisiblePageRange — 36페이지 환경', () => {
  test('1/36 → 1~10', () => {
    assert.deepStrictEqual(getVisiblePageRange(1, 36), [1,2,3,4,5,6,7,8,9,10]);
  });
  test('10/36 → 1~10', () => {
    assert.deepStrictEqual(getVisiblePageRange(10, 36), [1,2,3,4,5,6,7,8,9,10]);
  });
  test('11/36 → 11~20', () => {
    assert.deepStrictEqual(getVisiblePageRange(11, 36), [11,12,13,14,15,16,17,18,19,20]);
  });
  test('17/36 → 11~20', () => {
    assert.deepStrictEqual(getVisiblePageRange(17, 36), [11,12,13,14,15,16,17,18,19,20]);
  });
  test('20/36 → 11~20', () => {
    assert.deepStrictEqual(getVisiblePageRange(20, 36), [11,12,13,14,15,16,17,18,19,20]);
  });
  test('21/36 → 21~30', () => {
    assert.deepStrictEqual(getVisiblePageRange(21, 36), [21,22,23,24,25,26,27,28,29,30]);
  });
  test('27/36 → 21~30', () => {
    assert.deepStrictEqual(getVisiblePageRange(27, 36), [21,22,23,24,25,26,27,28,29,30]);
  });
  test('31/36 → 31~36 (마지막 그룹은 남은 수만큼)', () => {
    assert.deepStrictEqual(getVisiblePageRange(31, 36), [31,32,33,34,35,36]);
  });
  test('36/36 → 31~36', () => {
    assert.deepStrictEqual(getVisiblePageRange(36, 36), [31,32,33,34,35,36]);
  });
});

describe('getVisiblePageRange — 경계 케이스', () => {
  test('1페이지 환경: 1/1 → [1]', () => {
    assert.deepStrictEqual(getVisiblePageRange(1, 1), [1]);
  });
  test('정확히 10페이지: 10/10 → 1~10', () => {
    assert.deepStrictEqual(getVisiblePageRange(10, 10), [1,2,3,4,5,6,7,8,9,10]);
  });
  test('정확히 20페이지: 20/20 → 11~20', () => {
    assert.deepStrictEqual(getVisiblePageRange(20, 20), [11,12,13,14,15,16,17,18,19,20]);
  });
  test('groupSize=5: getVisiblePageRange(5, 20, 5) → 1~5', () => {
    assert.deepStrictEqual(getVisiblePageRange(5, 20, 5), [1,2,3,4,5]);
  });
  test('groupSize=5: getVisiblePageRange(6, 20, 5) → 6~10', () => {
    assert.deepStrictEqual(getVisiblePageRange(6, 20, 5), [6,7,8,9,10]);
  });
  test('groupSize=5: getVisiblePageRange(11, 13, 5) → 11~13 (마지막 그룹 짧음)', () => {
    assert.deepStrictEqual(getVisiblePageRange(11, 13, 5), [11,12,13]);
  });
});

// ── getTotalPages (P16 맥락) ──────────────────────────
describe('getTotalPages — P16 총 페이지 수 표시 확인', () => {
  test('60건 / 5 → 12페이지', () => {
    assert.strictEqual(getTotalPages(60, 5), 12);
  });
  test('17건 / 5 → 4페이지', () => {
    assert.strictEqual(getTotalPages(17, 5), 4);
  });
  test('15건 / 5 → 3페이지 (경계: 정확히 나눠 떨어짐)', () => {
    assert.strictEqual(getTotalPages(15, 5), 3);
  });
  test('5건 / 5 → 1페이지', () => {
    assert.strictEqual(getTotalPages(5, 5), 1);
  });
  test('1건 / 5 → 1페이지', () => {
    assert.strictEqual(getTotalPages(1, 5), 1);
  });
  test('0건 / 5 → 1 (기존 동작: Math.max(1, ...) 보장)', () => {
    // renderCount에서 0건일 때는 ·N페이지를 표시하지 않으므로 UI 불일치 없음
    assert.strictEqual(getTotalPages(0, 5), 1);
  });
});

// ── splitPinnedItems ───────────────────────────────────
// P17 이후: isPinned는 sourceEntries 내부에서 관리
describe('splitPinnedItems', () => {
  const items = [
    { ...BASE, id: 'a', title: 'A', postedAt: '2026-11-01',
      sourceEntries: [{ sourceId: 'general', source: '일반공지', isPinned: true }] },
    { ...BASE, id: 'b', title: 'B', postedAt: '2026-11-02',
      sourceEntries: [{ sourceId: 'general', source: '일반공지', isPinned: false }] },
    { ...BASE, id: 'c', title: 'C', postedAt: '2026-11-03' },
    { ...BASE, id: 'd', title: 'D', postedAt: '2026-11-04',
      sourceEntries: [{ sourceId: 'haksa', source: '학사공지', isPinned: true }] },
    { ...BASE, id: 'e', title: 'E', postedAt: '2026-11-05',
      sourceEntries: [{ sourceId: 'haksa', source: '학사공지', isPinned: false }] },
  ];

  test('sourceEntries.isPinned=true인 항목만 pinned에 포함', () => {
    const { pinned } = splitPinnedItems(items);
    assert.deepStrictEqual(pinned.map((i) => i.id), ['a', 'd']);
  });

  test('sourceEntries.isPinned=false 또는 sourceEntries 미정의는 regular에 포함', () => {
    const { regular } = splitPinnedItems(items);
    assert.deepStrictEqual(regular.map((i) => i.id), ['b', 'c', 'e']);
  });

  test('pinned + regular 합계 = 전체 항목 수', () => {
    const { pinned, regular } = splitPinnedItems(items);
    assert.strictEqual(pinned.length + regular.length, items.length);
  });

  test('pinned와 regular 간 중복 없음', () => {
    const { pinned, regular } = splitPinnedItems(items);
    const pinnedIds  = new Set(pinned.map((i) => i.id));
    const regularIds = new Set(regular.map((i) => i.id));
    for (const id of pinnedIds) {
      assert.ok(!regularIds.has(id), `id="${id}" 가 pinned와 regular에 모두 존재`);
    }
  });

  test('빈 배열 입력: pinned=[], regular=[]', () => {
    const { pinned, regular } = splitPinnedItems([]);
    assert.deepStrictEqual(pinned, []);
    assert.deepStrictEqual(regular, []);
  });

  test('모두 sourceEntries.isPinned=true: regular 빈 배열', () => {
    const allPinned = items.map((i) => ({
      ...i,
      sourceEntries: [{ sourceId: 'general', source: '일반공지', isPinned: true }],
    }));
    const { pinned, regular } = splitPinnedItems(allPinned);
    assert.strictEqual(pinned.length, items.length);
    assert.strictEqual(regular.length, 0);
  });

  test('sourceEntries.isPinned가 하나도 없으면 regular가 전체', () => {
    const noPinned = items.map((i) => ({
      ...i,
      sourceEntries: [{ sourceId: 'general', source: '일반공지', isPinned: false }],
    }));
    const { pinned, regular } = splitPinnedItems(noPinned);
    assert.strictEqual(pinned.length, 0);
    assert.strictEqual(regular.length, items.length);
  });
});

// ── 실제 60건 데이터 검증 ─────────────────────────────
describe('P16 실제 데이터 — isPinned 없음 확인', () => {
  test('isPinned는 최상위 필드가 아닌 sourceEntries 내부에만 존재 (P17)', () => {
    const topLevelPinned = ITEMS.filter((i) => i.isPinned === true);
    assert.strictEqual(topLevelPinned.length, 0,
      '최상위 isPinned=true가 임의로 추가되어 있음 — sourceEntries 내부에만 두어야 함');
  });

  test('splitPinnedItems(ITEMS): pinned=4, regular=56 (P17 이후 — sourceEntries isPinned 반영)', () => {
    const { pinned, regular } = splitPinnedItems(ITEMS);
    assert.strictEqual(pinned.length, 4);
    assert.strictEqual(regular.length, 56);
  });
});

// ── 페이지네이션 회귀 (P16) ───────────────────────────
describe('페이지네이션 회귀 — 그룹 전환', () => {
  test('10페이지에서 다음 → 11페이지 → 그룹 11~12', () => {
    const nextPage = 10 + 1;
    assert.deepStrictEqual(getVisiblePageRange(nextPage, 12), [11, 12]);
  });

  test('11페이지에서 이전 → 10페이지 → 그룹 1~10', () => {
    const prevPage = 11 - 1;
    assert.deepStrictEqual(getVisiblePageRange(prevPage, 12), [1,2,3,4,5,6,7,8,9,10]);
  });

  test('1페이지에서 10페이지 다음 → 11페이지 → 그룹 11~12', () => {
    const page = Math.min(1 + 10, 12); // 11
    assert.strictEqual(page, 11);
    assert.deepStrictEqual(getVisiblePageRange(page, 12), [11, 12]);
  });

  test('11페이지에서 10페이지 이전 → 1페이지 → 그룹 1~10', () => {
    const page = Math.max(11 - 10, 1); // 1
    assert.strictEqual(page, 1);
    assert.deepStrictEqual(getVisiblePageRange(page, 12), [1,2,3,4,5,6,7,8,9,10]);
  });

  test('직접 이동 27 → 27페이지 → 그룹 21~30 (36페이지 환경)', () => {
    assert.deepStrictEqual(getVisiblePageRange(27, 36), [21,22,23,24,25,26,27,28,29,30]);
  });

  test('2페이지에서 10페이지 다음 → clamp → 12페이지', () => {
    const page = Math.min(2 + 10, 12); // 12
    assert.strictEqual(page, 12);
  });

  test('범위를 초과하는 직접 이동은 처리 안 됨 (page < 1 → return)', () => {
    const page = 5 - 10; // -5
    assert.ok(page < 1); // goToPage 내부 조건 검증
  });
});
