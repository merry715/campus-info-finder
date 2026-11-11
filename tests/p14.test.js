/**
 * P14 테스트: filterByTopic, getSuggestions, applyFilters(topics),
 *            parseHash / serializeListState topics 파라미터,
 *            데이터 무결성 (모든 항목에 유효한 topic 필드)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { filterByTopic, getSuggestions, applyFilters } from '../js/search.js';
import { parseHash, serializeListState } from '../js/state.js';
import { ITEMS } from '../js/data/items.js';
import { TOPIC_IDS } from '../js/data/topics.js';

const BASE = { summary: '', body: '', department: '', attachments: [], isSample: true, sourceId: 'haksa' };

const items = [
  { ...BASE, id: 'a', title: '학사 공지', postedAt: '2026-11-05', topic: 'academic' },
  { ...BASE, id: 'b', title: '장학금 안내', postedAt: '2026-10-15', topic: 'scholarship' },
  { ...BASE, id: 'c', title: '취업 설명회', postedAt: '2026-09-01', topic: 'career' },
  { ...BASE, id: 'd', title: '비교과 프로그램', postedAt: '2025-11-20', topic: 'extracurricular' },
];

// ── filterByTopic ──────────────────────────────────
describe('filterByTopic', () => {
  test('빈 topicIds: 전체 반환', () => {
    assert.deepStrictEqual(filterByTopic(items, []), items);
  });

  test('null/undefined topicIds: 전체 반환', () => {
    assert.deepStrictEqual(filterByTopic(items, null), items);
    assert.deepStrictEqual(filterByTopic(items, undefined), items);
  });

  test('단일 주제 선택: 해당 주제만 반환', () => {
    const result = filterByTopic(items, ['academic']);
    assert.deepStrictEqual(result.map((i) => i.id), ['a']);
  });

  test('복수 주제 선택: OR 방식으로 합집합 반환', () => {
    const result = filterByTopic(items, ['academic', 'scholarship']);
    assert.deepStrictEqual(result.map((i) => i.id), ['a', 'b']);
  });

  test('존재하지 않는 주제 ID: 빈 배열 반환', () => {
    const result = filterByTopic(items, ['nonexistent']);
    assert.deepStrictEqual(result, []);
  });

  test('빈 items: 빈 배열 반환', () => {
    assert.deepStrictEqual(filterByTopic([], ['academic']), []);
  });

  test('전체 주제 선택 시 모든 항목 반환', () => {
    const result = filterByTopic(items, ['academic', 'scholarship', 'career', 'extracurricular']);
    assert.strictEqual(result.length, 4);
  });

  test('원본 배열을 변경하지 않는다', () => {
    const original = items.map((i) => i.id);
    filterByTopic(items, ['academic']);
    assert.deepStrictEqual(items.map((i) => i.id), original);
  });
});

// ── getSuggestions ─────────────────────────────────
describe('getSuggestions', () => {
  test('2자 미만 키워드: 빈 배열 반환', () => {
    assert.deepStrictEqual(getSuggestions(items, '학'), []);
  });

  test('빈 키워드: 빈 배열 반환', () => {
    assert.deepStrictEqual(getSuggestions(items, ''), []);
  });

  test('공백만: 빈 배열 반환', () => {
    assert.deepStrictEqual(getSuggestions(items, '  '), []);
  });

  test('제목에 포함된 키워드로 검색', () => {
    const result = getSuggestions(items, '학사');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'a');
  });

  test('대소문자 무관 (한글 소문자 없으므로 사실상 무관)', () => {
    const result = getSuggestions(items, '취업');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'c');
  });

  test('maxCount 기본값 6 초과 시 최대 6개만 반환', () => {
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
      ...BASE, id: `x${i}`, title: `공통키워드 항목 ${i}`, postedAt: '2026-11-01', topic: 'academic',
    }));
    const result = getSuggestions(manyItems, '공통키워드');
    assert.strictEqual(result.length, 6);
  });

  test('maxCount 사용자 지정', () => {
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
      ...BASE, id: `y${i}`, title: `같은단어 항목 ${i}`, postedAt: '2026-11-01', topic: 'academic',
    }));
    const result = getSuggestions(manyItems, '같은단어', 3);
    assert.strictEqual(result.length, 3);
  });

  test('빈 items: 빈 배열 반환', () => {
    assert.deepStrictEqual(getSuggestions([], '학사'), []);
  });

  test('summary/body는 검색하지 않고 title만 검색', () => {
    const testItems = [
      { ...BASE, id: 'ta', title: '다른 제목', summary: '키워드', body: '키워드', postedAt: '2026-11-01', topic: 'academic' },
    ];
    const result = getSuggestions(testItems, '키워드');
    assert.deepStrictEqual(result, []);
  });
});

// ── applyFilters — topics 파라미터 ─────────────────
describe('applyFilters — topics', () => {
  const REF = '2026-11-10';
  const baseFilter = { keyword: '', sourceIds: [], period: 'all' };

  test('topics 없으면 전체 반환 (하위 호환)', () => {
    const result = applyFilters(items, baseFilter, REF);
    assert.deepStrictEqual(result, items);
  });

  test('topics=[] 전체 반환', () => {
    const result = applyFilters(items, { ...baseFilter, topics: [] }, REF);
    assert.deepStrictEqual(result, items);
  });

  test('topics=[academic] 학사 항목만 반환', () => {
    const result = applyFilters(items, { ...baseFilter, topics: ['academic'] }, REF);
    assert.deepStrictEqual(result.map((i) => i.id), ['a']);
  });

  test('topics=[scholarship, career] OR 방식 필터링', () => {
    const result = applyFilters(items, { ...baseFilter, topics: ['scholarship', 'career'] }, REF);
    assert.deepStrictEqual(result.map((i) => i.id), ['b', 'c']);
  });

  test('keyword + topics 조합 AND 방식', () => {
    const result = applyFilters(items,
      { keyword: '안내', sourceIds: [], topics: ['scholarship'], period: 'all' }, REF);
    assert.deepStrictEqual(result.map((i) => i.id), ['b']); // 장학금 안내
  });

  test('topics + period 조합', () => {
    const result = applyFilters(items,
      { keyword: '', sourceIds: [], topics: ['academic', 'scholarship'], period: '1y' }, REF);
    // 1y cutoff: 2025-11-10. academic(2026-11-05), scholarship(2026-10-15) 모두 포함
    assert.ok(result.some((i) => i.id === 'a'));
    assert.ok(result.some((i) => i.id === 'b'));
    assert.ok(!result.some((i) => i.id === 'c'));
    assert.ok(!result.some((i) => i.id === 'd'));
  });

  test('매칭 없는 topics: 빈 배열 반환', () => {
    const result = applyFilters(items, { ...baseFilter, topics: ['admission'] }, REF);
    assert.deepStrictEqual(result, []);
  });
});

// ── parseHash — P14 topics 파라미터 ───────────────
describe('parseHash — P14 topics', () => {
  test('topics 없으면 빈 배열', () => {
    assert.deepStrictEqual(parseHash('#/').topics, []);
  });

  test('단일 topic 파싱', () => {
    assert.deepStrictEqual(parseHash('#/?topics=academic').topics, ['academic']);
  });

  test('복수 topic 파싱 (쉼표 구분)', () => {
    const result = parseHash('#/?topics=academic,scholarship').topics;
    assert.deepStrictEqual(result, ['academic', 'scholarship']);
  });

  test('topics와 다른 파라미터 조합 파싱', () => {
    const r = parseHash('#/?q=장학&topics=scholarship&period=3m&page=2');
    assert.strictEqual(r.keyword, '장학');
    assert.deepStrictEqual(r.topics, ['scholarship']);
    assert.strictEqual(r.period, '3m');
    assert.strictEqual(r.page, 2);
  });

  test('빈 topics 파라미터: 빈 배열', () => {
    assert.deepStrictEqual(parseHash('#/?topics=').topics, []);
  });
});

// ── serializeListState — P14 topics 파라미터 ──────
describe('serializeListState — P14 topics', () => {
  const base = { keyword: '', sourceIds: [], topics: [], period: 'all', page: 1,
                 sort: 'newest', cols: 1, customFrom: '', customTo: '' };

  test('topics=[] 는 URL에 포함하지 않음', () => {
    const hash = serializeListState(base);
    assert.ok(!hash.includes('topics='));
  });

  test('topics=[academic] URL에 포함', () => {
    const hash = serializeListState({ ...base, topics: ['academic'] });
    assert.ok(hash.includes('topics=academic'));
  });

  test('topics=[academic,scholarship] 쉼표 구분으로 포함', () => {
    const hash = serializeListState({ ...base, topics: ['academic', 'scholarship'] });
    assert.ok(hash.includes('topics=academic%2Cscholarship') || hash.includes('topics=academic,scholarship'));
  });

  test('topics 직렬화 후 parseHash로 복원 가능', () => {
    const hash = serializeListState({ ...base, topics: ['career', 'campus'] });
    const restored = parseHash(hash);
    assert.deepStrictEqual(restored.topics, ['career', 'campus']);
  });

  test('topics 없이 호출해도 오류 없이 동작 (하위 호환)', () => {
    const hash = serializeListState({ keyword: '', sourceIds: [], period: 'all', page: 1 });
    assert.strictEqual(hash, '#/');
  });
});

// ── 데이터 무결성: 모든 항목에 유효한 topic 필드 ───
describe('데이터 무결성 — topic 필드', () => {
  test('모든 60개 항목에 topic 필드가 있다', () => {
    const missing = ITEMS.filter((i) => !i.topic);
    assert.deepStrictEqual(missing.map((i) => i.id), []);
  });

  test('모든 항목의 topic이 TOPIC_IDS에 속한다', () => {
    const invalid = ITEMS.filter((i) => !TOPIC_IDS.has(i.topic));
    assert.deepStrictEqual(invalid.map((i) => i.id), []);
  });

  test('academic 주제 항목 수: 9개', () => {
    const count = ITEMS.filter((i) => i.topic === 'academic').length;
    assert.strictEqual(count, 9);
  });

  test('scholarship 주제 항목 수: 12개', () => {
    const count = ITEMS.filter((i) => i.topic === 'scholarship').length;
    assert.strictEqual(count, 12);
  });

  test('career 주제 항목 수: 12개', () => {
    const count = ITEMS.filter((i) => i.topic === 'career').length;
    assert.strictEqual(count, 12);
  });

  test('extracurricular 주제 항목 수: 13개', () => {
    const count = ITEMS.filter((i) => i.topic === 'extracurricular').length;
    assert.strictEqual(count, 13);
  });

  test('campus 주제 항목 수: 6개', () => {
    const count = ITEMS.filter((i) => i.topic === 'campus').length;
    assert.strictEqual(count, 6);
  });

  test('admission 주제 항목 수: 1개', () => {
    assert.strictEqual(ITEMS.filter((i) => i.topic === 'admission').length, 1);
  });

  test('university 주제 항목 수: 7개', () => {
    assert.strictEqual(ITEMS.filter((i) => i.topic === 'university').length, 7);
  });
});
