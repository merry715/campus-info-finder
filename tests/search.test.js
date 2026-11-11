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
} from '../js/search.js';
import { ITEMS, SAMPLE_REFERENCE_DATE } from '../js/data/items.js';

// app.js와 동일한 최신순 정렬
const sortedItems = [...ITEMS].sort((a, b) => b.postedAt.localeCompare(a.postedAt));

// ── getPeriodCutoff ────────────────────────────────

describe('getPeriodCutoff', () => {
  it('all → null (필터 없음)', () => {
    assert.strictEqual(getPeriodCutoff('all', SAMPLE_REFERENCE_DATE), null);
  });
  it('1m → 2026-10-10', () => {
    assert.strictEqual(getPeriodCutoff('1m', SAMPLE_REFERENCE_DATE), '2026-10-10');
  });
  it('3m → 2026-08-10', () => {
    assert.strictEqual(getPeriodCutoff('3m', SAMPLE_REFERENCE_DATE), '2026-08-10');
  });
  it('1y → 2025-11-10', () => {
    assert.strictEqual(getPeriodCutoff('1y', SAMPLE_REFERENCE_DATE), '2025-11-10');
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
    const a = filterByKeyword(ITEMS, '졸업요건');
    const b = filterByKeyword(ITEMS, '  졸업요건  ');
    assert.deepStrictEqual(
      a.map((i) => i.id),
      b.map((i) => i.id),
    );
  });
  it('대소문자 무시 — career-004에 "Toeic" 포함, "TOEIC"으로 검색해도 찾아야 한다', () => {
    const upper = filterByKeyword(ITEMS, 'TOEIC');
    const lower = filterByKeyword(ITEMS, 'toeic');
    assert.ok(upper.some((i) => i.id === 'career-004'), 'TOEIC으로 career-004 미검색');
    assert.deepStrictEqual(upper.map((i) => i.id), lower.map((i) => i.id));
  });
  it('제목(title) 검색 — "졸업요건" → dept-001, dept-005 포함', () => {
    const result = filterByKeyword(ITEMS, '졸업요건');
    assert.ok(result.some((i) => i.id === 'dept-001'));
    assert.ok(result.some((i) => i.id === 'dept-005'));
  });
  it('요약(summary) 검색 — "늘리고"는 general-001 summary에만 있다', () => {
    const result = filterByKeyword(ITEMS, '늘리고');
    assert.ok(result.some((i) => i.id === 'general-001'), 'general-001 미검색');
    // 제목·body에는 없으므로 오직 summary 경로로 찾힌 것
  });
  it('본문(body) 검색 — "충족"은 haksa-001 body에만 있다', () => {
    const result = filterByKeyword(ITEMS, '충족');
    assert.ok(result.some((i) => i.id === 'haksa-001'), 'haksa-001 미검색');
  });
  it('AND 검색 — "현장실습 학점" → career-002 포함, 두 단어 모두 있어야 한다', () => {
    const result = filterByKeyword(ITEMS, '현장실습 학점');
    assert.ok(result.some((i) => i.id === 'career-002'));
    result.forEach((item) => {
      const hay = `${item.title} ${item.summary} ${item.body}`.toLowerCase();
      assert.ok(hay.includes('현장실습'), `${item.id}에 "현장실습" 없음`);
      assert.ok(hay.includes('학점'), `${item.id}에 "학점" 없음`);
    });
  });
  it('AND 검색 — "노트북 python" → 두 단어 모두 있는 항목만 반환', () => {
    // program-004 body: "Python 기초", "개인 노트북을 지참"
    const result = filterByKeyword(ITEMS, '노트북 python');
    assert.ok(result.length > 0, '결과 없음');
    result.forEach((item) => {
      const hay = `${item.title} ${item.summary} ${item.body}`.toLowerCase();
      assert.ok(hay.includes('노트북'), `${item.id}에 "노트북" 없음`);
      assert.ok(hay.includes('python'), `${item.id}에 "python" 없음`);
    });
  });
  it('AND 검색 — 한 단어가 없으면 제외', () => {
    // "졸업요건"은 여러 항목, "충족"은 haksa-001에만 → AND는 haksa-001만
    const result = filterByKeyword(ITEMS, '졸업요건 충족');
    assert.ok(result.some((i) => i.id === 'haksa-001'));
    result.forEach((item) => {
      const hay = `${item.title} ${item.summary} ${item.body}`.toLowerCase();
      assert.ok(hay.includes('졸업요건'));
      assert.ok(hay.includes('충족'));
    });
  });
});

// ── filterBySource ─────────────────────────────────

describe('filterBySource', () => {
  it('빈 sourceIds → 전체 반환', () => {
    assert.strictEqual(filterBySource(ITEMS, []).length, ITEMS.length);
  });
  it('단일 출처 — haksa만 반환', () => {
    const result = filterBySource(ITEMS, ['haksa']);
    assert.ok(result.length > 0);
    result.forEach((i) => assert.strictEqual(i.sourceId, 'haksa'));
  });
  it('복수 출처 — haksa + dept', () => {
    const result = filterBySource(ITEMS, ['haksa', 'dept']);
    assert.ok(result.some((i) => i.sourceId === 'haksa'));
    assert.ok(result.some((i) => i.sourceId === 'dept'));
    result.forEach((i) => assert.ok(['haksa', 'dept'].includes(i.sourceId)));
  });
  it('존재하지 않는 출처 ID → 빈 배열 (안전 처리)', () => {
    const result = filterBySource(ITEMS, ['nonexistent']);
    assert.strictEqual(result.length, 0);
  });
});

// ── filterByPeriod ─────────────────────────────────

describe('filterByPeriod', () => {
  const REF = SAMPLE_REFERENCE_DATE; // '2026-11-10'

  // 경계 테스트용 임시 항목
  function makeItem(id, postedAt) {
    return { id, sourceId: 'haksa', title: 'T', summary: 'T', body: 'T', postedAt, department: 'T', attachments: [], isSample: true };
  }
  const boundary = [
    makeItem('on-1m',   '2026-10-10'), // 1m 경계일 (포함)
    makeItem('pre-1m',  '2026-10-09'), // 1m 경계일 직전 (제외)
    makeItem('on-3m',   '2026-08-10'), // 3m 경계일 (포함)
    makeItem('pre-3m',  '2026-08-09'), // 3m 경계일 직전 (제외)
    makeItem('on-1y',   '2025-11-10'), // 1y 경계일 (포함)
    makeItem('pre-1y',  '2025-11-09'), // 1y 경계일 직전 (제외)
  ];

  it('all → 전체 반환', () => {
    assert.strictEqual(filterByPeriod(ITEMS, 'all', REF).length, ITEMS.length);
  });
  it('1m 경계일(2026-10-10) 포함', () => {
    const r = filterByPeriod(boundary, '1m', REF);
    assert.ok(r.some((i) => i.id === 'on-1m'),  '경계일 포함 실패');
    assert.ok(!r.some((i) => i.id === 'pre-1m'), '경계일 직전 제외 실패');
  });
  it('3m 경계일(2026-08-10) 포함', () => {
    const r = filterByPeriod(boundary, '3m', REF);
    assert.ok(r.some((i) => i.id === 'on-3m'),  '경계일 포함 실패');
    assert.ok(!r.some((i) => i.id === 'pre-3m'), '경계일 직전 제외 실패');
  });
  it('1y 경계일(2025-11-10) 포함', () => {
    const r = filterByPeriod(boundary, '1y', REF);
    assert.ok(r.some((i) => i.id === 'on-1y'),  '경계일 포함 실패');
    assert.ok(!r.some((i) => i.id === 'pre-1y'), '경계일 직전 제외 실패');
  });
  it('1m — 실제 샘플 데이터: haksa-002(2026-10-15) 포함, scholar-002(2026-10-02) 제외', () => {
    const r = filterByPeriod(ITEMS, '1m', REF);
    assert.ok(r.some((i) => i.id === 'haksa-002'));
    assert.ok(!r.some((i) => i.id === 'scholar-002'));
  });
  it('1y — 실제 샘플 데이터: scholar-004(2025-12-01) 포함, dept-005(2025-10-20) 제외', () => {
    // cutoff = 2025-11-10; dept-005(2025-10-20) < cutoff → 제외
    const r = filterByPeriod(ITEMS, '1y', REF);
    assert.ok(r.some((i) => i.id === 'scholar-004'));  // 2025-12-01 ≥ 2025-11-10
    assert.ok(!r.some((i) => i.id === 'dept-005'));    // 2025-10-20 < 2025-11-10
    assert.ok(!r.some((i) => i.id === 'scholar-005')); // 2025-03-10 < 2025-11-10
  });
});

// ── applyFilters ───────────────────────────────────

describe('applyFilters', () => {
  it('조건 없음 → 전체 반환', () => {
    const r = applyFilters(ITEMS, { keyword: '', sourceIds: [], period: 'all' }, SAMPLE_REFERENCE_DATE);
    assert.strictEqual(r.length, ITEMS.length);
  });

  // T2: 최근 3개월 + 학사공지
  it('T2: period=3m + source=haksa → haksa-004 포함, haksa-006 제외, 모두 haksa, 5건', () => {
    const r = applyFilters(sortedItems, { keyword: '', sourceIds: ['haksa'], period: '3m' }, SAMPLE_REFERENCE_DATE);
    assert.ok(r.some((i) => i.id === 'haksa-004'));
    assert.ok(!r.some((i) => i.id === 'haksa-006')); // 2026-02-23 < cutoff
    r.forEach((i) => assert.strictEqual(i.sourceId, 'haksa'));
    assert.strictEqual(r.length, 5);
  });

  // T3: "장학금 마감" + 취업정보 → 0건
  it('T3: keyword="장학금 마감" + source=career → 0건', () => {
    const r = applyFilters(sortedItems, { keyword: '장학금 마감', sourceIds: ['career'], period: 'all' }, SAMPLE_REFERENCE_DATE);
    assert.strictEqual(r.length, 0);
  });

  // T3: 출처 해제 후 장학정보 결과 등장
  it('T3: keyword="장학금 마감" + source=[] → 장학정보 출처 포함', () => {
    const r = applyFilters(sortedItems, { keyword: '장학금 마감', sourceIds: [], period: 'all' }, SAMPLE_REFERENCE_DATE);
    assert.ok(r.length > 0);
    assert.ok(r.some((i) => i.sourceId === 'scholar'));
  });
});

// ── paginate ───────────────────────────────────────

describe('paginate', () => {
  it('28건 1페이지 → 10건', () => {
    assert.strictEqual(paginate(sortedItems, 1, 10).length, 10);
  });
  it('28건 2페이지 → 10건', () => {
    assert.strictEqual(paginate(sortedItems, 2, 10).length, 10);
  });
  it('28건 3페이지 → 8건', () => {
    assert.strictEqual(paginate(sortedItems, 3, 10).length, 8);
  });
  it('5건짜리 목록 1페이지 → 5건 (pageSize보다 적은 경우)', () => {
    assert.strictEqual(paginate(sortedItems.slice(0, 5), 1, 10).length, 5);
  });
  it('범위 밖 페이지 → 빈 배열', () => {
    assert.strictEqual(paginate(sortedItems, 4, 10).length, 0);
  });
});

// ── getTotalPages ──────────────────────────────────

describe('getTotalPages', () => {
  it('28건 / 10 → 3페이지', () => {
    assert.strictEqual(getTotalPages(28, 10), 3);
  });
  it('10건 / 10 → 1페이지', () => {
    assert.strictEqual(getTotalPages(10, 10), 1);
  });
  it('11건 / 10 → 2페이지', () => {
    assert.strictEqual(getTotalPages(11, 10), 2);
  });
  it('1건 / 10 → 1페이지', () => {
    assert.strictEqual(getTotalPages(1, 10), 1);
  });
  it('0건 → 최소 1페이지', () => {
    assert.strictEqual(getTotalPages(0, 10), 1);
  });
});

// ── T1 대표 과업 ───────────────────────────────────

describe('T1: "졸업요건" 검색', () => {
  it('목표 게시물 dept-001 포함', () => {
    const r = filterByKeyword(sortedItems, '졸업요건');
    assert.ok(r.some((i) => i.id === 'dept-001'));
  });
  it('헷갈리는 게시물 dept-005 함께 포함 (1년 이전 공지)', () => {
    const r = filterByKeyword(sortedItems, '졸업요건');
    assert.ok(r.some((i) => i.id === 'dept-005'));
  });
  it('헷갈리는 게시물 haksa-001 함께 포함 (body에 "졸업요건" 언급)', () => {
    const r = filterByKeyword(sortedItems, '졸업요건');
    assert.ok(r.some((i) => i.id === 'haksa-001'));
  });
});

// ── T4 대표 과업 ───────────────────────────────────

describe('T4: haksa-003 페이지 위치', () => {
  it('haksa-003은 전체 목록 2페이지에 있다', () => {
    const page2 = paginate(sortedItems, 2, 10);
    assert.ok(page2.some((i) => i.id === 'haksa-003'));
  });
  it('haksa-003은 1페이지에 없다', () => {
    const page1 = paginate(sortedItems, 1, 10);
    assert.ok(!page1.some((i) => i.id === 'haksa-003'));
  });
  it('haksa-003은 3페이지에 없다', () => {
    const page3 = paginate(sortedItems, 3, 10);
    assert.ok(!page3.some((i) => i.id === 'haksa-003'));
  });
});
