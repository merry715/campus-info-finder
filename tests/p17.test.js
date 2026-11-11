/**
 * P17 테스트: sourceEntries 다중 출처, isPinned 출처별 관리, 중복 병합
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  getItemSources,
  getPinnedSources,
  itemIsPinnedForCurrentSources,
  itemMatchesSourceFilter,
  getItemIdentityKey,
  deduplicateItems,
  splitPinnedItems,
  filterBySource,
} from '../js/search.js';
import { ITEMS } from '../js/data/items.js';

const BASE = {
  summary: '', body: '', organization: '', isSample: false,
  sourceId: 'general', originalUrl: 'https://example.com',
};

// ── getItemSources ────────────────────────────────
describe('getItemSources', () => {
  test('sourceEntries가 있으면 각 sourceId 배열 반환', () => {
    const item = {
      ...BASE,
      id: 'x',
      title: 'X',
      postedAt: '2026-11-01',
      sourceEntries: [
        { sourceId: 'general', source: '일반공지' },
        { sourceId: 'haksa',   source: '학사공지' },
      ],
    };
    assert.deepStrictEqual(getItemSources(item), ['general', 'haksa']);
  });

  test('sourceEntries 없으면 최상위 sourceId로 단일 배열 반환', () => {
    const item = { ...BASE, id: 'y', title: 'Y', postedAt: '2026-11-02', sourceId: 'scholar' };
    assert.deepStrictEqual(getItemSources(item), ['scholar']);
  });

  test('sourceEntries 빈 배열이면 최상위 sourceId 사용', () => {
    const item = { ...BASE, id: 'z', title: 'Z', postedAt: '2026-11-03', sourceEntries: [] };
    assert.deepStrictEqual(getItemSources(item), ['general']);
  });
});

// ── getPinnedSources ──────────────────────────────
describe('getPinnedSources', () => {
  test('isPinned=true인 sourceEntry의 sourceId만 반환', () => {
    const item = {
      ...BASE, id: 'a', title: 'A', postedAt: '2026-11-01',
      sourceEntries: [
        { sourceId: 'general', isPinned: false },
        { sourceId: 'haksa',   isPinned: true  },
      ],
    };
    assert.deepStrictEqual(getPinnedSources(item), ['haksa']);
  });

  test('모두 isPinned=false이면 빈 배열', () => {
    const item = {
      ...BASE, id: 'b', title: 'B', postedAt: '2026-11-01',
      sourceEntries: [
        { sourceId: 'general', isPinned: false },
        { sourceId: 'haksa',   isPinned: false },
      ],
    };
    assert.deepStrictEqual(getPinnedSources(item), []);
  });

  test('sourceEntries 없으면 항상 빈 배열', () => {
    const item = { ...BASE, id: 'c', title: 'C', postedAt: '2026-11-01' };
    assert.deepStrictEqual(getPinnedSources(item), []);
  });

  test('모두 isPinned=true이면 전체 sourceId 반환', () => {
    const item = {
      ...BASE, id: 'd', title: 'D', postedAt: '2026-11-01',
      sourceEntries: [
        { sourceId: 'general', isPinned: true },
        { sourceId: 'haksa',   isPinned: true },
      ],
    };
    assert.deepStrictEqual(getPinnedSources(item), ['general', 'haksa']);
  });
});

// ── itemIsPinnedForCurrentSources ─────────────────
describe('itemIsPinnedForCurrentSources', () => {
  const dualItem = {
    ...BASE, id: 'dual', title: 'Dual', postedAt: '2026-11-01',
    sourceEntries: [
      { sourceId: 'general', isPinned: false },
      { sourceId: 'haksa',   isPinned: true  },
    ],
  };
  const noPinnedItem = {
    ...BASE, id: 'nop', title: 'NoPinned', postedAt: '2026-11-01',
    sourceEntries: [{ sourceId: 'general', isPinned: false }],
  };
  const noEntryItem = { ...BASE, id: 'bare', title: 'Bare', postedAt: '2026-11-01' };

  test('selectedSourceIds 없음(전체): pinned sourceEntry가 있으면 true', () => {
    assert.strictEqual(itemIsPinnedForCurrentSources(dualItem, []), true);
  });

  test('selectedSourceIds 없음(전체): pinned sourceEntry 없으면 false', () => {
    assert.strictEqual(itemIsPinnedForCurrentSources(noPinnedItem, []), false);
  });

  test('selectedSourceIds=[haksa]: haksa가 pinned이므로 true', () => {
    assert.strictEqual(itemIsPinnedForCurrentSources(dualItem, ['haksa']), true);
  });

  test('selectedSourceIds=[general]: general은 isPinned=false이므로 false', () => {
    assert.strictEqual(itemIsPinnedForCurrentSources(dualItem, ['general']), false);
  });

  test('sourceEntries 없는 아이템: 항상 false', () => {
    assert.strictEqual(itemIsPinnedForCurrentSources(noEntryItem, []), false);
    assert.strictEqual(itemIsPinnedForCurrentSources(noEntryItem, ['haksa']), false);
  });

  test('selectedSourceIds=[scholar]: 관련 없는 출처이므로 false', () => {
    assert.strictEqual(itemIsPinnedForCurrentSources(dualItem, ['scholar']), false);
  });
});

// ── itemMatchesSourceFilter ───────────────────────
describe('itemMatchesSourceFilter', () => {
  const dualItem = {
    ...BASE, id: 'dual', title: 'Dual', postedAt: '2026-11-01',
    sourceEntries: [
      { sourceId: 'general', isPinned: false },
      { sourceId: 'haksa',   isPinned: true  },
    ],
  };
  const singleItem = { ...BASE, id: 'single', title: 'Single', postedAt: '2026-11-01', sourceId: 'scholar' };

  test('빈 필터: 모든 항목 통과', () => {
    assert.strictEqual(itemMatchesSourceFilter(dualItem,   []), true);
    assert.strictEqual(itemMatchesSourceFilter(singleItem, []), true);
  });

  test('general 선택: 다중 출처 항목 중 general이 있으면 true', () => {
    assert.strictEqual(itemMatchesSourceFilter(dualItem, ['general']), true);
  });

  test('haksa 선택: 다중 출처 항목 중 haksa가 있으면 true', () => {
    assert.strictEqual(itemMatchesSourceFilter(dualItem, ['haksa']), true);
  });

  test('scholar 선택: general·haksa 항목은 false', () => {
    assert.strictEqual(itemMatchesSourceFilter(dualItem, ['scholar']), false);
  });

  test('scholar 선택: sourceId=scholar 항목은 true (sourceEntries 없이 fallback)', () => {
    assert.strictEqual(itemMatchesSourceFilter(singleItem, ['scholar']), true);
  });
});

// ── getItemIdentityKey ────────────────────────────
describe('getItemIdentityKey', () => {
  test('제목·작성일·작성자가 같으면 같은 키', () => {
    const a = { ...BASE, title: ' 제목  테스트 ', postedAt: '2026-11-01', author: '홍길동' };
    const b = { ...BASE, title: '제목 테스트',   postedAt: '2026-11-01', author: '홍길동' };
    assert.strictEqual(getItemIdentityKey(a), getItemIdentityKey(b));
  });

  test('작성일이 다르면 다른 키', () => {
    const a = { ...BASE, title: '제목', postedAt: '2026-11-01', author: '홍길동' };
    const b = { ...BASE, title: '제목', postedAt: '2026-11-02', author: '홍길동' };
    assert.notStrictEqual(getItemIdentityKey(a), getItemIdentityKey(b));
  });

  test('작성자가 다르면 다른 키', () => {
    const a = { ...BASE, title: '제목', postedAt: '2026-11-01', author: 'A' };
    const b = { ...BASE, title: '제목', postedAt: '2026-11-01', author: 'B' };
    assert.notStrictEqual(getItemIdentityKey(a), getItemIdentityKey(b));
  });
});

// ── deduplicateItems ──────────────────────────────
describe('deduplicateItems', () => {
  const makeItem = (id, sourceId, title = '공지') => ({
    ...BASE, id, title, postedAt: '2026-11-01', author: '부서', sourceId,
    source: sourceId, originalUrl: `https://example.com/${id}`,
  });
  const makeDup = (id, sourceId) => makeItem(id, sourceId, '공지');

  test('중복 없는 목록: 그대로 반환', () => {
    const items = [makeItem('a', 'general', '공지A'), makeItem('b', 'haksa', '공지B')];
    assert.strictEqual(deduplicateItems(items).length, 2);
  });

  test('같은 제목·날짜·작성자: 하나로 병합', () => {
    const items = [makeDup('a', 'general'), makeDup('b', 'haksa')];
    const result = deduplicateItems(items);
    assert.strictEqual(result.length, 1);
  });

  test('병합된 항목은 두 sourceId 모두 포함', () => {
    const items = [makeDup('a', 'general'), makeDup('b', 'haksa')];
    const result = deduplicateItems(items);
    const sources = getItemSources(result[0]);
    assert.ok(sources.includes('general'));
    assert.ok(sources.includes('haksa'));
  });

  test('이미 sourceEntries가 있는 항목은 그 내용 보존', () => {
    const item = {
      ...BASE, id: 'mnu-014', title: '한책 공모전', postedAt: '2026-11-01', author: '학술정보지원과',
      sourceId: 'general', source: '일반공지',
      sourceEntries: [
        { sourceId: 'general', source: '일반공지', isPinned: false },
        { sourceId: 'haksa',   source: '학사공지', isPinned: true  },
      ],
    };
    const result = deduplicateItems([item]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].sourceEntries.length, 2);
  });

  test('빈 배열: 빈 배열 반환', () => {
    assert.deepStrictEqual(deduplicateItems([]), []);
  });

  test('중복 세 번: 하나로 병합', () => {
    const a = makeDup('a', 'general');
    const b = makeDup('b', 'haksa');
    const c = makeDup('c', 'scholar');
    const result = deduplicateItems([a, b, c]);
    assert.strictEqual(result.length, 1);
    const sources = getItemSources(result[0]);
    assert.ok(sources.includes('general'));
    assert.ok(sources.includes('haksa'));
    assert.ok(sources.includes('scholar'));
  });

  test('같은 sourceId 중복 추가는 한 번만', () => {
    const a = makeDup('a', 'general');
    const b = makeDup('b', 'general');
    const result = deduplicateItems([a, b]);
    const sources = getItemSources(result[0]);
    const generalCount = sources.filter((s) => s === 'general').length;
    assert.strictEqual(generalCount, 1);
  });
});

// ── splitPinnedItems — 출처 필터 연동 ────────────
describe('splitPinnedItems — selectedSourceIds 연동', () => {
  const dualItem = {
    ...BASE, id: 'dual', title: 'Dual', postedAt: '2026-11-01', author: 'A',
    sourceEntries: [
      { sourceId: 'general', isPinned: false },
      { sourceId: 'haksa',   isPinned: true  },
    ],
  };
  const regularItem = {
    ...BASE, id: 'reg', title: 'Regular', postedAt: '2026-11-02', author: 'B',
    sourceId: 'haksa', source: '학사공지',
  };

  test('전체 출처([]): dualItem은 pinned에 포함', () => {
    const { pinned } = splitPinnedItems([dualItem, regularItem], []);
    assert.ok(pinned.some((i) => i.id === 'dual'));
  });

  test('[haksa] 선택: dualItem은 pinned에 포함', () => {
    const { pinned } = splitPinnedItems([dualItem, regularItem], ['haksa']);
    assert.ok(pinned.some((i) => i.id === 'dual'));
  });

  test('[general] 선택: dualItem은 regular에 포함 (general은 isPinned=false)', () => {
    const { regular } = splitPinnedItems([dualItem, regularItem], ['general']);
    assert.ok(regular.some((i) => i.id === 'dual'));
  });

  test('[scholar] 선택: 두 항목 모두 regular', () => {
    const { pinned, regular } = splitPinnedItems([dualItem, regularItem], ['scholar']);
    assert.strictEqual(pinned.length, 0);
    assert.strictEqual(regular.length, 2);
  });
});

// ── filterBySource — 다중 출처 항목 ──────────────
describe('filterBySource — 다중 출처 항목', () => {
  const dualItem = {
    ...BASE, id: 'dual', title: 'Dual', postedAt: '2026-11-01', author: 'A',
    sourceEntries: [
      { sourceId: 'general', isPinned: false },
      { sourceId: 'haksa',   isPinned: true  },
    ],
  };
  const generalItem = { ...BASE, id: 'gen', title: 'Gen', postedAt: '2026-11-02', author: 'B', sourceId: 'general' };

  test('[general] 선택: dualItem(general+haksa)도 포함', () => {
    const result = filterBySource([dualItem, generalItem], ['general']);
    assert.ok(result.some((i) => i.id === 'dual'));
  });

  test('[haksa] 선택: dualItem 포함, generalItem 제외', () => {
    const result = filterBySource([dualItem, generalItem], ['haksa']);
    assert.ok(result.some((i) => i.id === 'dual'));
    assert.ok(!result.some((i) => i.id === 'gen'));
  });

  test('[scholar] 선택: 두 항목 모두 제외', () => {
    const result = filterBySource([dualItem, generalItem], ['scholar']);
    assert.strictEqual(result.length, 0);
  });
});

// ── 실제 60건 데이터 검증 ─────────────────────────
describe('P17 실제 데이터 — isPinned sourceEntries 확인', () => {
  test('isPinned=true인 sourceEntry가 정확히 4개 (mnu-014·024·025·030)', () => {
    const pinnedEntries = ITEMS.flatMap((item) =>
      (item.sourceEntries ?? []).filter((e) => e.isPinned),
    );
    assert.strictEqual(pinnedEntries.length, 4);
  });

  test('pinned sourceEntry를 가진 item ID 목록 확인', () => {
    const pinnedIds = ITEMS
      .filter((item) => (item.sourceEntries ?? []).some((e) => e.isPinned))
      .map((i) => i.id)
      .sort();
    assert.deepStrictEqual(pinnedIds, ['mnu-014', 'mnu-024', 'mnu-025', 'mnu-030']);
  });

  test('mnu-014는 sourceEntries 2개 (general·haksa)', () => {
    const item = ITEMS.find((i) => i.id === 'mnu-014');
    assert.strictEqual(item.sourceEntries.length, 2);
    const ids = item.sourceEntries.map((e) => e.sourceId).sort();
    assert.deepStrictEqual(ids, ['general', 'haksa']);
  });

  test('mnu-014: general은 isPinned=false, haksa는 isPinned=true', () => {
    const item = ITEMS.find((i) => i.id === 'mnu-014');
    const generalEntry = item.sourceEntries.find((e) => e.sourceId === 'general');
    const haksaEntry   = item.sourceEntries.find((e) => e.sourceId === 'haksa');
    assert.strictEqual(generalEntry.isPinned, false);
    assert.strictEqual(haksaEntry.isPinned,   true);
  });

  test('mnu-024, mnu-025, mnu-030은 각각 sourceEntries 1개 (haksa, isPinned=true)', () => {
    for (const id of ['mnu-024', 'mnu-025', 'mnu-030']) {
      const item = ITEMS.find((i) => i.id === id);
      assert.strictEqual(item.sourceEntries.length, 1, `${id}: sourceEntries 1개 기대`);
      assert.strictEqual(item.sourceEntries[0].sourceId, 'haksa', `${id}: haksa 기대`);
      assert.strictEqual(item.sourceEntries[0].isPinned, true,    `${id}: isPinned=true 기대`);
    }
  });

  test('splitPinnedItems(ITEMS) 전체 출처: pinned=4, regular=56', () => {
    const { pinned, regular } = splitPinnedItems(ITEMS, []);
    assert.strictEqual(pinned.length,  4);
    assert.strictEqual(regular.length, 56);
  });

  test('[general] 필터: mnu-014는 regular (general은 isPinned=false)', () => {
    const { pinned, regular } = splitPinnedItems(ITEMS, ['general']);
    assert.ok(!pinned.some((i)  => i.id === 'mnu-014'));
    assert.ok( regular.some((i) => i.id === 'mnu-014'));
  });

  test('[haksa] 필터: mnu-014는 pinned (haksa는 isPinned=true)', () => {
    const { pinned } = splitPinnedItems(ITEMS, ['haksa']);
    assert.ok(pinned.some((i) => i.id === 'mnu-014'));
  });

  test('[general] 필터: mnu-014가 filterBySource에 포함됨', () => {
    const result = filterBySource(ITEMS, ['general']);
    assert.ok(result.some((i) => i.id === 'mnu-014'));
  });

  test('[haksa] 필터: mnu-014가 filterBySource에 포함됨', () => {
    const result = filterBySource(ITEMS, ['haksa']);
    assert.ok(result.some((i) => i.id === 'mnu-014'));
  });

  test('[career] 필터: mnu-014는 filterBySource에서 제외됨', () => {
    const result = filterBySource(ITEMS, ['career']);
    assert.ok(!result.some((i) => i.id === 'mnu-014'));
  });

  test('각 sourceEntry에 originalUrl이 있음 (pinned 4건)', () => {
    for (const id of ['mnu-014', 'mnu-024', 'mnu-025', 'mnu-030']) {
      const item = ITEMS.find((i) => i.id === id);
      for (const entry of item.sourceEntries) {
        assert.ok(entry.originalUrl, `${id}[${entry.sourceId}]: originalUrl 없음`);
      }
    }
  });
});
