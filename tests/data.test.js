import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { SOURCES } from '../js/data/sources.js';
import { ITEMS, SNAPSHOT_REFERENCE_DATE, SAMPLE_REFERENCE_DATE } from '../js/data/items.js';
import { filterByKeyword, applyFilters, paginate, getItemSources } from '../js/search.js';

const sortedItems = [...ITEMS].sort((a, b) => b.postedAt.localeCompare(a.postedAt));

// ── SOURCES 무결성 ─────────────────────────────────

describe('SOURCES 무결성', () => {
  it('출처 5개', () => {
    assert.strictEqual(SOURCES.length, 5);
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
  it('5개 출처 id 목록 확인', () => {
    const ids = SOURCES.map((s) => s.id);
    assert.deepStrictEqual(
      [...ids].sort(),
      ['career', 'general', 'haksa', 'medical', 'scholar'],
    );
  });
});

// ── ITEMS 무결성 ───────────────────────────────────

describe('ITEMS 무결성', () => {
  const sourceIdSet = new Set(SOURCES.map((s) => s.id));

  it('게시물 60건', () => {
    assert.strictEqual(ITEMS.length, 60);
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
  it('모든 isSample === false (실 게시글 데이터)', () => {
    ITEMS.forEach((item) => {
      assert.strictEqual(item.isSample, false, `${item.id}: isSample !== false`);
    });
  });
  it('모든 게시일이 스냅샷 기준일 이전', () => {
    ITEMS.forEach((item) => {
      assert.ok(
        item.postedAt <= SNAPSHOT_REFERENCE_DATE,
        `${item.id}: postedAt ${item.postedAt} > 기준일 ${SNAPSHOT_REFERENCE_DATE}`,
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
  it('필수 필드가 비어 있지 않음 (id, sourceId, title, summary, body, postedAt, organization, originalUrl)', () => {
    ITEMS.forEach((item) => {
      assert.ok(item.id,           `id 없음`);
      assert.ok(item.sourceId,     `${item.id}: sourceId 없음`);
      assert.ok(item.title,        `${item.id}: title 없음`);
      assert.ok(item.summary,      `${item.id}: summary 없음`);
      assert.ok(item.body,         `${item.id}: body 없음`);
      assert.ok(item.postedAt,     `${item.id}: postedAt 없음`);
      assert.ok(item.organization, `${item.id}: organization 없음`);
      assert.ok(item.originalUrl,  `${item.id}: originalUrl 없음`);
    });
  });
  it('attachmentCount 필드가 존재한다 (null 허용)', () => {
    ITEMS.forEach((item) => {
      assert.ok('attachmentCount' in item, `${item.id}: attachmentCount 필드 없음`);
    });
  });
  it('스냅샷 기준일 2026-11-11', () => {
    assert.strictEqual(SNAPSHOT_REFERENCE_DATE, '2026-11-11');
  });
  it('SAMPLE_REFERENCE_DATE는 SNAPSHOT_REFERENCE_DATE의 별칭', () => {
    assert.strictEqual(SAMPLE_REFERENCE_DATE, SNAPSHOT_REFERENCE_DATE);
  });
});

// ── 출처별 게시물 수 ───────────────────────────────

describe('출처별 게시물 수', () => {
  it('일반공지(general) 20건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'general').length, 20);
  });
  it('학사공지(haksa) 12건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'haksa').length, 12);
  });
  it('장학(scholar) 12건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'scholar').length, 12);
  });
  it('취업(career) 10건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'career').length, 10);
  });
  it('의과대학소식(medical) 6건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'medical').length, 6);
  });
});

// ── T1 로직: "명예기자" 검색 ───────────────────────

describe('T1 로직: "명예기자" 검색', () => {
  it('mnu-001(일반공지)이 검색 결과에 포함된다', () => {
    const r = filterByKeyword(sortedItems, '명예기자');
    assert.ok(r.some((i) => i.id === 'mnu-001'), 'mnu-001 미포함');
  });
});

// ── T2 로직 검증 ───────────────────────────────────

describe('T2 로직: 최근 3개월 + 학사공지', () => {
  const REF = SNAPSHOT_REFERENCE_DATE; // '2026-11-11'
  it('haksa + 3m 적용 시 mnu-021(2026-11-09)이 포함된다', () => {
    const r = applyFilters(sortedItems, { keyword: '', sourceIds: ['haksa'], period: '3m' }, REF);
    assert.ok(r.some((i) => i.id === 'mnu-021'));
  });
  it('haksa + 3m 적용 시 mnu-032(2026-07-27)가 제외된다', () => {
    const r = applyFilters(sortedItems, { keyword: '', sourceIds: ['haksa'], period: '3m' }, REF);
    assert.ok(!r.some((i) => i.id === 'mnu-032'));
  });
  it('haksa + 3m → 12건 (mnu-014 dual-source 포함)', () => {
    const r = applyFilters(sortedItems, { keyword: '', sourceIds: ['haksa'], period: '3m' }, REF);
    r.forEach((i) => assert.ok(getItemSources(i).includes('haksa')));
    assert.strictEqual(r.length, 12);
  });
});

// ── T3 로직 검증 ───────────────────────────────────

describe('T3 로직: "장학 선발" + 취업출처', () => {
  const REF = SNAPSHOT_REFERENCE_DATE;
  it('취업(career)에는 "장학 선발" 게시물이 없어 0건', () => {
    const r = applyFilters(sortedItems, { keyword: '장학 선발', sourceIds: ['career'], period: 'all' }, REF);
    assert.strictEqual(r.length, 0);
  });
  it('"전체 출처에서 다시 찾기" 후 장학 결과 등장', () => {
    const r = applyFilters(sortedItems, { keyword: '장학 선발', sourceIds: [], period: 'all' }, REF);
    assert.ok(r.length > 0, '결과 없음');
    assert.ok(r.some((i) => i.sourceId === 'scholar'), 'scholar 미포함');
  });
});

// ── T4 로직 검증 ───────────────────────────────────

describe('T4 로직: mnu-001 페이지 위치 (pageSize=5)', () => {
  it('전체 목록 2페이지에 mnu-001이 있다', () => {
    const page2 = paginate(sortedItems, 2, 5);
    assert.ok(page2.some((i) => i.id === 'mnu-001'));
  });
  it('1페이지에는 없다 (1페이지는 2026-11-11 취업 게시물 5건)', () => {
    const page1 = paginate(sortedItems, 1, 5);
    assert.ok(!page1.some((i) => i.id === 'mnu-001'));
  });
});
