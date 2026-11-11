/**
 * P11 테스트: filterByCustomPeriod, sortItems, applyFilters(custom),
 *            isValidDateRange, parseHash / serializeListState 신규 파라미터
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  filterByCustomPeriod,
  sortItems,
  applyFilters,
  isValidDateRange,
} from '../js/search.js';

import { parseHash, serializeListState } from '../js/state.js';

// ── 테스트용 샘플 항목 ────────────────────────────
const BASE = { summary: '', body: '', department: '', attachments: [], isSample: true };
const items = [
  { ...BASE, id: 'a', title: '나중 공지',   postedAt: '2026-11-05', sourceId: 'haksa' },
  { ...BASE, id: 'b', title: '가운데 공지', postedAt: '2026-10-15', sourceId: 'dept' },
  { ...BASE, id: 'c', title: '초기 공지',   postedAt: '2026-09-01', sourceId: 'haksa' },
  { ...BASE, id: 'd', title: '오래된 공지', postedAt: '2025-11-20', sourceId: 'general' },
];

// ── filterByCustomPeriod ───────────────────────────
describe('filterByCustomPeriod', () => {
  test('from, to 모두 빈 문자열이면 전체 반환', () => {
    assert.deepStrictEqual(filterByCustomPeriod(items, '', ''), items);
  });

  test('from만 설정: from 이후 항목만 반환', () => {
    const result = filterByCustomPeriod(items, '2026-10-01', '');
    assert.deepStrictEqual(result.map((i) => i.id), ['a', 'b']);
  });

  test('to만 설정: to 이전 항목만 반환', () => {
    const result = filterByCustomPeriod(items, '', '2026-10-20');
    assert.deepStrictEqual(result.map((i) => i.id), ['b', 'c', 'd']);
  });

  test('from, to 모두 설정: 범위 내 항목만 반환', () => {
    const result = filterByCustomPeriod(items, '2026-10-01', '2026-11-01');
    assert.deepStrictEqual(result.map((i) => i.id), ['b']);
  });

  test('경계일 포함 — from과 같은 날짜는 포함', () => {
    const result = filterByCustomPeriod(items, '2026-10-15', '2026-11-10');
    assert.ok(result.some((i) => i.id === 'b')); // 2026-10-15 포함
  });

  test('경계일 포함 — to와 같은 날짜는 포함', () => {
    const result = filterByCustomPeriod(items, '2026-01-01', '2026-10-15');
    assert.ok(result.some((i) => i.id === 'b')); // 2026-10-15 포함
  });

  test('빈 items: 빈 배열 반환', () => {
    assert.deepStrictEqual(filterByCustomPeriod([], '2026-01-01', '2026-12-31'), []);
  });

  test('범위에 해당하는 항목이 없으면 빈 배열', () => {
    const result = filterByCustomPeriod(items, '2027-01-01', '2027-12-31');
    assert.deepStrictEqual(result, []);
  });

  test('from > to: 빈 배열 반환 (앱 레이어에서 오류 처리 없이 여기까지 오면 빈 결과)', () => {
    // 앱에서는 isValidDateRange로 사전 차단하여 이 경로에 도달하지 않게 한다
    const result = filterByCustomPeriod(items, '2026-11-10', '2026-10-01');
    assert.deepStrictEqual(result, []);
  });
});

// ── sortItems ─────────────────────────────────────
describe('sortItems', () => {
  test('newest: 최신 날짜가 앞에 온다', () => {
    const result = sortItems(items, 'newest');
    assert.strictEqual(result[0].id, 'a');
    assert.strictEqual(result[result.length - 1].id, 'd');
  });

  test('oldest: 오래된 날짜가 앞에 온다', () => {
    const result = sortItems(items, 'oldest');
    assert.strictEqual(result[0].id, 'd');
    assert.strictEqual(result[result.length - 1].id, 'a');
  });

  test('title: 월 그룹 최신→오래된, 월 내부 가나다순 (P13)', () => {
    const result = sortItems(items, 'title');
    // 각 항목이 서로 다른 달: a(2026-11) → b(2026-10) → c(2026-09) → d(2025-11)
    assert.strictEqual(result[0].id, 'a');
    assert.strictEqual(result[1].id, 'b');
    assert.strictEqual(result[2].id, 'c');
    assert.strictEqual(result[3].id, 'd');
  });

  test('알 수 없는 sort 값: newest로 처리', () => {
    const result = sortItems(items, 'unknown_value');
    assert.strictEqual(result[0].id, 'a');
  });

  test('원본 배열을 변경하지 않는다', () => {
    const original = items.map((i) => i.id);
    sortItems(items, 'oldest');
    assert.deepStrictEqual(items.map((i) => i.id), original);
  });

  test('빈 items: 빈 배열 반환', () => {
    assert.deepStrictEqual(sortItems([], 'newest'), []);
  });

  test('항목이 1개이면 그대로 반환', () => {
    const result = sortItems([items[0]], 'oldest');
    assert.deepStrictEqual(result, [items[0]]);
  });
});

// ── applyFilters — custom period ──────────────────
describe('applyFilters — period=custom', () => {
  const REF = '2026-11-10';

  test('from만 설정: from 이후 항목 반환', () => {
    const result = applyFilters(items,
      { keyword: '', sourceIds: [], period: 'custom', customFrom: '2026-10-01', customTo: '' },
      REF);
    assert.ok(result.some((i) => i.id === 'a'));
    assert.ok(result.some((i) => i.id === 'b'));
    assert.ok(!result.some((i) => i.id === 'c'));
    assert.ok(!result.some((i) => i.id === 'd'));
  });

  test('to만 설정: to 이전 항목 반환', () => {
    const result = applyFilters(items,
      { keyword: '', sourceIds: [], period: 'custom', customFrom: '', customTo: '2026-10-20' },
      REF);
    assert.ok(!result.some((i) => i.id === 'a'));
    assert.ok(result.some((i) => i.id === 'b'));
  });

  test('from+to 모두 설정: 범위 내 항목 반환', () => {
    const result = applyFilters(items,
      { keyword: '', sourceIds: [], period: 'custom', customFrom: '2026-10-01', customTo: '2026-11-01' },
      REF);
    assert.deepStrictEqual(result.map((i) => i.id), ['b']);
  });

  test('customFrom/To 미전달: 기본값 빈 문자열로 전체 반환', () => {
    const result = applyFilters(items,
      { keyword: '', sourceIds: [], period: 'custom' },
      REF);
    assert.deepStrictEqual(result, items);
  });

  test('period=all이면 customFrom/To 무시', () => {
    const result = applyFilters(items,
      { keyword: '', sourceIds: [], period: 'all', customFrom: '2026-11-01', customTo: '2026-11-10' },
      REF);
    assert.deepStrictEqual(result, items);
  });

  test('keyword + custom period 조합', () => {
    const result = applyFilters(items,
      { keyword: '가운데', sourceIds: [], period: 'custom', customFrom: '2026-01-01', customTo: '2026-12-31' },
      REF);
    assert.deepStrictEqual(result.map((i) => i.id), ['b']);
  });
});

// ── parseHash — P11 신규 파라미터 ─────────────────
describe('parseHash — P11', () => {
  test('sort=oldest 파싱', () => {
    assert.strictEqual(parseHash('#/?sort=oldest').sort, 'oldest');
  });

  test('sort=title 파싱', () => {
    assert.strictEqual(parseHash('#/?sort=title').sort, 'title');
  });

  test('유효하지 않은 sort: newest로 폴백', () => {
    assert.strictEqual(parseHash('#/?sort=random').sort, 'newest');
  });

  test('sort 없으면 newest', () => {
    assert.strictEqual(parseHash('#/').sort, 'newest');
  });

  test('cols=2 파싱', () => {
    assert.strictEqual(parseHash('#/?cols=2').cols, 2);
  });

  test('cols=3 파싱', () => {
    assert.strictEqual(parseHash('#/?cols=3').cols, 3);
  });

  test('유효하지 않은 cols(5): 1로 폴백', () => {
    assert.strictEqual(parseHash('#/?cols=5').cols, 1);
  });

  test('cols 없으면 1', () => {
    assert.strictEqual(parseHash('#/').cols, 1);
  });

  test('period=custom 파싱', () => {
    assert.strictEqual(parseHash('#/?period=custom').period, 'custom');
  });

  test('from, to 파라미터 파싱', () => {
    const r = parseHash('#/?period=custom&from=2026-10-01&to=2026-11-10');
    assert.strictEqual(r.customFrom, '2026-10-01');
    assert.strictEqual(r.customTo,   '2026-11-10');
  });

  test('from, to 없으면 빈 문자열', () => {
    const r = parseHash('#/');
    assert.strictEqual(r.customFrom, '');
    assert.strictEqual(r.customTo,   '');
  });

  test('여러 P11 파라미터 조합', () => {
    const r = parseHash('#/?sort=title&cols=2&period=custom&from=2026-10-01&to=2026-11-10&page=2');
    assert.strictEqual(r.sort,       'title');
    assert.strictEqual(r.cols,       2);
    assert.strictEqual(r.period,     'custom');
    assert.strictEqual(r.customFrom, '2026-10-01');
    assert.strictEqual(r.customTo,   '2026-11-10');
    assert.strictEqual(r.page,       2);
  });
});

// ── serializeListState — P11 신규 파라미터 ────────
describe('serializeListState — P11', () => {
  const base = { keyword: '', sourceIds: [], period: 'all', page: 1,
                 sort: 'newest', cols: 1, customFrom: '', customTo: '' };

  test('기본 상태는 #/ 반환', () => {
    assert.strictEqual(serializeListState(base), '#/');
  });

  test('sort=newest는 URL에 포함하지 않음', () => {
    const hash = serializeListState({ ...base, sort: 'newest' });
    assert.ok(!hash.includes('sort='));
  });

  test('sort=oldest는 URL에 포함', () => {
    const hash = serializeListState({ ...base, sort: 'oldest' });
    assert.ok(hash.includes('sort=oldest'));
  });

  test('sort=title는 URL에 포함', () => {
    const hash = serializeListState({ ...base, sort: 'title' });
    assert.ok(hash.includes('sort=title'));
  });

  test('cols=1은 URL에 포함하지 않음', () => {
    const hash = serializeListState({ ...base, cols: 1 });
    assert.ok(!hash.includes('cols='));
  });

  test('cols=2는 URL에 포함', () => {
    const hash = serializeListState({ ...base, cols: 2 });
    assert.ok(hash.includes('cols=2'));
  });

  test('cols=3는 URL에 포함', () => {
    const hash = serializeListState({ ...base, cols: 3 });
    assert.ok(hash.includes('cols=3'));
  });

  test('period=custom + from/to URL에 포함', () => {
    const hash = serializeListState({
      ...base, period: 'custom', customFrom: '2026-10-01', customTo: '2026-11-10',
    });
    assert.ok(hash.includes('period=custom'));
    assert.ok(hash.includes('from=2026-10-01'));
    assert.ok(hash.includes('to=2026-11-10'));
  });

  test('period=all이면 from/to URL에 포함하지 않음', () => {
    const hash = serializeListState({
      ...base, period: 'all', customFrom: '2026-10-01', customTo: '2026-11-10',
    });
    assert.ok(!hash.includes('from='));
    assert.ok(!hash.includes('to='));
  });

  test('sort, cols, period=custom 복합 직렬화', () => {
    const hash = serializeListState({
      ...base, sort: 'title', cols: 3, period: 'custom',
      customFrom: '2026-10-01', customTo: '2026-11-10',
    });
    assert.ok(hash.includes('sort=title'));
    assert.ok(hash.includes('cols=3'));
    assert.ok(hash.includes('period=custom'));
    assert.ok(hash.includes('from=2026-10-01'));
    assert.ok(hash.includes('to=2026-11-10'));
  });

  test('sort만 변경 시 parseHash로 복원 가능', () => {
    const hash = serializeListState({ ...base, sort: 'title' });
    const restored = parseHash(hash);
    assert.strictEqual(restored.sort, 'title');
  });

  test('cols만 변경 시 parseHash로 복원 가능', () => {
    const hash = serializeListState({ ...base, cols: 2 });
    const restored = parseHash(hash);
    assert.strictEqual(restored.cols, 2);
  });

  test('빠진 파라미터에도 기본값으로 동작', () => {
    // sort, cols, customFrom, customTo 없이 호출해도 오류 없이 직렬화
    const hash = serializeListState({ keyword: '', sourceIds: [], period: 'all', page: 1 });
    assert.strictEqual(hash, '#/');
  });
});

// ── isValidDateRange ───────────────────────────────
describe('isValidDateRange', () => {
  test('from < to: 유효', () => {
    assert.strictEqual(isValidDateRange('2026-10-01', '2026-11-10'), true);
  });

  test('from === to: 유효 (하루짜리 범위)', () => {
    assert.strictEqual(isValidDateRange('2026-10-15', '2026-10-15'), true);
  });

  test('from > to: 무효', () => {
    assert.strictEqual(isValidDateRange('2026-11-10', '2026-10-01'), false);
  });

  test('from만 있음: 유효', () => {
    assert.strictEqual(isValidDateRange('2026-10-01', ''), true);
  });

  test('to만 있음: 유효', () => {
    assert.strictEqual(isValidDateRange('', '2026-11-10'), true);
  });

  test('둘 다 비어있음: 유효', () => {
    assert.strictEqual(isValidDateRange('', ''), true);
  });

  test('from > to — filterByCustomPeriod가 빈 결과를 반환하는 이유', () => {
    // 무효 범위가 앱 레이어를 통과하면 빈 결과: isValidDateRange 차단의 근거
    const fakeItems = [
      { postedAt: '2026-10-15' }, { postedAt: '2026-11-01' }, { postedAt: '2026-09-20' },
    ];
    const result = filterByCustomPeriod(fakeItems, '2026-11-10', '2026-10-01');
    assert.deepStrictEqual(result, []);
  });
});
