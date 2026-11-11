import { SOURCES } from './data/sources.js';
import { ITEMS, SAMPLE_REFERENCE_DATE } from './data/items.js';
import { applyFilters, paginate, getTotalPages } from './search.js';
import { parseHash, serializeListState } from './state.js';

const PAGE_SIZE = 10;
const itemMap = new Map(ITEMS.map((i) => [i.id, i]));
const sourceMap = new Map(SOURCES.map((s) => [s.id, s]));

// 최신순 정렬 (ISO 날짜 문자열은 사전순 비교로 최신순 정렬이 된다)
const sortedItems = [...ITEMS].sort((a, b) =>
  b.postedAt.localeCompare(a.postedAt)
);

// 출처별 전체 게시물 수 (필터 항목 옆 카운트용)
const sourceCountMap = new Map(
  SOURCES.map((s) => [s.id, sortedItems.filter((i) => i.sourceId === s.id).length])
);

const PERIOD_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: '1m',  label: '최근 1개월' },
  { value: '3m',  label: '최근 3개월' },
  { value: '1y',  label: '최근 1년' },
];

// ── 애플리케이션 상태 ─────────────────────────────
let state = {
  keyword: '',
  sourceIds: [],   // 선택된 출처 ID 목록 (빈 배열 = 전체)
  period: 'all',
  page: 1,
};

// 상세 화면에서 "검색 결과로 돌아가기"의 목적지.
// 목록 → 상세로 이동할 때 hashchange 핸들러가 갱신한다.
let detailBackHash = '#/';

// 현재 표시 중인 화면. 상세 → 목록 전환 시 포커스 이동 판단에 사용한다 (CLAUDE.md 5절).
let currentView = null; // 'list' | 'detail' — null: 첫 로드

// ── URL 쓰기 ──────────────────────────────────────
function replaceHash(hash) {
  history.replaceState(null, '', hash);
}

// ── 상태 업데이트 ──────────────────────────────────
function update(changes) {
  const isFilterChange =
    'keyword' in changes || 'sourceIds' in changes || 'period' in changes;
  Object.assign(state, changes);
  if (isFilterChange) state.page = 1;
  replaceHash(serializeListState(state)); // 필터·검색 변경은 history에 쌓지 않음
  syncFilterUI();
  render();
}

function resetAll() {
  document.getElementById('search-input').value = '';
  update({ keyword: '', sourceIds: [], period: 'all', page: 1 });
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
      keyword: parsed.keyword,
      sourceIds: parsed.sourceIds,
      period: parsed.period,
      page: parsed.page,
    };
    document.getElementById('search-input').value = state.keyword;
    syncFilterUI();
    showListView();
    render();

    // 상세 → 목록 전환일 때만 포커스를 목록 제목으로 이동 (CLAUDE.md 5절)
    // 최초 로드나 필터 변경에서는 이동하지 않는다
    if (isFromDetail) {
      document.getElementById('list-heading').focus();
    }
  }
}

// ── 결과 계산 ──────────────────────────────────────
function computeResults() {
  const filtered = applyFilters(sortedItems, state, SAMPLE_REFERENCE_DATE);
  const totalItems = filtered.length;
  const totalPages = getTotalPages(totalItems, PAGE_SIZE);
  const safePage = Math.min(state.page, totalPages);
  const pageItems = paginate(filtered, safePage, PAGE_SIZE);
  return { pageItems, totalItems, totalPages };
}

// ── 렌더링 (전체 조율) ─────────────────────────────
function render() {
  const { pageItems, totalItems, totalPages } = computeResults();
  renderCount(totalItems);
  renderActiveFilters();
  renderList(pageItems, totalItems);
  renderPagination(totalPages, totalItems);
}

// ── 결과 건수 ──────────────────────────────────────
function renderCount(totalItems) {
  document.getElementById('result-count').textContent = `총 ${totalItems}건`;
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
    const periodLabel =
      PERIOD_OPTIONS.find((o) => o.value === state.period)?.label ?? '';
    chips.push(
      createChip(periodLabel, () => {
        update({ period: 'all' });
      }, `'${periodLabel}' 기간 조건 해제`)
    );
  }

  chips.forEach((chip) => container.appendChild(chip));

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
function renderList(pageItems, totalItems) {
  const listEl = document.getElementById('item-list');
  const emptyEl = document.getElementById('empty-state');

  if (totalItems === 0) {
    listEl.hidden = true;
    emptyEl.hidden = false;
    renderEmptyState();
  } else {
    listEl.hidden = false;
    emptyEl.hidden = true;
    listEl.innerHTML = '';
    pageItems.forEach((item) => listEl.appendChild(createCard(item)));
  }
}

function createCard(item) {
  const source = sourceMap.get(item.sourceId);

  const li = document.createElement('li');
  const article = document.createElement('article');
  article.className = 'item-card';

  const headerRow = document.createElement('div');
  headerRow.className = 'item-card__header';

  const badge = document.createElement('span');
  badge.className = `source-badge source-badge--${item.sourceId}`;
  badge.textContent = source.label;

  const dateEl = document.createElement('time');
  dateEl.className = 'item-card__date';
  dateEl.dateTime = item.postedAt;
  dateEl.textContent = item.postedAt.replace(/-/g, '.');

  headerRow.appendChild(badge);
  headerRow.appendChild(dateEl);

  const titleH2 = document.createElement('h2');
  titleH2.className = 'item-card__title';
  const titleLink = document.createElement('a');
  titleLink.href = `#/item/${item.id}`;
  titleLink.textContent = item.title;
  titleH2.appendChild(titleLink);

  const summaryP = document.createElement('p');
  summaryP.className = 'item-card__summary';
  summaryP.textContent = item.summary;

  const deptP = document.createElement('p');
  deptP.className = 'item-card__dept';
  deptP.textContent = item.department;

  article.appendChild(titleH2);
  article.appendChild(headerRow);
  article.appendChild(summaryP);
  article.appendChild(deptP);
  li.appendChild(article);
  return li;
}

// ── 결과 없음 복구 UI (P06 · F7) ──────────────────
function renderEmptyState() {
  const container = document.getElementById('empty-state');
  container.innerHTML = '';

  // 제목 (h2 — 목록 h1 아래 위계)
  const heading = document.createElement('h2');
  heading.className = 'empty-state__title';
  heading.textContent = '검색 결과가 없습니다.';
  container.appendChild(heading);

  const hasKeyword = !!state.keyword;
  const hasSource = state.sourceIds.length > 0;
  const hasPeriod = state.period !== 'all';

  // 현재 조건 요약
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
    if (hasSource) {
      addRow('출처', state.sourceIds.map((id) => sourceMap.get(id)?.label ?? id).join(', '));
    }
    if (hasPeriod) {
      addRow('기간', PERIOD_OPTIONS.find((o) => o.value === state.period)?.label ?? '');
    }

    container.appendChild(condDl);
  }

  // 복구 버튼
  const actions = document.createElement('div');
  actions.className = 'empty-state__actions';

  // A. 기간 조건 해제 (기간이 선택된 경우에만)
  if (hasPeriod) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-recovery';
    btn.textContent = '기간 조건 해제';
    btn.addEventListener('click', () => update({ period: 'all' }));
    actions.appendChild(btn);
  }

  // B. 전체 출처에서 다시 찾기 (출처가 선택된 경우에만)
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

// ── 페이지네이션 ───────────────────────────────────
function renderPagination(totalPages, totalItems) {
  const nav = document.getElementById('pagination');

  if (totalItems === 0) {
    nav.hidden = true;
    return;
  }
  nav.hidden = false;
  nav.innerHTML = '';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'pagination__btn';
  prevBtn.textContent = '이전';
  prevBtn.disabled = state.page === 1;
  prevBtn.addEventListener('click', () => goToPage(state.page - 1));
  nav.appendChild(prevBtn);

  const pageList = document.createElement('ol');
  pageList.className = 'pagination__pages';

  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement('li');
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
  }

  nav.appendChild(pageList);

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'pagination__btn';
  nextBtn.textContent = '다음';
  nextBtn.disabled = state.page === totalPages;
  nextBtn.addEventListener('click', () => goToPage(state.page + 1));
  nav.appendChild(nextBtn);
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

  const source = sourceMap.get(item.sourceId);

  // 돌아가기 링크
  const backLink = document.createElement('a');
  backLink.href = detailBackHash;
  backLink.className = 'detail-back';
  backLink.textContent = '← 검색 결과로 돌아가기';

  const article = document.createElement('article');
  article.className = 'detail-article';

  // 메타 행 (출처 배지, 게시일)
  const metaRow = document.createElement('div');
  metaRow.className = 'detail-meta';

  const badge = document.createElement('span');
  badge.className = `source-badge source-badge--${item.sourceId}`;
  badge.textContent = source.label;

  const dateEl = document.createElement('time');
  dateEl.className = 'detail-date';
  dateEl.dateTime = item.postedAt;
  dateEl.textContent = item.postedAt.replace(/-/g, '.');

  metaRow.appendChild(badge);
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
  deptEl.textContent = item.department;

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

  // 첨부 파일 (다운로드 불가, 샘플 표시 — CLAUDE.md 0절)
  if (item.attachments.length > 0) {
    const attachSection = document.createElement('section');
    attachSection.className = 'detail-attachments';

    const attachHeading = document.createElement('h2');
    attachHeading.className = 'detail-section-title';
    attachHeading.textContent = '첨부 파일';
    attachSection.appendChild(attachHeading);

    const attachList = document.createElement('ul');
    attachList.className = 'detail-attach-list';
    item.attachments.forEach(({ name }) => {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = name;
      const sampleTag = document.createElement('span');
      sampleTag.className = 'detail-attach-sample';
      sampleTag.textContent = '(샘플 — 다운로드 불가)';
      li.appendChild(nameSpan);
      li.appendChild(sampleTag);
      attachList.appendChild(li);
    });
    attachSection.appendChild(attachList);
    article.appendChild(attachSection);
  }

  // 원문 보기 (비활성, 샘플 — CLAUDE.md 0절)
  const originalDiv = document.createElement('div');
  originalDiv.className = 'detail-original';
  const originalBtn = document.createElement('button');
  originalBtn.type = 'button';
  originalBtn.className = 'btn-original';
  originalBtn.setAttribute('aria-disabled', 'true');
  originalBtn.textContent = '원문 보기 (샘플 — 연결 없음)';
  originalDiv.appendChild(originalBtn);
  article.appendChild(originalDiv);

  container.appendChild(backLink);
  container.appendChild(article);
}

// ── 없는 게시물 오류 화면 (P06 · F7) ─────────────
function showNotFound() {
  document.getElementById('list-view').hidden = true;
  document.getElementById('detail-view').hidden = false;
  renderNotFound();
  // 오류 제목으로 포커스 이동 (CLAUDE.md 5절)
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

// ── 필터 UI 초기화 (한 번만 실행) ──────────────────
function initFilters() {
  // 출처 체크박스
  const sourceList = document.getElementById('source-filter-list');
  SOURCES.forEach((source) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'filter-item__label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'filter-item__checkbox';
    checkbox.id = `source-${source.id}`;
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

  // 기간 라디오 버튼
  const periodList = document.getElementById('period-filter-list');
  PERIOD_OPTIONS.forEach(({ value, label }) => {
    const li = document.createElement('li');
    const labelEl = document.createElement('label');
    labelEl.className = 'filter-item__label';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.className = 'filter-item__radio';
    radio.id = `period-${value}`;
    radio.name = 'period';
    radio.value = value;
    radio.checked = value === 'all'; // 초기값: 전체
    radio.addEventListener('change', () => {
      if (radio.checked) update({ period: radio.value });
    });

    const nameSpan = document.createElement('span');
    nameSpan.textContent = label;

    labelEl.appendChild(radio);
    labelEl.appendChild(nameSpan);
    li.appendChild(labelEl);
    periodList.appendChild(li);
  });
}

// 상태 변경 후 필터 UI 동기화 (필터 컨트롤을 재렌더링하지 않고 상태만 갱신)
function syncFilterUI() {
  document.querySelectorAll('#source-filter-list input[type="checkbox"]').forEach((cb) => {
    cb.checked = state.sourceIds.includes(cb.value);
  });
  document.querySelectorAll('#period-filter-list input[type="radio"]').forEach((rb) => {
    rb.checked = rb.value === state.period;
  });
}

// ── 초기화 ─────────────────────────────────────────
function init() {
  // 샘플 기준일 배너에 반영
  const refEl = document.getElementById('sample-ref-date');
  if (refEl) refEl.textContent = SAMPLE_REFERENCE_DATE;

  // 검색 폼 제출 (Enter 또는 버튼 클릭)
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const keyword = document.getElementById('search-input').value;
    update({ keyword });
  });

  // 필터 컨트롤 한 번만 렌더링
  initFilters();

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
