import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { SOURCES } from '../js/data/sources.js';
import { ITEMS, SAMPLE_REFERENCE_DATE } from '../js/data/items.js';
import { filterByKeyword, applyFilters, paginate } from '../js/search.js';

const sortedItems = [...ITEMS].sort((a, b) => b.postedAt.localeCompare(a.postedAt));

// ── SOURCES 무결성 ─────────────────────────────────

describe('SOURCES 무결성', () => {
  it('출처 6개', () => {
    assert.strictEqual(SOURCES.length, 6);
  });
  it('출처 id 중복 없음', () => {
    const ids = SOURCES.map((s) => s.id);
    assert.strictEqual(new Set(ids).size, ids.length);
  });
  it('모든 출처에 필수 필드 존재 (id, label, colorToken)', () => {
    SOURCES.forEach((s) => {
      assert.ok(s.id,         `출처 id 없음`);
      assert.ok(s.label,      `${s.id}: label 없음`);
      assert.ok(s.colorToken, `${s.id}: colorToken 없음`);
    });
  });
  it('6개 출처 id 목록 확인', () => {
    const ids = SOURCES.map((s) => s.id);
    assert.deepStrictEqual(
      [...ids].sort(),
      ['career', 'dept', 'general', 'haksa', 'program', 'scholar'],
    );
  });
});

// ── ITEMS 무결성 ───────────────────────────────────

describe('ITEMS 무결성', () => {
  const sourceIdSet = new Set(SOURCES.map((s) => s.id));

  it('게시물 28건', () => {
    assert.strictEqual(ITEMS.length, 28);
  });
  it('게시물 ID 중복 없음', () => {
    const ids = ITEMS.map((i) => i.id);
    assert.strictEqual(new Set(ids).size, ids.length);
  });
  it('모든 sourceId가 SOURCES에 존재', () => {
    ITEMS.forEach((item) => {
      assert.ok(sourceIdSet.has(item.sourceId), `${item.id}: 알 수 없는 sourceId "${item.sourceId}"`);
    });
  });
  it('모든 isSample === true', () => {
    ITEMS.forEach((item) => {
      assert.strictEqual(item.isSample, true, `${item.id}: isSample !== true`);
    });
  });
  it('모든 게시일이 샘플 기준일 이전', () => {
    ITEMS.forEach((item) => {
      assert.ok(
        item.postedAt <= SAMPLE_REFERENCE_DATE,
        `${item.id}: postedAt ${item.postedAt} > 기준일 ${SAMPLE_REFERENCE_DATE}`,
      );
    });
  });
  it('모든 게시일 형식 YYYY-MM-DD', () => {
    ITEMS.forEach((item) => {
      assert.ok(
        /^\d{4}-\d{2}-\d{2}$/.test(item.postedAt),
        `${item.id}: 날짜 형식 오류 "${item.postedAt}"`,
      );
    });
  });
  it('필수 필드가 비어 있지 않음 (id, sourceId, title, summary, body, postedAt, department)', () => {
    ITEMS.forEach((item) => {
      assert.ok(item.id,         `id 없음`);
      assert.ok(item.sourceId,   `${item.id}: sourceId 없음`);
      assert.ok(item.title,      `${item.id}: title 없음`);
      assert.ok(item.summary,    `${item.id}: summary 없음`);
      assert.ok(item.body,       `${item.id}: body 없음`);
      assert.ok(item.postedAt,   `${item.id}: postedAt 없음`);
      assert.ok(item.department, `${item.id}: department 없음`);
      assert.ok(Array.isArray(item.attachments), `${item.id}: attachments 배열 아님`);
    });
  });
  it('샘플 기준일 2026-11-10', () => {
    assert.strictEqual(SAMPLE_REFERENCE_DATE, '2026-11-10');
  });
});

// ── T1~T4 목표 게시물 존재 확인 ───────────────────

describe('과업별 목표 게시물 존재', () => {
  it('T1 목표: dept-001 (2026학년도 졸업요건)', () => {
    assert.ok(ITEMS.find((i) => i.id === 'dept-001'));
  });
  it('T1 혼동: dept-005 (2025학년도 졸업요건)', () => {
    assert.ok(ITEMS.find((i) => i.id === 'dept-005'));
  });
  it('T1 혼동: haksa-001 (본문에 "졸업요건" 언급)', () => {
    assert.ok(ITEMS.find((i) => i.id === 'haksa-001'));
  });
  it('T2 목표: haksa-004 (2학기 수강정정)', () => {
    assert.ok(ITEMS.find((i) => i.id === 'haksa-004'));
  });
  it('T3 목표: scholar-001 (2학기 교외 장학금)', () => {
    assert.ok(ITEMS.find((i) => i.id === 'scholar-001'));
  });
  it('T4 목표: haksa-003 (중간고사 보강 일정)', () => {
    assert.ok(ITEMS.find((i) => i.id === 'haksa-003'));
  });
});

// ── T1 로직 검증 ───────────────────────────────────

describe('T1 로직: "졸업요건" 검색 결과', () => {
  it('목표·혼동 게시물이 모두 검색에 포함된다', () => {
    const r = filterByKeyword(sortedItems, '졸업요건');
    assert.ok(r.some((i) => i.id === 'dept-001'), 'dept-001 미포함');
    assert.ok(r.some((i) => i.id === 'dept-005'), 'dept-005 미포함');
    assert.ok(r.some((i) => i.id === 'haksa-001'), 'haksa-001 미포함 (body 검색 확인)');
  });
});

// ── T2 로직 검증 ───────────────────────────────────

describe('T2 로직: 최근 3개월 + 학사공지', () => {
  it('haksa-004가 결과에 포함된다', () => {
    const r = applyFilters(sortedItems, { keyword: '', sourceIds: ['haksa'], period: '3m' }, SAMPLE_REFERENCE_DATE);
    assert.ok(r.some((i) => i.id === 'haksa-004'));
  });
  it('haksa-006(2026-02-23)은 3개월 밖이므로 제외된다', () => {
    const r = applyFilters(sortedItems, { keyword: '', sourceIds: ['haksa'], period: '3m' }, SAMPLE_REFERENCE_DATE);
    assert.ok(!r.some((i) => i.id === 'haksa-006'));
  });
});

// ── T3 로직 검증 ───────────────────────────────────

describe('T3 로직: "장학금 마감" + 취업정보', () => {
  it('취업정보에는 "장학금"+"마감" 게시물이 없어 0건', () => {
    const r = applyFilters(sortedItems, { keyword: '장학금 마감', sourceIds: ['career'], period: 'all' }, SAMPLE_REFERENCE_DATE);
    assert.strictEqual(r.length, 0);
  });
  it('"전체 출처에서 다시 찾기" 후 장학정보 결과 등장', () => {
    const r = applyFilters(sortedItems, { keyword: '장학금 마감', sourceIds: [], period: 'all' }, SAMPLE_REFERENCE_DATE);
    assert.ok(r.length > 0, '결과 없음');
    assert.ok(r.some((i) => i.sourceId === 'scholar'), 'scholar 미포함');
    assert.ok(r.some((i) => i.id === 'scholar-001'), 'scholar-001 미포함');
  });
});

// ── T4 로직 검증 ───────────────────────────────────

describe('T4 로직: haksa-003 2페이지 위치', () => {
  it('전체 목록 2페이지에 haksa-003이 있다', () => {
    const page2 = paginate(sortedItems, 2, 10);
    assert.ok(page2.some((i) => i.id === 'haksa-003'));
  });
  it('1페이지에는 없다', () => {
    const page1 = paginate(sortedItems, 1, 10);
    assert.ok(!page1.some((i) => i.id === 'haksa-003'));
  });
});
