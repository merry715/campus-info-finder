/**
 * P19 테스트: 레이아웃 폭 안정화 + 작성자 검색 확장
 * DOM이 없는 Node 환경이므로 소스 파일 텍스트와 순수 함수로 검증한다.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { filterByKeyword } from '../js/search.js';
import { ITEMS } from '../js/data/items.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const stylesCSS = readFileSync(join(root, 'css', 'styles.css'), 'utf8');
const indexHTML = readFileSync(join(root, 'index.html'),        'utf8');

// ── 레이아웃 고정 — CSS ───────────────────────────────
describe('레이아웃 폭 안정화 — CSS grid', () => {
  test('.page-grid 기본 열 정의에 minmax(0, 1fr) 사용', () => {
    assert.ok(stylesCSS.includes('220px minmax(0, 1fr)'),
      '.page-grid가 minmax(0, 1fr)을 사용하지 않음 — 1fr은 콘텐츠 최솟값에 의해 열 너비가 변함');
  });

  test('960px 반응형 breakpoint에도 minmax(0, 1fr) 사용', () => {
    const breakpointIdx = stylesCSS.indexOf('@media (max-width: 960px)');
    assert.ok(breakpointIdx >= 0, '960px 반응형 breakpoint 없음');
    const block = stylesCSS.slice(breakpointIdx, breakpointIdx + 300);
    assert.ok(block.includes('minmax(0, 1fr)'),
      '960px breakpoint의 .page-grid에 minmax(0, 1fr) 없음');
  });

  test('960px breakpoint에 "190px 1fr" 형태가 없음 (구 고정값 제거 확인)', () => {
    const breakpointIdx = stylesCSS.indexOf('@media (max-width: 960px)');
    const block = stylesCSS.slice(breakpointIdx, breakpointIdx + 300);
    assert.ok(!block.includes('190px 1fr'),
      '960px breakpoint에 "190px 1fr"이 남아 있음 — minmax(0, 1fr)로 교체해야 함');
  });
});

// ── 검색 placeholder / index.html ────────────────────
describe('검색창 — placeholder 텍스트', () => {
  test('index.html placeholder가 "제목, 내용, 작성자에서 검색"', () => {
    assert.ok(indexHTML.includes('제목, 내용, 작성자에서 검색'),
      'index.html search placeholder가 "제목, 내용, 작성자에서 검색"이 아님');
  });

  test('index.html에 구 placeholder "제목, 요약, 본문에서 검색"이 없음', () => {
    assert.ok(!indexHTML.includes('제목, 요약, 본문에서 검색'),
      '구 placeholder "제목, 요약, 본문에서 검색"이 아직 남아 있음');
  });
});

// ── 작성자/기관 검색 — filterByKeyword ────────────────
describe('filterByKeyword — author/organization 검색 확장', () => {
  test('작성자(author)로만 검색 — "입학관리과"는 mnu-017의 author 필드에만 있음', () => {
    const result = filterByKeyword(ITEMS, '입학관리과');
    assert.ok(result.some((i) => i.id === 'mnu-017'),
      '"입학관리과"로 mnu-017을 찾지 못함 — author 필드가 검색 대상에 포함되지 않은 것으로 보임');
  });

  test('기관(organization)으로 검색 — "글로벌학부"는 mnu-022의 organization 필드에만 있음', () => {
    const result = filterByKeyword(ITEMS, '글로벌학부');
    assert.ok(result.some((i) => i.id === 'mnu-022'),
      '"글로벌학부"로 mnu-022를 찾지 못함 — organization 필드가 검색 대상에 포함되지 않은 것으로 보임');
  });

  test('AND 검색: 제목 단어 + 작성자 — 두 필드에 걸쳐 AND 동작', () => {
    // mnu-017: title에 "수시모집", author에 "입학관리과"
    const result = filterByKeyword(ITEMS, '수시모집 입학관리과');
    assert.ok(result.some((i) => i.id === 'mnu-017'),
      '제목+작성자 AND 검색에서 mnu-017을 찾지 못함');
  });

  test('AND 검색: 두 조건 중 하나가 없으면 제외', () => {
    // "입학관리과"는 mnu-017만, "글로벌학부"는 mnu-022만 → AND는 0건
    const result = filterByKeyword(ITEMS, '입학관리과 글로벌학부');
    assert.strictEqual(result.length, 0,
      '"입학관리과 글로벌학부" AND 검색은 0건이어야 함');
  });

  test('author가 undefined인 항목도 에러 없이 처리', () => {
    const items = [
      { id: 'x', title: '제목', summary: '요약', body: '본문', postedAt: '2026-01-01' },
    ];
    assert.doesNotThrow(() => filterByKeyword(items, '제목'),
      'author가 없는 항목에서 에러 발생');
  });

  test('organization이 undefined인 항목도 에러 없이 처리', () => {
    const items = [
      { id: 'y', title: '제목', summary: '요약', body: '본문', postedAt: '2026-01-01', author: '작성자' },
    ];
    assert.doesNotThrow(() => filterByKeyword(items, '작성자'),
      'organization이 없는 항목에서 에러 발생');
  });
});
