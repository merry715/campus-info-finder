import { SOURCES } from './data/sources.js';
import { TOPICS } from './data/topics.js';
import { ITEMS, SNAPSHOT_REFERENCE_DATE } from './data/items.js';
import { applyFilters, paginate, getTotalPages, sortItems, isValidDateRange, getPeriodDisplayRange, groupItemsByMonth, getSuggestions, getVisiblePageRange, splitPinnedItems, getItemSources, getEmptyStateType, getOriginalLinks } from './search.js';
import { parseHash, serializeListState } from './state.js';

const PAGE_SIZE = 5;
const itemMap   = new Map(ITEMS.map((i) => [i.id, i]));
const sourceMap = new Map(SOURCES.map((s) => [s.id, s]));
const topicMap  = new Map(TOPICS.map((t) => [t.id, t]));

// 출처별 전체 게시물 수 (필터 항목 옆 카운트용)
const sourceCountMap = new Map(
  SOURCES.map((s) => [s.id, ITEMS.filter((i) => i.sourceId === s.id).length])
);

// 주제별 전체 게시물 수 (필터 항목 옆 카운트용)
const topicCountMap = new Map(
  TOPICS.map((t) => [t.id, ITEMS.filter((i) => i.topic === t.id).length])
);

const PERIOD_OPTIONS = [
  { value: 'all',    label: '전체' },
  { value: '1m',     label: '최근 1개월' },
  { value: '3m',     label: '최근 3개월' },
  { value: '1y',     label: '최근 1년' },
  { value: 'custom', label: '직접 설정' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: '최신순' },
  { value: 'oldest', label: '오래된 순' },
  { value: 'title',  label: '제목순' },
];

// ── 애플리케이션 상태 ─────────────────────────────
let state = {
  keyword:    '',
  sourceIds:  [],   // 선택된 출처 ID 목록 (빈 배열 = 전체)
  topics:     [],   // 선택된 주제 ID 목록 (빈 배열 = 전체)
  period:     'all',
  page:       1,
  sort:       'newest',
  cols:       1,    // 목록 열 수 (보기 방식)
  customFrom: '',
  customTo:   '',
};

// 직접 설정 날짜 범위 드래프트 (기간 적용 버튼을 눌러야 state에 반영됨)
let draftFrom = '';
let draftTo   = '';

// 상세 화면에서 "검색 결과로 돌아가기"의 목적지.
// 목록 → 상세로 이동할 때 hashchange 핸들러가 갱신한다.
let detailBackHash = '#/';

// 현재 표시 중인 화면. 상세 → 목록 전환 시 포커스 이동 판단에 사용한다 (CLAUDE.md 5절).
let currentView = null; // 'list' | 'detail' — null: 첫 로드

// 고정 게시글 패널 접기 상태. URL에 저장하지 않음 — 새로고침 시 기본 펼침.
let pinnedPanelCollapsed = false;

// ── URL 쓰기 ──────────────────────────────────────
function replaceHash(hash) {
  history.replaceState(null, '', hash);
}

// ── 상태 업데이트 ──────────────────────────────────
function update(changes) {
  // 필터·정렬 변경은 1페이지로 돌아간다. cols 변경은 페이지를 유지한다.
  const isFilterChange =
    'keyword' in changes || 'sourceIds' in changes || 'topics' in changes ||
    'period' in changes || 'customFrom' in changes || 'customTo' in changes ||
    'sort' in changes;
  Object.assign(state, changes);
  if (isFilterChange) state.page = 1;
  clearSuggestions();
  replaceHash(serializeListState(state)); // 필터·검색 변경은 history에 쌓지 않음
  syncFilterUI();
  render();
}

function resetAll() {
  document.getElementById('search-input').value = '';
  // cols(보기 방식)는 초기화하지 않는다
  update({ keyword: '', sourceIds: [], topics: [], period: 'all', sort: 'newest', customFrom: '', customTo: '' });
}

// ── 뷰 전환 ──────────────────────────────────────
function showListView() {
  document.getElementById('list-view').hidden = false;
  document.getElementById('detail-view').hidden = true;
}

function showDetailView(item) {
  document.getElementById('list-view').hidden = true;
  document.getElementById('detail-view').hidden = false;
  renderDetail(item);
  // 화면 전환 시 포커스를 상세 제목으로 이동 (CLAUDE.md 5절)
  document.getElementById('detail-heading').focus();
}

// ── 라우팅 ────────────────────────────────────────
function route() {
  const parsed = parseHash(location.hash);

  if (parsed.view === 'detail') {
    currentView = 'detail';
    const item = itemMap.get(parsed.itemId);
    if (item) {
      showDetailView(item);
    } else {
      showNotFound(); // 없는 ID: 오류 화면 (P06)
    }
  } else {
    const isFromDetail = currentView === 'detail';
    currentView = 'list';

    // URL에서 목록 상태 복원
    state = {
      keyword:    parsed.keyword,
      sourceIds:  parsed.sourceIds,
      topics:     parsed.topics     ?? [],
      period:     parsed.period,
      page:       parsed.page,
      sort:       parsed.sort    ?? 'newest',
      cols:       parsed.cols    ?? 1,
      customFrom: parsed.customFrom ?? '',
      customTo:   parsed.customTo   ?? '',
    };
    // URL 복원 시 드래프트를 적용된 날짜와 동기화
    draftFrom = state.customFrom;
    draftTo   = state.customTo;
    document.getElementById('search-input').value = state.keyword;
    syncFilterUI();
    showListView();
    render();

    // 상세 → 목록 전환일 때만 포커스를 목록 제목으로 이동 (CLAUDE.md 5절)
    if (isFromDetail) {
      document.getElementById('list-heading').focus();
    }
  }
}

// 시작일 > 종료일인 잘못된 범위 여부 (적용된 state 기준 — URL 직접 접근 등 방어용)
function hasDateRangeError() {
  return state.period === 'custom' && !isValidDateRange(state.customFrom, state.customTo);
}

// 드래프트 오류 UI 동기화 (기간 적용 전 입력 단계에서 사용)
function syncDraftError() {
  const dateErrorEl = document.getElementById('date-range-error');
  const fromInput   = document.getElementById('date-from');
  const toInput     = document.getElementById('date-to');
  const hasError    = !isValidDateRange(draftFrom, draftTo);
  if (fromInput)   fromInput.setAttribute('aria-invalid', hasError ? 'true' : 'false');
  if (toInput)     toInput.setAttribute('aria-invalid', hasError ? 'true' : 'false');
  if (dateErrorEl) dateErrorEl.textContent = hasError ? '시작일은 종료일보다 늦을 수 없습니다.' : '';
}

// ── 결과 계산 ──────────────────────────────────────
function computeResults() {
  // 날짜 범위가 무효(시작일 > 종료일)이면 커스텀 날짜 필터를 건너뛴다
  const filterState = hasDateRangeError()
    ? { ...state, customFrom: '', customTo: '' }
    : state;
  const filtered              = applyFilters(ITEMS, filterState, SNAPSHOT_REFERENCE_DATE);
  const { pinned, regular }   = splitPinnedItems(filtered, state.sourceIds);
  const sorted                = sortItems(regular, state.sort);
  const totalItems            = sorted.length;          // regular 항목 수 (pagination 기준)
  const totalFilteredItems    = filtered.length;        // pinned + regular (카운트 표시 기준)
  const totalPages            = getTotalPages(totalItems, PAGE_SIZE);
  const safePage              = Math.min(state.page, totalPages);
  const pageItems             = paginate(sorted, safePage, PAGE_SIZE);
  return { pageItems, totalItems, totalFilteredItems, totalPages, pinnedItems: pinned };
}

// ── 렌더링 (전체 조율) ─────────────────────────────
function render() {
  const { pageItems, totalItems, totalFilteredItems, totalPages, pinnedItems } = computeResults();
  renderCount(totalFilteredItems, totalPages);
  renderActiveFilters();
  renderList(pageItems, totalItems, pinnedItems.length);
  renderPagination(totalPages, totalItems);
  renderPinnedPanel(pinnedItems);
}

// ── 결과 건수 ──────────────────────────────────────
// totalFilteredItems: pinned + regular 합계 (카운트 표시 기준)
// totalPages: regular pagination 기준
function renderCount(totalFilteredItems, totalPages) {
  const countEl = document.getElementById('result-count');
  if (totalFilteredItems === 0) {
    countEl.textContent = '총 0건';
  } else {
    countEl.textContent = `총 ${totalFilteredItems}건 · ${totalPages}페이지`;
  }
}

// ── 조건 칩 ───────────────────────────────────────
function renderActiveFilters() {
  const container = document.getElementById('active-filters');
  container.innerHTML = '';

  const chips = [];

  // 검색어 칩
  if (state.keyword) {
    chips.push(
      createChip(`검색어: ${state.keyword}`, () => {
        document.getElementById('search-input').value = '';
        update({ keyword: '' });
      }, `'검색어: ${state.keyword}' 조건 해제`)
    );
  }

  // 주제 칩 (선택된 주제마다 개별 칩)
  state.topics.forEach((id) => {
    const topic = topicMap.get(id);
    if (!topic) return;
    chips.push(
      createChip(`주제: ${topic.label}`, () => {
        update({ topics: state.topics.filter((t) => t !== id) });
      }, `'${topic.label}' 주제 조건 해제`)
    );
  });

  // 출처 칩 (선택된 출처마다 개별 칩)
  state.sourceIds.forEach((id) => {
    const source = sourceMap.get(id);
    chips.push(
      createChip(source.label, () => {
        update({ sourceIds: state.sourceIds.filter((s) => s !== id) });
      }, `'${source.label}' 출처 조건 해제`)
    );
  });

  // 기간 칩
  if (state.period !== 'all') {
    const periodLabel = getPeriodChipLabel();
    chips.push(
      createChip(periodLabel, () => {
        update({ period: 'all', customFrom: '', customTo: '' });
      }, `'${periodLabel}' 기간 조건 해제`)
    );
  }

  chips.forEach((chip) => container.appendChild(chip));

  // 1m/3m/1y 기간 적용 중일 때 실제 날짜 범위 표시 (custom은 칩에 이미 포함)
  if (state.period !== 'all' && state.period !== 'custom') {
    const range = getPeriodDisplayRange(state.period, SNAPSHOT_REFERENCE_DATE);
    if (range) {
      const rangeEl = document.createElement('span');
      rangeEl.className = 'active-filter__period-range';
      rangeEl.textContent = `적용 기간 ${range.from.replace(/-/g, '.')} ~ ${range.to.replace(/-/g, '.')}`;
      container.appendChild(rangeEl);
    }
  }

  // 초기화 버튼 (조건이 하나라도 있을 때만 표시)
  if (chips.length > 0) {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn-reset-all';
    resetBtn.textContent = '모든 조건 초기화';
    resetBtn.addEventListener('click', resetAll);
    container.appendChild(resetBtn);
  }
}

// 기간 조건에 표시할 라벨 (직접 설정일 때 날짜 범위 포함, 오류 시 범위 생략)
function getPeriodChipLabel() {
  if (state.period !== 'custom') {
    return PERIOD_OPTIONS.find((o) => o.value === state.period)?.label ?? '';
  }
  if (hasDateRangeError()) return '직접 설정';  // 무효 범위: 날짜 표시 생략
  const from = state.customFrom ? state.customFrom.replace(/-/g, '.') : '';
  const to   = state.customTo   ? state.customTo.replace(/-/g, '.')   : '';
  if (from && to) return `기간: ${from} ~ ${to}`;
  if (from)       return `기간: ${from} ~`;
  if (to)         return `기간: ~ ${to}`;
  return '직접 설정';
}

function createChip(label, onRemove, ariaLabel) {
  const chip = document.createElement('span');
  chip.className = 'chip';

  const textSpan = document.createElement('span');
  textSpan.textContent = label;
  chip.appendChild(textSpan);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'chip__remove';
  removeBtn.setAttribute('aria-label', ariaLabel);
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', onRemove);
  chip.appendChild(removeBtn);

  return chip;
}

// ── 게시물 목록 ────────────────────────────────────
function renderList(pageItems, totalItems, pinnedCount = 0) {
  const listEl  = document.getElementById('item-list');
  const emptyEl = document.getElementById('empty-state');

  // 열 수에 따라 CSS 클래스 적용
  listEl.className = 'item-list';
  if (state.cols === 2) listEl.classList.add('item-list--cols-2');
  else if (state.cols === 3) listEl.classList.add('item-list--cols-3');

  const stateType = getEmptyStateType(totalItems, pinnedCount);

  if (stateType === 'list') {
    listEl.hidden = false;
    emptyEl.hidden = true;
    listEl.innerHTML = '';
    groupItemsByMonth(pageItems).forEach(({ label, items }) => {
      const sepLi = document.createElement('li');
      sepLi.className = 'item-list__month-sep';
      const sepSpan = document.createElement('span');
      sepSpan.className = 'month-sep__label';
      sepSpan.textContent = label;
      sepLi.appendChild(sepSpan);
      listEl.appendChild(sepLi);
      items.forEach((item) => listEl.appendChild(createCard(item)));
    });
  } else {
    listEl.hidden = true;
    emptyEl.hidden = false;
    if (stateType === 'pinned-only') {
      renderPinnedOnlyState();
    } else {
      renderEmptyState();
    }
  }
}

function createCard(item) {
  const topic = topicMap.get(item.topic);

  const li = document.createElement('li');
  const article = document.createElement('article');
  article.className = 'item-card';

  const titleH2 = document.createElement('h2');
  titleH2.className = 'item-card__title';
  const titleLink = document.createElement('a');
  titleLink.href = `#/item/${item.id}`;
  titleLink.textContent = item.title;
  titleH2.appendChild(titleLink);

  const headerRow = document.createElement('div');
  headerRow.className = 'item-card__header';

  // 1. 원본 출처 badge(들) — sourceEntries 기준, 없으면 단일 sourceId로 대체
  const entries = (item.sourceEntries && item.sourceEntries.length)
    ? item.sourceEntries
    : [{ sourceId: item.sourceId, source: item.source }];
  entries.forEach((entry) => {
    const src = sourceMap.get(entry.sourceId);
    const badge = document.createElement('span');
    badge.className = `source-badge source-badge--${entry.sourceId}`;
    badge.textContent = src?.label ?? entry.source;
    headerRow.appendChild(badge);
  });

  // 2. 주제 badge
  if (topic) {
    const topicBadge = document.createElement('span');
    topicBadge.className = 'topic-badge';
    topicBadge.textContent = topic.label;
    headerRow.appendChild(topicBadge);
  }

  // 3. 작성일
  const dateEl = document.createElement('time');
  dateEl.className = 'item-card__date';
  dateEl.dateTime = item.postedAt;
  dateEl.textContent = item.postedAt.replace(/-/g, '.');
  headerRow.appendChild(dateEl);

  // summary
  const summaryP = document.createElement('p');
  summaryP.className = 'item-card__summary';
  summaryP.textContent = item.summary;

  // 작성자/기관: 동일하면 한 번만 표시, "작성" 접두사
  const deptText = item.organization ?? item.author ?? '';
  const deptP = document.createElement('p');
  deptP.className = 'item-card__dept';
  if (deptText) {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'item-card__dept-label';
    labelSpan.textContent = '작성';
    deptP.appendChild(labelSpan);
    deptP.appendChild(document.createTextNode(` ${deptText}`));
  }

  article.appendChild(titleH2);
  article.appendChild(headerRow);
  article.appendChild(summaryP);
  if (deptText) article.appendChild(deptP);
  li.appendChild(article);
  return li;
}

// ── 결과 없음 복구 UI (P06 · F7) ──────────────────
function renderEmptyState() {
  const container = document.getElementById('empty-state');
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.className = 'empty-state__title';
  heading.textContent = '검색 결과가 없습니다.';
  container.appendChild(heading);

  const hasKeyword = !!state.keyword;
  const hasSource  = state.sourceIds.length > 0;
  const hasPeriod  = state.period !== 'all';

  if (hasKeyword || hasSource || hasPeriod) {
    const condDl = document.createElement('dl');
    condDl.className = 'empty-state__conditions';

    const addRow = (term, detail) => {
      const wrap = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = `${term}:`;
      const dd = document.createElement('dd');
      dd.textContent = detail;
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      condDl.appendChild(wrap);
    };

    if (hasKeyword) addRow('검색어', state.keyword);
    if (hasSource)  addRow('출처', state.sourceIds.map((id) => sourceMap.get(id)?.label ?? id).join(', '));
    if (hasPeriod)  addRow('기간', getPeriodChipLabel());

    container.appendChild(condDl);
  }

  const actions = document.createElement('div');
  actions.className = 'empty-state__actions';

  // A. 기간 조건 해제
  if (hasPeriod) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-recovery';
    btn.textContent = '기간 조건 해제';
    btn.addEventListener('click', () => update({ period: 'all', customFrom: '', customTo: '' }));
    actions.appendChild(btn);
  }

  // B. 전체 출처에서 다시 찾기
  if (hasSource) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-recovery';
    btn.textContent = '전체 출처에서 다시 찾기';
    btn.addEventListener('click', () => update({ sourceIds: [] }));
    actions.appendChild(btn);
  }

  // C. 모든 조건 초기화 (항상)
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn-recovery btn-recovery--reset';
  resetBtn.textContent = '모든 조건 초기화';
  resetBtn.addEventListener('click', resetAll);
  actions.appendChild(resetBtn);

  container.appendChild(actions);
}

// ── 고정 게시글에만 결과가 있을 때 안내 (P20) ─────
function renderPinnedOnlyState() {
  const container = document.getElementById('empty-state');
  container.innerHTML = '';

  const heading = document.createElement('h2');
  heading.className = 'empty-state__title';
  heading.textContent = '검색 결과가 고정 게시글에 있습니다.';
  container.appendChild(heading);

  const desc = document.createElement('p');
  desc.className = 'empty-state__desc';
  desc.textContent = '오른쪽 고정 게시글 영역에서 확인해 주세요.';
  container.appendChild(desc);
}

// ── 고정 게시글 패널 (P16/P18) ───────────────────
function renderPinnedPanel(pinnedItems) {
  const panel = document.getElementById('pinned-panel');
  if (!panel) return;

  if (!pinnedItems || !pinnedItems.length) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  panel.innerHTML = '';

  // 헤더 (제목 + 접기/펼치기 버튼)
  const header = document.createElement('div');
  header.className = 'pinned-panel__header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'pinned-panel__title';
  titleEl.textContent = '고정 게시글';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'pinned-panel__toggle';
  toggleBtn.setAttribute('aria-controls', 'pinned-panel-body');
  toggleBtn.setAttribute('aria-expanded', pinnedPanelCollapsed ? 'false' : 'true');
  toggleBtn.setAttribute('aria-label', pinnedPanelCollapsed ? '고정 게시글 펼치기' : '고정 게시글 접기');
  toggleBtn.textContent = pinnedPanelCollapsed ? '펼치기 ▼' : '접기 ▲';
  toggleBtn.addEventListener('click', () => {
    pinnedPanelCollapsed = !pinnedPanelCollapsed;
    renderPinnedPanel(pinnedItems);
  });

  header.appendChild(titleEl);
  header.appendChild(toggleBtn);
  panel.appendChild(header);

  // 본문 (카드 목록)
  const body = document.createElement('div');
  body.id = 'pinned-panel-body';
  body.className = 'pinned-panel__body';
  body.hidden = pinnedPanelCollapsed;

  const displayItems = pinnedItems.slice(0, 5);
  displayItems.forEach((item) => {
    const topic = topicMap.get(item.topic);

    const card = document.createElement('article');
    card.className = 'pinned-card';

    const titleLink = document.createElement('a');
    titleLink.href = `#/item/${item.id}`;
    titleLink.className = 'pinned-card__title';
    titleLink.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'pinned-card__meta';

    // 1. 원본 출처 배지(들)
    const pinnedEntries = (item.sourceEntries && item.sourceEntries.length)
      ? item.sourceEntries
      : [{ sourceId: item.sourceId, source: item.source }];
    pinnedEntries.forEach((entry) => {
      const src = sourceMap.get(entry.sourceId);
      const badge = document.createElement('span');
      badge.className = `source-badge source-badge--${entry.sourceId}`;
      badge.textContent = src?.label ?? entry.source;
      meta.appendChild(badge);
    });

    // 2. 주제 배지
    if (topic) {
      const topicBadge = document.createElement('span');
      topicBadge.className = 'topic-badge';
      topicBadge.textContent = topic.label;
      meta.appendChild(topicBadge);
    }

    // 3. 게시일
    const dateEl = document.createElement('time');
    dateEl.dateTime = item.postedAt;
    dateEl.textContent = item.postedAt.replace(/-/g, '.');
    meta.appendChild(dateEl);

    card.appendChild(titleLink);
    card.appendChild(meta);
    body.appendChild(card);
  });

  if (pinnedItems.length > 5) {
    const moreEl = document.createElement('p');
    moreEl.className = 'pinned-panel__more';
    moreEl.textContent = `외 ${pinnedItems.length - 5}건`;
    body.appendChild(moreEl);
  }

  panel.appendChild(body);
}

// ── 페이지네이션 ───────────────────────────────────
function renderPagination(totalPages, totalItems) {
  const nav     = document.getElementById('pagination');
  const jumpDiv = document.getElementById('pagination-jump');

  if (totalItems === 0) {
    nav.hidden = true;
    if (jumpDiv) jumpDiv.hidden = true;
    return;
  }
  nav.hidden = false;
  nav.innerHTML = '';

  // 10페이지 이전 버튼 (P11)
  const prevTenBtn = document.createElement('button');
  prevTenBtn.type = 'button';
  prevTenBtn.className = 'pagination__btn pagination__btn--skip';
  prevTenBtn.textContent = '10페이지 이전';
  prevTenBtn.disabled = state.page - 10 < 1;
  prevTenBtn.addEventListener('click', () => goToPage(state.page - 10));
  nav.appendChild(prevTenBtn);

  // 이전 버튼
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'pagination__btn';
  prevBtn.textContent = '이전';
  prevBtn.disabled = state.page === 1;
  prevBtn.addEventListener('click', () => goToPage(state.page - 1));
  nav.appendChild(prevBtn);

  // 페이지 번호 목록 (10개 단위 그룹만 표시)
  const pageList = document.createElement('ol');
  pageList.className = 'pagination__pages';

  getVisiblePageRange(state.page, totalPages).forEach((i) => {
    const li  = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pagination__page-btn';
    btn.textContent = String(i);
    btn.setAttribute('aria-label', `${i} 페이지`);
    if (i === state.page) {
      btn.classList.add('is-current');
      btn.setAttribute('aria-current', 'page');
    }
    const page = i;
    btn.addEventListener('click', () => goToPage(page));
    li.appendChild(btn);
    pageList.appendChild(li);
  });

  nav.appendChild(pageList);

  // 다음 버튼
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'pagination__btn';
  nextBtn.textContent = '다음';
  nextBtn.disabled = state.page === totalPages;
  nextBtn.addEventListener('click', () => goToPage(state.page + 1));
  nav.appendChild(nextBtn);

  // 10페이지 다음 버튼 (P11)
  const nextTenBtn = document.createElement('button');
  nextTenBtn.type = 'button';
  nextTenBtn.className = 'pagination__btn pagination__btn--skip';
  nextTenBtn.textContent = '10페이지 다음';
  nextTenBtn.disabled = state.page + 10 > totalPages;
  nextTenBtn.addEventListener('click', () => goToPage(state.page + 10));
  nav.appendChild(nextTenBtn);

  // 페이지 직접 이동 (P11, 2페이지 이상일 때)
  if (jumpDiv) {
    if (totalPages > 1) {
      jumpDiv.hidden = false;
      jumpDiv.innerHTML = '';

      const jumpLabel = document.createElement('label');
      jumpLabel.className = 'pagination-jump__label';
      jumpLabel.htmlFor = 'page-jump-input';
      jumpLabel.textContent = '페이지 직접 이동:';

      const jumpInput = document.createElement('input');
      jumpInput.type = 'number';
      jumpInput.id   = 'page-jump-input';
      jumpInput.className = 'pagination-jump__input';
      jumpInput.min  = '1';
      jumpInput.max  = String(totalPages);
      jumpInput.setAttribute('aria-label', `페이지 번호 입력, 1에서 ${totalPages} 사이`);

      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'pagination-jump__btn';
      jumpBtn.textContent = '이동';

      const errorEl = document.createElement('span');
      errorEl.className = 'pagination-jump__error';
      errorEl.setAttribute('aria-live', 'polite');
      errorEl.setAttribute('role', 'alert');

      jumpBtn.addEventListener('click', () => handlePageJump(jumpInput, totalPages, errorEl));
      jumpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handlePageJump(jumpInput, totalPages, errorEl);
      });

      jumpDiv.appendChild(jumpLabel);
      jumpDiv.appendChild(jumpInput);
      jumpDiv.appendChild(jumpBtn);
      jumpDiv.appendChild(errorEl);
    } else {
      jumpDiv.hidden = true;
    }
  }
}

function handlePageJump(input, totalPages, errorEl) {
  const val = parseInt(input.value, 10);
  errorEl.textContent = '';
  if (!Number.isFinite(val) || val < 1 || val > totalPages) {
    errorEl.textContent = `1~${totalPages} 사이의 페이지 번호를 입력해 주세요.`;
    return;
  }
  goToPage(val);
}

function goToPage(page) {
  const { totalPages } = computeResults();
  if (page < 1 || page > totalPages) return;
  state.page = page;
  replaceHash(serializeListState(state));
  render();

  const heading = document.getElementById('list-heading');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  heading.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
  heading.focus();
}

// ── 상세 화면 렌더링 (F5) ──────────────────────────
function renderDetail(item) {
  const container = document.getElementById('detail-view');
  container.innerHTML = '';

  const topic  = topicMap.get(item.topic);

  // 돌아가기 링크
  const backLink = document.createElement('a');
  backLink.href = detailBackHash;
  backLink.className = 'detail-back';
  backLink.textContent = '← 검색 결과로 돌아가기';

  const article = document.createElement('article');
  article.className = 'detail-article';

  // 메타 행 (원본 출처 배지들, 주제, 게시일)
  const metaRow = document.createElement('div');
  metaRow.className = 'detail-meta';

  // 1. 원본 출처 배지(들) — sourceEntries 우선
  const entries = (item.sourceEntries && item.sourceEntries.length)
    ? item.sourceEntries
    : [{ sourceId: item.sourceId, source: item.source }];
  entries.forEach((entry) => {
    const src = sourceMap.get(entry.sourceId);
    const badge = document.createElement('span');
    badge.className = `source-badge source-badge--${entry.sourceId}`;
    badge.textContent = src?.label ?? entry.source;
    metaRow.appendChild(badge);
  });

  // 2. 주제 배지
  if (topic) {
    const topicBadge = document.createElement('span');
    topicBadge.className = 'topic-badge';
    topicBadge.textContent = topic.label;
    metaRow.appendChild(topicBadge);
  }

  // 3. 게시일
  const dateEl = document.createElement('time');
  dateEl.className = 'detail-date';
  dateEl.dateTime = item.postedAt;
  dateEl.textContent = item.postedAt.replace(/-/g, '.');

  metaRow.appendChild(dateEl);

  // 제목 (h1, 화면 전환 시 포커스 대상)
  const heading = document.createElement('h1');
  heading.id = 'detail-heading';
  heading.className = 'detail-heading';
  heading.tabIndex = -1;
  heading.textContent = item.title;

  // 게시 부서
  const deptEl = document.createElement('p');
  deptEl.className = 'detail-dept';
  deptEl.textContent = item.organization;

  // 본문 (빈 줄로 구분된 단락)
  const bodyEl = document.createElement('div');
  bodyEl.className = 'detail-body';
  item.body.split('\n\n').forEach((para) => {
    const p = document.createElement('p');
    p.textContent = para;
    bodyEl.appendChild(p);
  });

  article.appendChild(metaRow);
  article.appendChild(heading);
  article.appendChild(deptEl);
  article.appendChild(bodyEl);

  // 첨부 파일 수 표시 (다운로드는 원문에서 — CLAUDE.md 0절 P15 예외)
  if (item.attachmentCount != null && item.attachmentCount > 0) {
    const attachSection = document.createElement('section');
    attachSection.className = 'detail-attachments';

    const attachHeading = document.createElement('h2');
    attachHeading.className = 'detail-section-title';
    attachHeading.textContent = '첨부 파일';
    attachSection.appendChild(attachHeading);

    const attachNote = document.createElement('p');
    attachNote.className = 'detail-attach-note';
    attachNote.textContent = `첨부파일 ${item.attachmentCount}개 — 원문에서 확인하세요`;
    attachSection.appendChild(attachNote);
    article.appendChild(attachSection);
  }

  // 원문 보기 — sourceEntries 우선, 없으면 최상위 originalUrl fallback (getOriginalLinks)
  const urlEntries = getOriginalLinks(item);

  if (urlEntries.length) {
    const originalDiv = document.createElement('div');
    originalDiv.className = 'detail-original';
    urlEntries.forEach((entry) => {
      const src = sourceMap.get(entry.sourceId);
      const originalLink = document.createElement('a');
      originalLink.href = entry.originalUrl;
      originalLink.target = '_blank';
      originalLink.rel = 'noopener noreferrer';
      originalLink.className = 'btn-original';
      originalLink.textContent = urlEntries.length > 1
        ? `원문 보기 (${src?.label ?? entry.source})`
        : '원문 보기';
      originalDiv.appendChild(originalLink);
    });
    article.appendChild(originalDiv);
  }

  container.appendChild(backLink);
  container.appendChild(article);
}

// ── 없는 게시물 오류 화면 (P06 · F7) ─────────────
function showNotFound() {
  document.getElementById('list-view').hidden = true;
  document.getElementById('detail-view').hidden = false;
  renderNotFound();
  document.getElementById('detail-heading').focus();
}

function renderNotFound() {
  const container = document.getElementById('detail-view');
  container.innerHTML = '';

  const backLink = document.createElement('a');
  backLink.href = detailBackHash;
  backLink.className = 'detail-back';
  backLink.textContent =
    detailBackHash !== '#/'
      ? '← 검색 결과로 돌아가기'
      : '← 통합 목록으로 돌아가기';

  const article = document.createElement('article');
  article.className = 'detail-article';

  const heading = document.createElement('h1');
  heading.id = 'detail-heading';
  heading.className = 'detail-heading';
  heading.tabIndex = -1;
  heading.textContent = '게시물을 찾을 수 없습니다.';

  const desc = document.createElement('p');
  desc.className = 'not-found__desc';
  desc.textContent = '요청한 주소의 게시물이 샘플 데이터에 존재하지 않습니다.';

  article.appendChild(heading);
  article.appendChild(desc);
  container.appendChild(backLink);
  container.appendChild(article);
}

// ── 주제 필터 초기화 ───────────────────────────────
function initTopicFilter() {
  const topicList = document.getElementById('topic-filter-list');
  if (!topicList) return;
  TOPICS.forEach((topic) => {
    const li    = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'filter-item__label';

    const checkbox = document.createElement('input');
    checkbox.type  = 'checkbox';
    checkbox.className = 'filter-item__checkbox';
    checkbox.id    = `topic-${topic.id}`;
    checkbox.value = topic.id;
    checkbox.addEventListener('change', () => {
      const checked = [
        ...document.querySelectorAll('#topic-filter-list input:checked'),
      ].map((el) => el.value);
      update({ topics: checked });
    });

    const nameSpan = document.createElement('span');
    nameSpan.textContent = topic.label;

    const countSpan = document.createElement('span');
    countSpan.className = 'filter-item__count';
    countSpan.textContent = `(${topicCountMap.get(topic.id) ?? 0})`;

    label.appendChild(checkbox);
    label.appendChild(nameSpan);
    label.appendChild(countSpan);
    li.appendChild(label);
    topicList.appendChild(li);
  });
}

// ── 필터 UI 초기화 (한 번만 실행) ──────────────────
function initFilters() {
  // 주제 체크박스
  initTopicFilter();

  // 출처 체크박스
  const sourceList = document.getElementById('source-filter-list');
  SOURCES.forEach((source) => {
    const li    = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'filter-item__label';

    const checkbox = document.createElement('input');
    checkbox.type  = 'checkbox';
    checkbox.className = 'filter-item__checkbox';
    checkbox.id    = `source-${source.id}`;
    checkbox.value = source.id;
    checkbox.addEventListener('change', () => {
      const checked = [
        ...document.querySelectorAll('#source-filter-list input:checked'),
      ].map((el) => el.value);
      update({ sourceIds: checked });
    });

    // 배지: 색 차이를 시각적으로 제공, aria-hidden으로 AT 중복 읽기 방지
    const badge = document.createElement('span');
    badge.className = `source-badge source-badge--${source.id}`;
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = source.label;

    // 텍스트 라벨: 접근성 이름 제공 (색만으로 구분 금지, CLAUDE.md 5절)
    const nameSpan = document.createElement('span');
    nameSpan.textContent = source.label;

    const countSpan = document.createElement('span');
    countSpan.className = 'filter-item__count';
    countSpan.textContent = `(${sourceCountMap.get(source.id)})`;

    label.appendChild(checkbox);
    label.appendChild(badge);
    label.appendChild(nameSpan);
    label.appendChild(countSpan);
    li.appendChild(label);
    sourceList.appendChild(li);
  });

  // 기간 라디오 버튼 (날짜 범위 표시 포함)
  const periodList = document.getElementById('period-filter-list');
  PERIOD_OPTIONS.forEach(({ value, label }) => {
    const li      = document.createElement('li');
    const labelEl = document.createElement('label');
    labelEl.className = 'filter-item__label';

    const radio = document.createElement('input');
    radio.type  = 'radio';
    radio.className = 'filter-item__radio';
    radio.id    = `period-${value}`;
    radio.name  = 'period';
    radio.value = value;
    radio.checked = value === 'all';
    radio.addEventListener('change', () => {
      if (radio.checked) {
        if (radio.value === 'custom') {
          // 직접 설정 선택 시: 현재 적용 날짜로 드래프트 초기화, 패널 접기
          draftFrom = state.customFrom;
          draftTo   = state.customTo;
          const innerPanel = document.getElementById('custom-date-inner');
          const toggleBtn  = document.getElementById('custom-date-toggle');
          if (innerPanel && toggleBtn) {
            innerPanel.hidden = true;
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.textContent = '날짜 범위 설정 ▸';
          }
        }
        update({ period: radio.value });
      }
    });

    const nameSpan = document.createElement('span');
    nameSpan.textContent = label;

    labelEl.appendChild(radio);
    labelEl.appendChild(nameSpan);
    li.appendChild(labelEl);
    periodList.appendChild(li);
  });

  // 직접 설정 패널 (접기/펼치기 + 드래프트 → 적용 흐름)
  const periodFieldset = periodList.closest('fieldset');
  const customPanel    = document.createElement('div');
  customPanel.className = 'custom-date-panel';
  customPanel.id  = 'custom-date-panel';
  customPanel.hidden = true;

  // 토글 버튼
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'custom-date-toggle';
  toggleBtn.id = 'custom-date-toggle';
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.setAttribute('aria-controls', 'custom-date-inner');
  toggleBtn.textContent = '날짜 범위 설정 ▸';

  // 내부 패널 (날짜 입력 + 버튼)
  const innerPanel = document.createElement('div');
  innerPanel.id = 'custom-date-inner';
  innerPanel.className = 'custom-date-inner';
  innerPanel.hidden = true;

  const makeRow = (labelText, inputId) => {
    const row   = document.createElement('div');
    row.className = 'custom-date-range__row';
    const lbl   = document.createElement('label');
    lbl.className   = 'custom-date-range__label';
    lbl.htmlFor     = inputId;
    lbl.textContent = labelText;
    const input = document.createElement('input');
    input.type  = 'date';
    input.id    = inputId;
    input.className = 'custom-date-range__input';
    input.setAttribute('aria-describedby', 'date-range-error');
    // 입력 변경은 드래프트만 업데이트 — 결과는 "기간 적용" 버튼으로만 변경됨
    input.addEventListener('change', () => {
      if (inputId === 'date-from') draftFrom = input.value;
      else                         draftTo   = input.value;
      syncDraftError();
    });
    row.appendChild(lbl);
    row.appendChild(input);
    return row;
  };

  innerPanel.appendChild(makeRow('시작일', 'date-from'));
  innerPanel.appendChild(makeRow('종료일', 'date-to'));

  const dateErrorEl = document.createElement('p');
  dateErrorEl.id = 'date-range-error';
  dateErrorEl.className = 'custom-date-range__error';
  dateErrorEl.setAttribute('aria-live', 'polite');
  dateErrorEl.setAttribute('role', 'alert');
  innerPanel.appendChild(dateErrorEl);

  const dateActionRow = document.createElement('div');
  dateActionRow.className = 'custom-date-actions';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'custom-date-apply';
  applyBtn.textContent = '기간 적용';
  applyBtn.addEventListener('click', () => {
    if (!isValidDateRange(draftFrom, draftTo)) {
      syncDraftError();
      return;
    }
    update({ customFrom: draftFrom, customTo: draftTo });
  });

  const resetDateBtn = document.createElement('button');
  resetDateBtn.type = 'button';
  resetDateBtn.className = 'custom-date-reset';
  resetDateBtn.textContent = '초기화';
  resetDateBtn.addEventListener('click', () => {
    draftFrom = '';
    draftTo   = '';
    update({ customFrom: '', customTo: '' });
  });

  dateActionRow.appendChild(applyBtn);
  dateActionRow.appendChild(resetDateBtn);
  innerPanel.appendChild(dateActionRow);

  toggleBtn.addEventListener('click', () => {
    const willExpand = innerPanel.hidden;
    innerPanel.hidden = !willExpand;
    toggleBtn.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
    toggleBtn.textContent = willExpand ? '날짜 범위 설정 ▾' : '날짜 범위 설정 ▸';
  });

  customPanel.appendChild(toggleBtn);
  customPanel.appendChild(innerPanel);
  periodFieldset.appendChild(customPanel);
}

// 열 수를 나타내는 인라인 SVG 아이콘 (aria-hidden — 버튼의 aria-label이 접근성 이름 제공)
function getColsIcon(cols) {
  if (cols === 1) {
    return '<svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="14" height="4" rx="1"/><rect x="1" y="8" width="14" height="4" rx="1"/></svg>';
  }
  if (cols === 2) {
    return '<svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="6" height="4" rx="1"/><rect x="9" y="1" width="6" height="4" rx="1"/><rect x="1" y="8" width="6" height="4" rx="1"/><rect x="9" y="8" width="6" height="4" rx="1"/></svg>';
  }
  return '<svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="4" height="4" rx="1"/><rect x="6" y="1" width="4" height="4" rx="1"/><rect x="11" y="1" width="4" height="4" rx="1"/><rect x="1" y="8" width="4" height="4" rx="1"/><rect x="6" y="8" width="4" height="4" rx="1"/><rect x="11" y="8" width="4" height="4" rx="1"/></svg>';
}

// ── 정렬 · 보기 방식 컨트롤 초기화 ──────────────────
function initSortAndViewControls() {
  // 정렬 선택
  const sortContainer = document.getElementById('sort-control');
  if (sortContainer) {
    const sortLabel = document.createElement('label');
    sortLabel.className  = 'list-sort-label';
    sortLabel.htmlFor    = 'sort-select';
    sortLabel.textContent = '정렬:';

    const sortSelect = document.createElement('select');
    sortSelect.id = 'sort-select';
    sortSelect.className = 'list-sort-select';
    SORT_OPTIONS.forEach(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      sortSelect.appendChild(option);
    });
    sortSelect.value = state.sort;
    sortSelect.addEventListener('change', () => update({ sort: sortSelect.value }));

    sortContainer.appendChild(sortLabel);
    sortContainer.appendChild(sortSelect);
  }

  // 열 수 선택 (SVG 아이콘 버튼)
  const viewContainer = document.getElementById('view-toggle');
  if (viewContainer) {
    // 그룹 전체의 가시적 레이블 ("보기") — aria-labelledby로 연결
    const viewLabel = document.createElement('span');
    viewLabel.className = 'list-view-label';
    viewLabel.id = 'view-toggle-label';
    viewLabel.textContent = '보기';
    viewContainer.appendChild(viewLabel);
    viewContainer.setAttribute('aria-labelledby', 'view-toggle-label');
    viewContainer.removeAttribute('aria-label');

    [1, 2, 3].forEach((cols) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'view-toggle-btn';
      btn.dataset.cols = String(cols);
      btn.setAttribute('aria-label', `${cols}열 보기`);
      btn.setAttribute('title', `${cols}열 보기`);
      btn.setAttribute('aria-pressed', state.cols === cols ? 'true' : 'false');
      if (state.cols === cols) btn.classList.add('is-active');
      btn.innerHTML = getColsIcon(cols);
      btn.addEventListener('click', () => update({ cols }));
      viewContainer.appendChild(btn);
    });
  }
}

// 상태 변경 후 필터 UI 동기화 (필터 컨트롤을 재렌더링하지 않고 상태만 갱신)
function syncFilterUI() {
  document.querySelectorAll('#topic-filter-list input[type="checkbox"]').forEach((cb) => {
    cb.checked = state.topics.includes(cb.value);
  });
  document.querySelectorAll('#source-filter-list input[type="checkbox"]').forEach((cb) => {
    cb.checked = state.sourceIds.includes(cb.value);
  });
  document.querySelectorAll('#period-filter-list input[type="radio"]').forEach((rb) => {
    rb.checked = rb.value === state.period;
  });

  // 직접 설정 패널 표시/숨김, 드래프트 값 동기화
  const customPanel = document.getElementById('custom-date-panel');
  if (customPanel) {
    customPanel.hidden = state.period !== 'custom';
    if (state.period === 'custom') {
      const fromInput = document.getElementById('date-from');
      const toInput   = document.getElementById('date-to');
      if (fromInput) fromInput.value = draftFrom;
      if (toInput)   toInput.value   = draftTo;
      syncDraftError();
      // 적용된 날짜가 있으면 패널 자동 펼침
      if (state.customFrom || state.customTo) {
        const innerPanel = document.getElementById('custom-date-inner');
        const tBtn       = document.getElementById('custom-date-toggle');
        if (innerPanel && tBtn && innerPanel.hidden) {
          innerPanel.hidden = false;
          tBtn.setAttribute('aria-expanded', 'true');
          tBtn.textContent = '날짜 범위 설정 ▾';
        }
      }
    }
  }

  // 정렬 선택
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = state.sort;

  // 열 수 선택 버튼
  document.querySelectorAll('.view-toggle-btn').forEach((btn) => {
    const btnCols = parseInt(btn.dataset.cols, 10);
    const active  = state.cols === btnCols;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

// ── 자동완성 (P14) ────────────────────────────────
let suggestionActiveIdx = -1;

function computeSuggestions(keyword) {
  const { filtered } = (() => {
    const filterState = hasDateRangeError()
      ? { ...state, customFrom: '', customTo: '' }
      : state;
    return { filtered: applyFilters(ITEMS, filterState, SNAPSHOT_REFERENCE_DATE) };
  })();
  return getSuggestions(filtered, keyword);
}

function highlightKeyword(title, keyword) {
  const q = keyword.trim();
  if (!q) return document.createTextNode(title);
  const idx = title.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return document.createTextNode(title);
  const frag = document.createDocumentFragment();
  frag.appendChild(document.createTextNode(title.slice(0, idx)));
  const mark = document.createElement('mark');
  mark.textContent = title.slice(idx, idx + q.length);
  frag.appendChild(mark);
  frag.appendChild(document.createTextNode(title.slice(idx + q.length)));
  return frag;
}

function renderSuggestions(suggestions, keyword) {
  const list  = document.getElementById('suggestion-list');
  const input = document.getElementById('search-input');
  if (!list || !input) return;
  list.innerHTML = '';
  suggestionActiveIdx = -1;

  if (!suggestions.length) {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    return;
  }

  suggestions.forEach((item, idx) => {
    const li = document.createElement('li');
    li.role = 'option';
    li.id = `suggestion-item-${idx}`;
    li.className = 'suggestion-item';
    li.setAttribute('aria-selected', 'false');

    const titleSpan = document.createElement('span');
    titleSpan.className = 'suggestion-item__title';
    titleSpan.appendChild(highlightKeyword(item.title, keyword));

    const metaSpan = document.createElement('span');
    metaSpan.className = 'suggestion-item__meta';
    const suggEntries = (item.sourceEntries && item.sourceEntries.length)
      ? item.sourceEntries
      : [{ sourceId: item.sourceId, source: item.source }];
    const sourceLabels = suggEntries.map((e) => sourceMap.get(e.sourceId)?.label ?? e.source).join(' · ');
    const suggTopic = topicMap.get(item.topic);
    const metaParts = [sourceLabels];
    if (suggTopic) metaParts.push(suggTopic.label);
    metaParts.push(item.postedAt.replace(/-/g, '.'));
    metaSpan.textContent = metaParts.join(' · ');

    li.appendChild(titleSpan);
    li.appendChild(metaSpan);
    li.addEventListener('mousedown', (e) => {
      e.preventDefault(); // blur 방지
      clearSuggestions();
      location.hash = `#/item/${item.id}`;
    });
    list.appendChild(li);
  });

  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function updateSuggestionActive(idx) {
  const list  = document.getElementById('suggestion-list');
  const input = document.getElementById('search-input');
  if (!list) return;
  const items = list.querySelectorAll('.suggestion-item');
  items.forEach((el, i) => {
    const active = i === idx;
    el.classList.toggle('is-active', active);
    el.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  suggestionActiveIdx = idx;
  if (idx >= 0 && items[idx]) {
    input.setAttribute('aria-activedescendant', items[idx].id);
  } else {
    input.removeAttribute('aria-activedescendant');
  }
}

function clearSuggestions() {
  const list  = document.getElementById('suggestion-list');
  const input = document.getElementById('search-input');
  if (list)  { list.hidden = true; list.innerHTML = ''; }
  if (input) { input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
  suggestionActiveIdx = -1;
}

// ── 초기화 ─────────────────────────────────────────
function init() {
  // 샘플 기준일 배너에 반영
  const refEl = document.getElementById('sample-ref-date');
  if (refEl) refEl.textContent = SNAPSHOT_REFERENCE_DATE;

  // 검색 폼 제출 (Enter 또는 버튼 클릭)
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearSuggestions();
    const keyword = document.getElementById('search-input').value;
    update({ keyword });
  });

  // 자동완성 이벤트
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const keyword = searchInput.value;
      if (keyword.trim().length < 2) {
        clearSuggestions();
        return;
      }
      const suggestions = computeSuggestions(keyword);
      renderSuggestions(suggestions, keyword);
    });

    searchInput.addEventListener('keydown', (e) => {
      const list  = document.getElementById('suggestion-list');
      if (!list || list.hidden) return;
      const items = list.querySelectorAll('.suggestion-item');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(suggestionActiveIdx + 1, items.length - 1);
        updateSuggestionActive(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(suggestionActiveIdx - 1, -1);
        updateSuggestionActive(prev);
      } else if (e.key === 'Enter' && suggestionActiveIdx >= 0) {
        e.preventDefault();
        const activeItem = list.querySelectorAll('.suggestion-item')[suggestionActiveIdx];
        if (activeItem) activeItem.dispatchEvent(new MouseEvent('mousedown'));
      } else if (e.key === 'Escape') {
        clearSuggestions();
      }
    });

    searchInput.addEventListener('blur', () => {
      // 약간의 지연 후 닫음 — mousedown 핸들러가 먼저 실행되도록
      setTimeout(clearSuggestions, 150);
    });
  }

  // 필터 컨트롤 한 번만 렌더링
  initFilters();
  initSortAndViewControls();

  // 해시 변경: 카드 링크 클릭(목록→상세), 브라우저 뒤로/앞으로
  window.addEventListener('hashchange', (e) => {
    const oldHash = new URL(e.oldURL).hash || '#/';
    // 목록 화면에서 이탈할 때만 복귀 URL을 갱신한다
    if (parseHash(oldHash).view === 'list') {
      detailBackHash = oldHash;
    }
    route();
  });

  // 최초 라우팅 (URL 해시에서 초기 상태 복원)
  route();
}

init();
