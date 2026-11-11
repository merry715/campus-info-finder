/**
 * P15 테스트: 60건 실 게시글 데이터, 출처 5개, 스냅샷 기준일, sourceId 매핑
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ITEMS, SNAPSHOT_REFERENCE_DATE, SAMPLE_REFERENCE_DATE } from '../js/data/items.js';
import { SOURCES } from '../js/data/sources.js';
import { paginate, getTotalPages } from '../js/search.js';

// ── 스냅샷 기준일 ──────────────────────────────────
describe('스냅샷 기준일', () => {
  test('SNAPSHOT_REFERENCE_DATE = 2026-11-11', () => {
    assert.strictEqual(SNAPSHOT_REFERENCE_DATE, '2026-11-11');
  });

  test('SAMPLE_REFERENCE_DATE는 SNAPSHOT_REFERENCE_DATE의 별칭', () => {
    assert.strictEqual(SAMPLE_REFERENCE_DATE, SNAPSHOT_REFERENCE_DATE);
  });
});

// ── 실 게시글 데이터 확인 ──────────────────────────
describe('P15 실 게시글 데이터', () => {
  test('모든 항목에 isSample: false', () => {
    const sampled = ITEMS.filter((i) => i.isSample !== false);
    assert.deepStrictEqual(sampled.map((i) => i.id), []);
  });

  test('모든 항목에 sourceId 필드가 있다', () => {
    const missing = ITEMS.filter((i) => !i.sourceId);
    assert.deepStrictEqual(missing.map((i) => i.id), []);
  });

  test('모든 항목에 organization 필드가 있다', () => {
    const missing = ITEMS.filter((i) => !i.organization);
    assert.deepStrictEqual(missing.map((i) => i.id), []);
  });

  test('모든 항목에 attachmentCount 필드가 있다 (null 허용)', () => {
    const missing = ITEMS.filter((i) => !('attachmentCount' in i));
    assert.deepStrictEqual(missing.map((i) => i.id), []);
  });

  test('모든 항목에 originalUrl 필드가 있다', () => {
    const missing = ITEMS.filter((i) => !i.originalUrl);
    assert.deepStrictEqual(missing.map((i) => i.id), []);
  });
});

// ── sourceId 매핑 ──────────────────────────────────
describe('sourceId 매핑', () => {
  const SOURCE_MAP = { '일반공지': 'general', '학사공지': 'haksa', '장학': 'scholar', '취업': 'career', '의과대학소식': 'medical' };

  test('source 레이블과 sourceId가 올바르게 매핑된다', () => {
    ITEMS.forEach((item) => {
      const expected = SOURCE_MAP[item.source];
      assert.strictEqual(item.sourceId, expected, `${item.id}: source="${item.source}" → sourceId 불일치`);
    });
  });

  test('모든 sourceId가 SOURCES에 존재한다', () => {
    const sourceIds = new Set(SOURCES.map((s) => s.id));
    ITEMS.forEach((item) => {
      assert.ok(sourceIds.has(item.sourceId), `${item.id}: sourceId "${item.sourceId}" 미등록`);
    });
  });
});

// ── 출처별 게시물 수 ───────────────────────────────
describe('출처별 게시물 수', () => {
  test('일반공지(general) 20건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'general').length, 20);
  });
  test('학사공지(haksa) 12건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'haksa').length, 12);
  });
  test('장학(scholar) 12건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'scholar').length, 12);
  });
  test('취업(career) 10건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'career').length, 10);
  });
  test('의과대학소식(medical) 6건', () => {
    assert.strictEqual(ITEMS.filter((i) => i.sourceId === 'medical').length, 6);
  });
});

// ── 페이지네이션: pageSize=5 ───────────────────────
describe('페이지네이션 (pageSize=5)', () => {
  const sortedItems = [...ITEMS].sort((a, b) => b.postedAt.localeCompare(a.postedAt));

  test('60건 / 5 → 12페이지', () => {
    assert.strictEqual(getTotalPages(60, 5), 12);
  });

  test('1페이지 항목은 모두 2026-11-11 (취업 게시물)', () => {
    const page1 = paginate(sortedItems, 1, 5);
    assert.strictEqual(page1.length, 5);
    page1.forEach((i) => assert.strictEqual(i.postedAt, '2026-11-11'));
  });

  test('mnu-001은 2페이지에 있다', () => {
    const page2 = paginate(sortedItems, 2, 5);
    assert.ok(page2.some((i) => i.id === 'mnu-001'));
  });

  test('mnu-001은 1페이지에 없다', () => {
    const page1 = paginate(sortedItems, 1, 5);
    assert.ok(!page1.some((i) => i.id === 'mnu-001'));
  });
});

// ── 출처 5개 무결성 ────────────────────────────────
describe('출처 5개 무결성', () => {
  test('SOURCES.length === 5', () => {
    assert.strictEqual(SOURCES.length, 5);
  });

  test('출처 id 목록: general, haksa, scholar, career, medical', () => {
    const ids = SOURCES.map((s) => s.id).sort();
    assert.deepStrictEqual(ids, ['career', 'general', 'haksa', 'medical', 'scholar']);
  });

  test('각 출처에 label과 colorToken이 있다', () => {
    SOURCES.forEach((s) => {
      assert.ok(s.label, `${s.id}: label 없음`);
      assert.ok(s.colorToken, `${s.id}: colorToken 없음`);
    });
  });
});
