import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  filterByKeyword,
  filterBySource,
  filterByPeriod,
  applyFilters,
  paginate,
  getPeriodCutoff,
  getTotalPages,
  getItemSources,
} from '../js/search.js';
import { ITEMS, SNAPSHOT_REFERENCE_DATE } from '../js/data/items.js';

// SAMPLE_REFERENCE_DATE = SNAPSHOT_REFERENCE_DATE = '2026-11-11'
const SAMPLE_REFERENCE_DATE = SNAPSHOT_REFERENCE_DATE;

// app.js와 동일한 최신순 정렬
const sortedItems = [...ITEMS].sort((a, b) => b.postedAt.localeCompare(a.postedAt));

// ── getPeriodCutoff ────────────────────────────────

describe('getPeriodCutoff', () => {
  it('all → null (필터 없음)', () => {
    assert.strictEqual(getPeriodCutoff('all', SAMPLE_REFERENCE_DATE), null);
  });
  it('1m → 2026-10-11 (기준일 2026-11-11 기준)', () => {
    assert.strictEqual(getPeriodCutoff('1m', SAMPLE_REFERENCE_DATE), '2026-10-11');
  });
  it('3m → 2026-08-11', () => {
    assert.strictEqual(getPeriodCutoff('3m', SAMPLE_REFERENCE_DATE), '2026-08-11');
  });
  it('1y → 2025-11-11', () => {
    assert.strictEqual(getPeriodCutoff('1y', SAMPLE_REFERENCE_DATE), '2025-11-11');
  });
});

// ── filterByKeyword ────────────────────────────────

describe('filterByKeyword', () => {
  it('빈 검색어 → 전체 반환', () => {
    assert.strictEqual(filterByKeyword(ITEMS, '').length, ITEMS.length);
  });
  it('공백만 있는 검색어 → 전체 반환', () => {
    assert.strictEqual(filterByKeyword(ITEMS, '   ').length, ITEMS.length);
  });
  it('앞뒤 공백 무시 (trim)', () => {
    const a = filterByKeyword(ITEMS, '명예기자');
    const b = filterByKeyword(ITEMS, '  명예기자  ');
    assert.deepStrictEqual(
      a.map((i) => i.id),
      b.map((i) => i.id),
    );
  });
  it('대소문자 무시 — mnu-016 제목에 "TOEIC" 포함, "toeic"으로 검색해도 찾아야 한다', () => {
    const upper = filterByKeyword(ITEMS, 'TOEIC');
    const lower = filterByKeyword(ITEMS, 'toeic');
    assert.ok(upper.some((i) => i.id === 'mnu-016'), 'TOEIC으로 mnu-016 미검색');
    assert.deepStrictEqual(upper.map((i) => i.id), lower.map((i) => i.id));
  });
  it('제목(title) 검색 — "명예기자" → mnu-001 포함', () => {
    const result = filterByKeyword(ITEMS, '명예기자');
    assert.ok(result.some((i) => i.id === 'mnu-001'));
  });
  it('본문(body) 검색 — "만 18세" → mnu-001 포함 (body에만 있음)', () => {
    const result = filterByKeyword(ITEMS, '만 18세');
    assert.ok(result.some((i) => i.id === 'mnu-001'), 'mnu-001 미검색');
  });
  it('AND 검색 — "노트북 워크숍" → mnu-028 포함, 두 단어 모두 있어야 한다', () => {
    const result = filterByKeyword(ITEMS, '노트북 워크숍');
    assert.ok(result.some((i) => i.id === 'mnu-028'));
    result.forEach((item) => {
      const hay = `${item.title} ${item.summary} ${item.body} ${item.author ?? ''} ${item.organization ?? ''}`.toLowerCase();
      assert.ok(hay.includes('노트북'), `${item.id}에 "노트북" 없음`);
      assert.ok(hay.includes('워크숍'), `${item.id}에 "워크숍" 없음`);
    });
  });
  it('AND 검색 — 한 단어가 없으면 제외', () => {
    // "명예기자"는 mnu-001에, "만 18세"는 mnu-001 body에만 → AND는 mnu-001만
    const result = filterByKeyword(ITEMS, '명예기자 만 18세');
    assert.ok(result.some((i) => i.id === 'mnu-001'));
    result.forEach((item) => {
      const hay = `${item.title} ${item.summary} ${item.body} ${item.author ?? ''} ${item.organization ?? ''}`.toLowerCase();
      assert.ok(hay.includes('명예기자'));
      assert.ok(hay.includes('만 18세'));
    });
  });
});

// ── filterBySource ─────────────────────────────────

describe('filterBySource', () => {
  it('빈 sourceIds → 전체 반환', () => {
    assert.strictEqual(filterBySource(ITEMS, []).length, ITEMS.length);
  });
  it('단일 출처 — haksa만 반환 (13건: 단일 12건 + mnu-014 dual-source)', () => {
    const result = filterBySource(ITEMS, ['haksa']);
    assert.strictEqual(result.length, 13);
    result.forEach((i) => assert.ok(getItemSources(i).includes('haksa')));
  });
  it('복수 출처 — haksa + scholar', () => {
    const result = filterBySource(ITEMS, ['haksa', 'scholar']);
    assert.ok(result.some((i) => getItemSources(i).includes('haksa')));
    assert.ok(result.some((i) => getItemSources(i).includes('scholar')));
    result.forEach((i) => {
      const srcs = getItemSources(i);
      assert.ok(srcs.some((s) => ['haksa', 'scholar'].includes(s)));
    });
  });
  it('존재하지 않는 출처 ID → 빈 배열 (안전 처리)', () => {
    const result = filterBySource(ITEMS, ['nonexistent']);
    assert.strictEqual(result.length, 0);
  });
});

// ── filterByPeriod ─────────────────────────────────

describe('filterByPeriod', () => {
  const REF = SAMPLE_REFERENCE_DATE; // '2026-11-11'

  // 경계 테스트용 임시 항목
  function makeItem(id, postedAt) {
    return { id, sourceId: 'haksa', title: 'T', summary: 'T', body: 'T', postedAt, organization: 'T', attachmentCount: 0, originalUrl: 'https://example.com', isSample: false };
  }
  const boundary = [
    makeItem('on-1m',   '2026-10-11'), // 1m 경계일 (포함)
    makeItem('pre-1m',  '2026-10-10'), // 1m 경계일 직전 (제외)
    makeItem('on-3m',   '2026-08-11'), // 3m 경계일 (포함)
    makeItem('pre-3m',  '2026-08-10'), // 3m 경계일 직전 (제외)
    makeItem('on-1y',   '2025-11-11'), // 1y 경계일 (포함)
    makeItem('pre-1y',  '2025-11-10'), // 1y 경계일 직전 (제외)
  ];

  it('all → 전체 반환', () => {
    assert.strictEqual(filterByPeriod(ITEMS, 'all', REF).length, ITEMS.length);
  });
  it('1m 경계일(2026-10-11) 포함', () => {
    const r = filterByPeriod(boundary, '1m', REF);
    assert.ok(r.some((i) => i.id === 'on-1m'),  '경계일 포함 실패');
    assert.ok(!r.some((i) => i.id === 'pre-1m'), '경계일 직전 제외 실패');
  });
  it('3m 경계일(2026-08-11) 포함', () => {
    const r = filterByPeriod(boundary, '3m', REF);
    assert.ok(r.some((i) => i.id === 'on-3m'),  '경계일 포함 실패');
    assert.ok(!r.some((i) => i.id === 'pre-3m'), '경계일 직전 제외 실패');
  });
  it('1y 경계일(2025-11-11) 포함', () => {
    const r = filterByPeriod(boundary, '1y', REF);
    assert.ok(r.some((i) => i.id === 'on-1y'),  '경계일 포함 실패');
    assert.ok(!r.some((i) => i.id === 'pre-1y'), '경계일 직전 제외 실패');
  });
  it('1m — 실제 데이터: mnu-019(2026-10-12) 포함, mnu-015(2026-10-08) 제외', () => {
    const r = filterByPeriod(ITEMS, '1m', REF);
    assert.ok(r.some((i) => i.id === 'mnu-019'));
    assert.ok(!r.some((i) => i.id === 'mnu-015'));
  });
  it('3m — 실제 데이터: mnu-021(2026-11-09) 포함, mnu-032(2026-07-27) 제외', () => {
    const r = filterByPeriod(ITEMS, '3m', REF);
    assert.ok(r.some((i) => i.id === 'mnu-021'));
    assert.ok(!r.some((i) => i.id === 'mnu-032'));
  });
  it('1y — 실제 데이터: 모든 60건이 1y 이내 (최근 1년 내 게시물만 존재)', () => {
    const r = filterByPeriod(ITEMS, '1y', REF);
    assert.strictEqual(r.length, ITEMS.length);
  });
});

// ── applyFilters ───────────────────────────────────

describe('applyFilters', () => {
  it('조건 없음 → 전체 반환', () => {
    const r = applyFilters(ITEMS, { keyword: '', sourceIds: [], period: 'all' }, SAMPLE_REFERENCE_DATE);
    assert.strictEqual(r.length, ITEMS.length);
  });

  // T2: 최근 3개월 + 학사공지
  it('T2: period=3m + source=haksa → mnu-021 포함, mnu-032 제외, 모두 haksa 출처, 12건 (mnu-014 dual-source 포함)', () => {
    const r = applyFilters(sortedItems, { keyword: '', sourceIds: ['haksa'], period: '3m' }, SAMPLE_REFERENCE_DATE);
    assert.ok(r.some((i) => i.id === 'mnu-021'));
    assert.ok(!r.some((i) => i.id === 'mnu-032'));
    r.forEach((i) => assert.ok(getItemSources(i).includes('haksa')));
    assert.strictEqual(r.length, 12);
  });

  // T3: "장학 선발" + 취업 → 0건
  it('T3: keyword="장학 선발" + source=career → 0건', () => {
    const r = applyFilters(sortedItems, { keyword: '장학 선발', sourceIds: ['career'], period: 'all' }, SAMPLE_REFERENCE_DATE);
    assert.strictEqual(r.length, 0);
  });

  // T3: 출처 해제 후 장학 결과 등장
  it('T3: keyword="장학 선발" + source=[] → 장학 출처 포함', () => {
    const r = applyFilters(sortedItems, { keyword: '장학 선발', sourceIds: [], period: 'all' }, SAMPLE_REFERENCE_DATE);
    assert.ok(r.length > 0);
    assert.ok(r.some((i) => i.sourceId === 'scholar'));
  });
});

// ── paginate ───────────────────────────────────────

describe('paginate', () => {
  it('60건 1페이지 → 5건', () => {
    assert.strictEqual(paginate(sortedItems, 1, 5).length, 5);
  });
  it('60건 12페이지 → 5건', () => {
    assert.strictEqual(paginate(sortedItems, 12, 5).length, 5);
  });
  it('60건 13페이지 → 빈 배열 (범위 밖)', () => {
    assert.strictEqual(paginate(sortedItems, 13, 5).length, 0);
  });
  it('3건짜리 목록 1페이지 → 3건 (pageSize보다 적은 경우)', () => {
    assert.strictEqual(paginate(sortedItems.slice(0, 3), 1, 5).length, 3);
  });
});

// ── getTotalPages ──────────────────────────────────

describe('getTotalPages', () => {
  it('60건 / 5 → 12페이지', () => {
    assert.strictEqual(getTotalPages(60, 5), 12);
  });
  it('5건 / 5 → 1페이지', () => {
    assert.strictEqual(getTotalPages(5, 5), 1);
  });
  it('6건 / 5 → 2페이지', () => {
    assert.strictEqual(getTotalPages(6, 5), 2);
  });
  it('1건 / 5 → 1페이지', () => {
    assert.strictEqual(getTotalPages(1, 5), 1);
  });
  it('0건 → 최소 1페이지', () => {
    assert.strictEqual(getTotalPages(0, 5), 1);
  });
});

// ── T1 대표 과업 ───────────────────────────────────

describe('T1: "MNU 포인트" 검색 — 여러 출처에서 결과', () => {
  it('일반공지(general) 항목 포함', () => {
    const r = filterByKeyword(sortedItems, 'MNU 포인트');
    assert.ok(r.some((i) => i.sourceId === 'general'), 'general 출처 항목 미포함');
  });
  it('학사공지(haksa) 항목 포함', () => {
    const r = filterByKeyword(sortedItems, 'MNU 포인트');
    assert.ok(r.some((i) => i.sourceId === 'haksa'), 'haksa 출처 항목 미포함');
  });
  it('mnu-021 포함 (학사공지 — 제목에 MNU 포인트)', () => {
    const r = filterByKeyword(sortedItems, 'MNU 포인트');
    assert.ok(r.some((i) => i.id === 'mnu-021'));
  });
});

// ── T4 대표 과업 ───────────────────────────────────

describe('T4: mnu-001 페이지 위치 (pageSize=5)', () => {
  it('mnu-001은 전체 목록 2페이지에 있다', () => {
    const page2 = paginate(sortedItems, 2, 5);
    assert.ok(page2.some((i) => i.id === 'mnu-001'));
  });
  it('mnu-001은 1페이지에 없다', () => {
    const page1 = paginate(sortedItems, 1, 5);
    assert.ok(!page1.some((i) => i.id === 'mnu-001'));
  });
  it('1페이지에는 2026-11-11 취업 게시물만 있다', () => {
    const page1 = paginate(sortedItems, 1, 5);
    page1.forEach((i) => assert.strictEqual(i.postedAt, '2026-11-11'));
  });
});
