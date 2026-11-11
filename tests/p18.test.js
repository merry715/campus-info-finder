/**
 * P18 테스트: 고정 게시글 패널 명칭·접기 버그·카드 분리
 * DOM이 없는 Node 환경이므로 소스 파일 텍스트를 직접 검증한다.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const appJs     = readFileSync(join(root, 'js', 'app.js'),      'utf8');
const stylesCSS = readFileSync(join(root, 'css', 'styles.css'), 'utf8');

// ── 명칭 변경 ─────────────────────────────────────
describe('패널 명칭 — 중요 공지 → 고정 게시글', () => {
  test('app.js에 "중요 공지" 문자열이 남아 있지 않음', () => {
    assert.ok(!appJs.includes('중요 공지'),
      'app.js에 "중요 공지" 표현이 남아 있음 — "고정 게시글"로 교체해야 함');
  });

  test('app.js 패널 제목이 "고정 게시글"', () => {
    assert.ok(appJs.includes("'고정 게시글'"),
      'app.js에 패널 제목 "고정 게시글" 없음');
  });

  test('styles.css에 "중요 공지" 한국어 주석이 남아 있지 않음', () => {
    // CSS 한국어 주석에 "중요 공지"가 있으면 명칭이 불일치함
    const commentMatches = [...stylesCSS.matchAll(/\/\*[^*]*중요 공지[^*]*\*\//g)];
    assert.strictEqual(commentMatches.length, 0,
      'styles.css 주석에 "중요 공지"가 남아 있음');
  });
});

// ── 접기/펼치기 버튼 텍스트 ──────────────────────
describe('접기/펼치기 버튼 텍스트', () => {
  test('펼쳐진 상태 버튼 텍스트 "접기 ▲" 포함', () => {
    assert.ok(appJs.includes('접기 ▲'),
      'app.js에 "접기 ▲" 버튼 텍스트 없음');
  });

  test('접힌 상태 버튼 텍스트 "펼치기 ▼" 포함', () => {
    assert.ok(appJs.includes('펼치기 ▼'),
      'app.js에 "펼치기 ▼" 버튼 텍스트 없음');
  });

  test('삼각형 단독 기호 "▸" "▾" 가 버튼 텍스트로 쓰이지 않음', () => {
    // toggleBtn.textContent = '▸' 또는 '▾' 형태가 없어야 함
    assert.ok(!appJs.includes("'▸'"),  'app.js에 "▸" 단독 버튼 텍스트가 남아 있음');
    assert.ok(!appJs.includes("'▾'"),  'app.js에 "▾" 단독 버튼 텍스트가 남아 있음');
  });
});

// ── 접근성 속성 ───────────────────────────────────
describe('접기/펼치기 접근성', () => {
  test('aria-expanded 처리가 있음', () => {
    assert.ok(appJs.includes('aria-expanded'),
      'app.js에 aria-expanded 처리 없음');
  });

  test('aria-controls가 pinned-panel-body와 연결됨', () => {
    assert.ok(appJs.includes("aria-controls', 'pinned-panel-body'"),
      'aria-controls가 pinned-panel-body와 연결되지 않음');
  });

  test('aria-label에 "고정 게시글 접기" 포함', () => {
    assert.ok(appJs.includes('고정 게시글 접기'),
      'app.js에 "고정 게시글 접기" aria-label 없음');
  });

  test('aria-label에 "고정 게시글 펼치기" 포함', () => {
    assert.ok(appJs.includes('고정 게시글 펼치기'),
      'app.js에 "고정 게시글 펼치기" aria-label 없음');
  });
});

// ── 접기 버그 수정 ────────────────────────────────
describe('접기 버그 수정 — [hidden] CSS 리셋', () => {
  test('styles.css에 [hidden] { display: none !important } 규칙이 있음', () => {
    assert.ok(stylesCSS.includes('[hidden]') && stylesCSS.includes('!important'),
      'styles.css에 [hidden] 리셋 규칙이 없음 — display:flex 등이 hidden 속성을 덮어씀');
  });

  test('[hidden] 규칙이 컴포넌트 스타일보다 앞에 위치함', () => {
    const hiddenPos      = stylesCSS.indexOf('[hidden]');
    const pinnedBodyPos  = stylesCSS.indexOf('.pinned-panel__body');
    assert.ok(hiddenPos < pinnedBodyPos,
      '[hidden] 규칙이 .pinned-panel__body 보다 뒤에 있음');
  });
});

// ── 카드 분리 CSS ─────────────────────────────────
describe('고정 게시글 카드 분리 — CSS', () => {
  test('.pinned-card에 background가 있음 (카드 배경)', () => {
    // .pinned-card { ... } 블록을 찾아 background 포함 여부 확인
    const start = stylesCSS.indexOf('.pinned-card {');
    const end   = stylesCSS.indexOf('}', start);
    const block = stylesCSS.slice(start, end);
    assert.ok(block.includes('background'), '.pinned-card에 background 없음');
  });

  test('.pinned-card에 border 속성이 있음 (카드 테두리)', () => {
    const start = stylesCSS.indexOf('.pinned-card {');
    const end   = stylesCSS.indexOf('}', start);
    const block = stylesCSS.slice(start, end);
    assert.ok(block.includes('border'), '.pinned-card에 border 없음');
  });

  test('.pinned-card에 padding이 있음 (카드 내부 여백)', () => {
    const start = stylesCSS.indexOf('.pinned-card {');
    const end   = stylesCSS.indexOf('}', start);
    const block = stylesCSS.slice(start, end);
    assert.ok(block.includes('padding'), '.pinned-card에 padding 없음');
  });

  test('.pinned-card:last-child 구분선 방식이 제거됨', () => {
    assert.ok(!stylesCSS.includes('.pinned-card:last-child'),
      '.pinned-card:last-child 가 아직 남아 있음 — 구분선 방식 제거 필요');
  });

  test('.pinned-panel__body에 gap이 설정됨 (카드 간 여백)', () => {
    const start = stylesCSS.indexOf('.pinned-panel__body {');
    const end   = stylesCSS.indexOf('}', start);
    const block = stylesCSS.slice(start, end);
    assert.ok(block.includes('gap'), '.pinned-panel__body에 gap 없음');
  });
});
