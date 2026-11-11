/**
 * P13 테스트: sortItems 오래된 순 세부 규칙, 제목순 월 그룹 (P13 변경)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sortItems } from '../js/search.js';

const BASE = { summary: '', body: '', department: '', attachments: [], isSample: true, sourceId: 'haksa' };

// ── sortItems — 오래된 순 세부 규칙 ──────────────────
describe('sortItems — 오래된 순 세부 규칙', () => {
  test('오래된 순: 가장 오래된 달이 먼저', () => {
    const items = [
      { ...BASE, id: 'a', title: 'A', postedAt: '2026-11-05' },
      { ...BASE, id: 'b', title: 'B', postedAt: '2025-03-10' },
      { ...BASE, id: 'c', title: 'C', postedAt: '2026-08-20' },
    ];
    const result = sortItems(items, 'oldest');
    assert.strictEqual(result[0].id, 'b');  // 2025-03 가장 오래됨
    assert.strictEqual(result[result.length - 1].id, 'a');  // 2026-11 가장 최신
  });

  test('오래된 순: 같은 달 내에서 오래된 날짜가 먼저', () => {
    const items = [
      { ...BASE, id: 'a', title: 'A', postedAt: '2026-11-20' },
      { ...BASE, id: 'b', title: 'B', postedAt: '2026-11-05' },
      { ...BASE, id: 'c', title: 'C', postedAt: '2026-11-01' },
    ];
    const result = sortItems(items, 'oldest');
    assert.deepStrictEqual(result.map((i) => i.id), ['c', 'b', 'a']);
  });

  test('오래된 순: 여러 달에 걸쳐 오래된 순서', () => {
    const items = [
      { ...BASE, id: 'a', title: 'A', postedAt: '2026-11-05' },
      { ...BASE, id: 'b', title: 'B', postedAt: '2026-10-20' },
      { ...BASE, id: 'c', title: 'C', postedAt: '2026-10-05' },
      { ...BASE, id: 'd', title: 'D', postedAt: '2025-12-15' },
    ];
    const result = sortItems(items, 'oldest');
    assert.deepStrictEqual(result.map((i) => i.id), ['d', 'c', 'b', 'a']);
  });
});

// ── sortItems — 제목순 월 그룹 (P13) ─────────────────
describe('sortItems — 제목순 월 그룹 (P13)', () => {
  test('제목순: 단일 달 내에서 제목 가나다순', () => {
    const items = [
      { ...BASE, id: 'a', title: '다라마', postedAt: '2026-11-10' },
      { ...BASE, id: 'b', title: '가나다', postedAt: '2026-11-05' },
      { ...BASE, id: 'c', title: '나다라', postedAt: '2026-11-01' },
    ];
    const result = sortItems(items, 'title');
    assert.strictEqual(result[0].id, 'b');  // 가나다
    assert.strictEqual(result[1].id, 'c');  // 나다라
    assert.strictEqual(result[2].id, 'a');  // 다라마
  });

  test('제목순: 최신 월 그룹이 먼저', () => {
    const items = [
      { ...BASE, id: 'a', title: '공지A', postedAt: '2026-11-05' },
      { ...BASE, id: 'b', title: '공지B', postedAt: '2026-10-15' },
    ];
    const result = sortItems(items, 'title');
    assert.strictEqual(result[0].id, 'a');  // 최신 달(2026-11)
    assert.strictEqual(result[1].id, 'b');  // 오래된 달(2026-10)
  });

  test('제목순: 여러 달에 걸친 복합 정렬', () => {
    const items = [
      { ...BASE, id: 'a', title: '나', postedAt: '2026-11-10' },
      { ...BASE, id: 'b', title: '가', postedAt: '2026-11-05' },
      { ...BASE, id: 'c', title: '다', postedAt: '2026-10-20' },
      { ...BASE, id: 'd', title: '나', postedAt: '2026-10-15' },
    ];
    const result = sortItems(items, 'title');
    // 2026-11: 가(b), 나(a) / 2026-10: 나(d), 다(c)
    assert.deepStrictEqual(result.map((i) => i.id), ['b', 'a', 'd', 'c']);
  });

  test('제목순: 원본 배열을 변경하지 않는다', () => {
    const items = [
      { ...BASE, id: 'a', title: '나중 공지', postedAt: '2026-11-05' },
      { ...BASE, id: 'b', title: '가운데 공지', postedAt: '2026-10-15' },
    ];
    const original = items.map((i) => i.id);
    sortItems(items, 'title');
    assert.deepStrictEqual(items.map((i) => i.id), original);
  });

  test('제목순: 빈 배열 반환', () => {
    assert.deepStrictEqual(sortItems([], 'title'), []);
  });

  test('제목순: 단일 항목 그대로 반환', () => {
    const item = { ...BASE, id: 'a', title: '공지', postedAt: '2026-11-01' };
    const result = sortItems([item], 'title');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'a');
  });
});
