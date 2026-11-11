import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseHash, serializeListState } from '../js/state.js';

// ── parseHash ──────────────────────────────────────

describe('parseHash — 기본 상태', () => {
  it('빈 문자열 → 목록 기본 상태', () => {
    assert.deepStrictEqual(parseHash(''), {
      view: 'list', keyword: '', sourceIds: [], topics: [], period: 'all', page: 1,
      sort: 'newest', cols: 1, customFrom: '', customTo: '',
    });
  });
  it('#/ → 목록 기본 상태', () => {
    assert.deepStrictEqual(parseHash('#/'), {
      view: 'list', keyword: '', sourceIds: [], topics: [], period: 'all', page: 1,
      sort: 'newest', cols: 1, customFrom: '', customTo: '',
    });
  });
});

describe('parseHash — 상세 화면', () => {
  it('#/item/haksa-001 → detail view', () => {
    assert.deepStrictEqual(parseHash('#/item/haksa-001'), {
      view: 'detail', itemId: 'haksa-001',
    });
  });
  it('#/item/scholar-003 → detail view', () => {
    assert.deepStrictEqual(parseHash('#/item/scholar-003'), {
      view: 'detail', itemId: 'scholar-003',
    });
  });
});

describe('parseHash — 검색어', () => {
  it('한글 검색어 (리터럴)', () => {
    const r = parseHash('#/?q=졸업요건');
    assert.strictEqual(r.view, 'list');
    assert.strictEqual(r.keyword, '졸업요건');
  });
  it('한글 검색어 (URL 인코딩)', () => {
    // '졸업요건' percent-encoded
    const r = parseHash('#/?q=%EC%A1%B8%EC%97%85%EC%9A%94%EA%B1%B4');
    assert.strictEqual(r.keyword, '졸업요건');
  });
  it('빈 q → 빈 검색어', () => {
    assert.strictEqual(parseHash('#/?q=').keyword, '');
  });
});

describe('parseHash — 복합 상태', () => {
  it('#/?q=수강정정&src=haksa&period=3m&page=2', () => {
    const r = parseHash('#/?q=%EC%88%98%EA%B0%95%EC%A0%95%EC%A0%95&src=haksa&period=3m&page=2');
    assert.deepStrictEqual(r, {
      view: 'list', keyword: '수강정정', sourceIds: ['haksa'], topics: [], period: '3m', page: 2,
      sort: 'newest', cols: 1, customFrom: '', customTo: '',
    });
  });
  it('복수 출처 src=haksa,dept', () => {
    const r = parseHash('#/?src=haksa,dept');
    assert.deepStrictEqual(r.sourceIds, ['haksa', 'dept']);
  });
  it('빈 src → 빈 배열', () => {
    assert.deepStrictEqual(parseHash('#/?src=').sourceIds, []);
  });
});

describe('parseHash — 잘못된 값의 안전 처리', () => {
  it('알 수 없는 period → all', () => {
    assert.strictEqual(parseHash('#/?period=weekly').period, 'all');
  });
  it('빈 period → all', () => {
    assert.strictEqual(parseHash('#/?period=').period, 'all');
  });
  it('page=abc → 1', () => {
    assert.strictEqual(parseHash('#/?page=abc').page, 1);
  });
  it('page=0 → 1', () => {
    assert.strictEqual(parseHash('#/?page=0').page, 1);
  });
  it('page=-1 → 1', () => {
    assert.strictEqual(parseHash('#/?page=-1').page, 1);
  });
  it('page=1.5 → 1 (parseInt 절사)', () => {
    assert.strictEqual(parseHash('#/?page=1.5').page, 1);
  });
  it('page=2 → 2 (정상)', () => {
    assert.strictEqual(parseHash('#/?page=2').page, 2);
  });
});

// ── serializeListState ─────────────────────────────

describe('serializeListState — 기본값 생략', () => {
  it('기본 상태 → #/', () => {
    assert.strictEqual(
      serializeListState({ keyword: '', sourceIds: [], period: 'all', page: 1 }),
      '#/',
    );
  });
  it('기본값이면 q 파라미터 없음', () => {
    const h = serializeListState({ keyword: '', sourceIds: [], period: 'all', page: 1 });
    assert.ok(!h.includes('q='));
  });
  it('기본값이면 src 파라미터 없음', () => {
    const h = serializeListState({ keyword: '', sourceIds: [], period: 'all', page: 1 });
    assert.ok(!h.includes('src='));
  });
  it('기본값이면 period 파라미터 없음', () => {
    const h = serializeListState({ keyword: '', sourceIds: [], period: 'all', page: 1 });
    assert.ok(!h.includes('period='));
  });
  it('기본값이면 page 파라미터 없음', () => {
    const h = serializeListState({ keyword: '', sourceIds: [], period: 'all', page: 1 });
    assert.ok(!h.includes('page='));
  });
});

describe('serializeListState — 비기본값 포함', () => {
  it('검색어 있으면 q= 포함', () => {
    const h = serializeListState({ keyword: '졸업요건', sourceIds: [], period: 'all', page: 1 });
    assert.ok(h.startsWith('#/?'));
    assert.ok(h.includes('q='));
  });
  it('period=3m → period=3m 포함', () => {
    const h = serializeListState({ keyword: '', sourceIds: [], period: '3m', page: 1 });
    assert.ok(h.includes('period=3m'));
  });
  it('page=2 → page=2 포함', () => {
    const h = serializeListState({ keyword: '', sourceIds: [], period: 'all', page: 2 });
    assert.ok(h.includes('page=2'));
  });
  it('출처 있으면 src= 포함', () => {
    const h = serializeListState({ keyword: '', sourceIds: ['haksa'], period: 'all', page: 1 });
    assert.ok(h.includes('src=haksa'));
  });
});

// ── 직렬화 → 파싱 왕복 ────────────────────────────

describe('serializeListState + parseHash 왕복', () => {
  it('기본 상태 왕복', () => {
    const original = { keyword: '', sourceIds: [], period: 'all', page: 1 };
    const parsed = parseHash(serializeListState(original));
    assert.strictEqual(parsed.view, 'list');
    assert.strictEqual(parsed.keyword, original.keyword);
    assert.deepStrictEqual(parsed.sourceIds, original.sourceIds);
    assert.strictEqual(parsed.period, original.period);
    assert.strictEqual(parsed.page, original.page);
  });
  it('복합 상태 왕복 (한글 검색어 + 복수 출처)', () => {
    const original = { keyword: '수강정정', sourceIds: ['haksa', 'dept'], period: '3m', page: 2 };
    const parsed = parseHash(serializeListState(original));
    assert.strictEqual(parsed.view, 'list');
    assert.strictEqual(parsed.keyword, original.keyword);
    assert.deepStrictEqual(parsed.sourceIds, original.sourceIds);
    assert.strictEqual(parsed.period, original.period);
    assert.strictEqual(parsed.page, original.page);
  });
  it('검색어만 있는 상태 왕복', () => {
    const original = { keyword: '장학금', sourceIds: [], period: 'all', page: 1 };
    const parsed = parseHash(serializeListState(original));
    assert.strictEqual(parsed.keyword, '장학금');
    assert.deepStrictEqual(parsed.sourceIds, []);
    assert.strictEqual(parsed.period, 'all');
    assert.strictEqual(parsed.page, 1);
  });
});
