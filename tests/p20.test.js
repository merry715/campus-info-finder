/**
 * P20 테스트: pinned-only 상태 판정 + 원문 링크 생성
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getEmptyStateType, getOriginalLinks, splitPinnedItems } from '../js/search.js';
import { ITEMS } from '../js/data/items.js';

// ── getEmptyStateType ─────────────────────────────
describe('getEmptyStateType — 중앙 목록 영역 상태 판정', () => {
  test('regular > 0 → "list" (일반 목록 표시)', () => {
    assert.strictEqual(getEmptyStateType(5, 0), 'list');
  });

  test('regular > 0, pinned > 0 → "list" (regular가 하나라도 있으면 목록 표시)', () => {
    assert.strictEqual(getEmptyStateType(3, 2), 'list');
  });

  test('regular = 0, pinned > 0 → "pinned-only" (고정 게시글에만 결과)', () => {
    assert.strictEqual(getEmptyStateType(0, 1), 'pinned-only');
  });

  test('regular = 0, pinned = 0 → "empty" (결과 없음)', () => {
    assert.strictEqual(getEmptyStateType(0, 0), 'empty');
  });
});

// ── getOriginalLinks ──────────────────────────────
describe('getOriginalLinks — 원문 링크 목록 반환', () => {
  test('sourceEntries가 없고 최상위 originalUrl이 있으면 그것을 반환', () => {
    const item = {
      id: 'x', source: '일반공지', sourceId: 'general',
      originalUrl: 'https://example.com/x',
    };
    const links = getOriginalLinks(item);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].originalUrl, 'https://example.com/x');
    assert.strictEqual(links[0].sourceId, 'general');
  });

  test('sourceEntries가 있으면 최상위 originalUrl 대신 sourceEntries를 사용', () => {
    const item = {
      id: 'y', source: '일반공지', sourceId: 'general',
      originalUrl: 'https://legacy.example.com/y',
      sourceEntries: [
        { source: '일반공지', sourceId: 'general', originalUrl: 'https://example.com/y', isPinned: false },
      ],
    };
    const links = getOriginalLinks(item);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].originalUrl, 'https://example.com/y');
  });

  test('복수 sourceEntries — 각각 링크 반환', () => {
    const item = {
      id: 'z', source: '일반공지', sourceId: 'general',
      sourceEntries: [
        { source: '일반공지', sourceId: 'general', originalUrl: 'https://example.com/general', isPinned: false },
        { source: '학사공지', sourceId: 'haksa',   originalUrl: 'https://example.com/haksa',   isPinned: true  },
      ],
    };
    const links = getOriginalLinks(item);
    assert.strictEqual(links.length, 2);
    assert.ok(links.some((l) => l.sourceId === 'general'));
    assert.ok(links.some((l) => l.sourceId === 'haksa'));
  });

  test('originalUrl이 없는 sourceEntry는 제외', () => {
    const item = {
      id: 'w', source: '일반공지', sourceId: 'general',
      sourceEntries: [
        { source: '일반공지', sourceId: 'general', isPinned: false },
        { source: '학사공지', sourceId: 'haksa',   originalUrl: 'https://example.com/haksa', isPinned: true },
      ],
    };
    const links = getOriginalLinks(item);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].sourceId, 'haksa');
  });

  test('sourceEntries 없고 최상위 originalUrl도 없으면 빈 배열', () => {
    const item = { id: 'v', source: '일반공지', sourceId: 'general' };
    const links = getOriginalLinks(item);
    assert.deepStrictEqual(links, []);
  });
});

// ── 한책 게시글 (mnu-014) 검증 ─────────────────────
describe('한책 게시글(mnu-014) — 다중 출처 링크 + pinned-only 상태', () => {
  const mnu014 = ITEMS.find((i) => i.id === 'mnu-014');

  test('mnu-014 존재', () => {
    assert.ok(mnu014, 'mnu-014 항목이 데이터에 없음');
  });

  test('mnu-014 — getOriginalLinks: 일반공지·학사공지 두 링크 반환', () => {
    const links = getOriginalLinks(mnu014);
    assert.strictEqual(links.length, 2, '링크가 2개가 아님');
    assert.ok(links.some((l) => l.sourceId === 'general'), '일반공지 링크 없음');
    assert.ok(links.some((l) => l.sourceId === 'haksa'),   '학사공지 링크 없음');
  });

  test('mnu-014 — 각 링크의 originalUrl이 비어 있지 않음', () => {
    const links = getOriginalLinks(mnu014);
    links.forEach((l) => {
      assert.ok(l.originalUrl && l.originalUrl.length > 0, `${l.sourceId} 링크 URL이 비어 있음`);
    });
  });

  test('"한책" 검색 — splitPinnedItems: pinned=1, regular=0', () => {
    const keyword = '한책';
    const filtered = ITEMS.filter((i) => {
      const hay = `${i.title} ${i.summary} ${i.body} ${i.author ?? ''} ${i.organization ?? ''}`.toLowerCase();
      return hay.includes(keyword);
    });
    const { pinned, regular } = splitPinnedItems(filtered, []);
    assert.strictEqual(pinned.length,  1, 'pinned가 1건이 아님');
    assert.strictEqual(regular.length, 0, 'regular가 0건이 아님');
  });

  test('"한책" 검색 — getEmptyStateType → "pinned-only"', () => {
    const keyword = '한책';
    const filtered = ITEMS.filter((i) => {
      const hay = `${i.title} ${i.summary} ${i.body} ${i.author ?? ''} ${i.organization ?? ''}`.toLowerCase();
      return hay.includes(keyword);
    });
    const { pinned, regular } = splitPinnedItems(filtered, []);
    const stateType = getEmptyStateType(regular.length, pinned.length);
    assert.strictEqual(stateType, 'pinned-only',
      '"한책" 검색 결과가 "pinned-only"가 아님 — "검색 결과가 없습니다" 버그');
  });
});

// ── 60건 데이터 originalUrl 보존 확인 ───────────────
describe('실제 데이터 — originalUrl 구조 확인', () => {
  test('sourceEntries가 있는 모든 item은 각 entry에 originalUrl이 있거나 명시적으로 없다', () => {
    ITEMS.forEach((item) => {
      if (item.sourceEntries && item.sourceEntries.length) {
        item.sourceEntries.forEach((entry) => {
          // originalUrl이 있다면 string이어야 한다 (undefined나 null이 아닌 string)
          if (entry.originalUrl !== undefined && entry.originalUrl !== null) {
            assert.strictEqual(typeof entry.originalUrl, 'string',
              `${item.id}의 sourceEntry originalUrl이 string이 아님`);
          }
        });
      }
    });
  });

  test('getOriginalLinks: 60건 중 URL이 1개 이상인 항목이 50개 이상', () => {
    const withLinks = ITEMS.filter((i) => getOriginalLinks(i).length > 0);
    assert.ok(withLinks.length >= 50,
      `URL 있는 항목이 ${withLinks.length}건으로 50건 미만 — 데이터 손상 가능성`);
  });
});
