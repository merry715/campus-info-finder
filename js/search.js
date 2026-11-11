/**
 * 검색·필터·페이지 계산 순수 함수 (P04)
 * DOM에 접근하지 않는다. 모든 함수는 같은 입력에 같은 출력을 반환한다.
 * 이 파일을 바꾸면 tests/ 의 테스트도 함께 추가·수정한다 (CLAUDE.md 7절).
 */

/**
 * ISO 날짜 문자열에서 N개월을 뺀 날짜 문자열을 반환한다.
 * 날짜(일)는 그대로 유지한다.
 * 예: subtractMonths('2026-11-10', 3) → '2026-08-10'
 */
function subtractMonths(isoDate, months) {
  const [y, m, d] = isoDate.split('-').map(Number);
  let newMonth = m - months;
  let newYear = y;
  while (newMonth < 1) {
    newMonth += 12;
    newYear -= 1;
  }
  return `${newYear}-${String(newMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * ISO 날짜 문자열에서 N년을 뺀 날짜 문자열을 반환한다.
 * 예: subtractYears('2026-11-10', 1) → '2025-11-10'
 */
function subtractYears(isoDate, years) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${y - years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * 기간 옵션에 해당하는 절단일(cutoff) 문자열을 반환한다.
 * postedAt >= cutoff 인 게시물이 해당 기간에 포함된다 (경계일 포함).
 *
 * 기준일 2026-11-10 기준:
 *   '1m' → '2026-10-10'
 *   '3m' → '2026-08-10'
 *   '1y' → '2025-11-10'
 *   'all' → null (필터 없음)
 *
 * @param {'all'|'1m'|'3m'|'1y'} period
 * @param {string} referenceDate - SAMPLE_REFERENCE_DATE ('YYYY-MM-DD')
 * @returns {string|null} cutoff 날짜 문자열 또는 null
 */
export function getPeriodCutoff(period, referenceDate) {
  if (period === '1m') return subtractMonths(referenceDate, 1);
  if (period === '3m') return subtractMonths(referenceDate, 3);
  if (period === '1y') return subtractYears(referenceDate, 1);
  return null; // 'all'
}

/**
 * 키워드로 게시물을 필터링한다.
 * - 앞뒤 공백 무시, 대소문자 무시
 * - 여러 단어는 AND 방식 (공백으로 구분)
 * - 대상 필드: title, summary, body, author, organization
 *
 * @param {ReadonlyArray} items
 * @param {string} keyword
 * @returns {Array}
 */
export function filterByKeyword(items, keyword) {
  const q = keyword.trim().toLowerCase();
  if (!q) return items;
  const words = q.split(/\s+/);
  return items.filter((item) => {
    const haystack = `${item.title} ${item.summary} ${item.body} ${item.author ?? ''} ${item.organization ?? ''}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * 게시물의 sourceEntries 또는 단일 sourceId에서 sourceId 배열을 반환한다.
 * sourceEntries가 있으면 그것을 source-of-truth로 사용한다.
 *
 * @param {object} item
 * @returns {string[]}
 */
export function getItemSources(item) {
  if (item.sourceEntries && item.sourceEntries.length) {
    return item.sourceEntries.map((e) => e.sourceId);
  }
  return item.sourceId ? [item.sourceId] : [];
}

/**
 * 게시물의 sourceEntries 중 isPinned===true인 sourceId 배열을 반환한다.
 * sourceEntries가 없으면 빈 배열 (= pinned 아님).
 *
 * @param {object} item
 * @returns {string[]}
 */
export function getPinnedSources(item) {
  if (item.sourceEntries && item.sourceEntries.length) {
    return item.sourceEntries.filter((e) => e.isPinned).map((e) => e.sourceId);
  }
  return [];
}

/**
 * 선택된 출처 목록에서 이 게시물이 고정 게시글로 분류되는지 판단한다.
 * selectedSourceIds가 비어 있으면 "전체 출처" 기준 — 하나라도 pinned이면 true.
 * selectedSourceIds가 있으면 그 중 하나라도 이 item에서 pinned이면 true.
 *
 * @param {object} item
 * @param {string[]} selectedSourceIds
 * @returns {boolean}
 */
export function itemIsPinnedForCurrentSources(item, selectedSourceIds) {
  const pinnedSources = getPinnedSources(item);
  if (!pinnedSources.length) return false;
  if (!selectedSourceIds || !selectedSourceIds.length) return true;
  return selectedSourceIds.some((id) => pinnedSources.includes(id));
}

/**
 * 출처 필터와 게시물의 출처(sourceEntries)가 일치하는지 판단한다.
 * selectedSourceIds가 비어 있으면 모든 게시물 반환.
 * 게시물의 출처 중 하나라도 selectedSourceIds에 포함되면 일치.
 *
 * @param {object} item
 * @param {string[]} selectedSourceIds
 * @returns {boolean}
 */
export function itemMatchesSourceFilter(item, selectedSourceIds) {
  if (!selectedSourceIds || !selectedSourceIds.length) return true;
  const sources = getItemSources(item);
  return selectedSourceIds.some((id) => sources.includes(id));
}

/**
 * 중복 판정용 identity key.
 * 제목(공백 정규화)·작성일·작성자가 같으면 동일 게시물로 본다.
 *
 * @param {object} item
 * @returns {string}
 */
export function getItemIdentityKey(item) {
  const normalizedTitle = item.title.trim().replace(/\s+/g, ' ');
  return `${normalizedTitle}|${item.postedAt}|${item.author}`;
}

/**
 * identity key가 같은 게시물을 하나의 통합 item으로 병합한다.
 * 같은 key를 가진 게시물이 여러 개이면 첫 번째 항목의 sourceEntries에 나머지를 병합한다.
 * 단 이미 sourceEntries가 명시된 항목은 그대로 유지한다.
 *
 * @param {ReadonlyArray} items
 * @returns {Array}
 */
export function deduplicateItems(items) {
  const seen = new Map();
  for (const item of items) {
    const key = getItemIdentityKey(item);
    if (!seen.has(key)) {
      seen.set(key, { ...item, sourceEntries: item.sourceEntries ? [...item.sourceEntries] : undefined });
    } else {
      const existing = seen.get(key);
      const existingSources = getItemSources(existing);
      const itemEntries = item.sourceEntries
        ? item.sourceEntries
        : [{ source: item.source, sourceId: item.sourceId, originalPostNo: item.originalPostNo, originalUrl: item.originalUrl, isPinned: false }];
      const toAdd = itemEntries.filter((e) => !existingSources.includes(e.sourceId));
      if (toAdd.length) {
        const baseEntries = existing.sourceEntries
          ? existing.sourceEntries
          : [{ source: existing.source, sourceId: existing.sourceId, originalPostNo: existing.originalPostNo, originalUrl: existing.originalUrl, isPinned: false }];
        existing.sourceEntries = [...baseEntries, ...toAdd];
      }
    }
  }
  return [...seen.values()];
}

/**
 * 출처 ID 목록으로 게시물을 필터링한다.
 * sourceIds가 빈 배열이면 전체를 반환한다 (= 전체 출처).
 * 다중 출처 게시물은 선택된 출처 중 하나라도 포함하면 반환한다.
 *
 * @param {ReadonlyArray} items
 * @param {string[]} sourceIds
 * @returns {Array}
 */
export function filterBySource(items, sourceIds) {
  if (!sourceIds.length) return items;
  return items.filter((item) => itemMatchesSourceFilter(item, sourceIds));
}

/**
 * 기간으로 게시물을 필터링한다.
 * postedAt >= cutoff 를 만족하는 게시물만 반환한다 (경계일 포함).
 *
 * @param {ReadonlyArray} items
 * @param {'all'|'1m'|'3m'|'1y'} period
 * @param {string} referenceDate
 * @returns {Array}
 */
export function filterByPeriod(items, period, referenceDate) {
  const cutoff = getPeriodCutoff(period, referenceDate);
  if (!cutoff) return items;
  return items.filter((item) => item.postedAt >= cutoff);
}

/**
 * 날짜 범위의 유효성을 검사한다.
 * 한쪽만 입력된 경우는 유효. 둘 다 입력된 경우에만 from <= to를 확인한다.
 *
 * @param {string} from - 'YYYY-MM-DD' 또는 ''
 * @param {string} to   - 'YYYY-MM-DD' 또는 ''
 * @returns {boolean}
 */
export function isValidDateRange(from, to) {
  if (!from || !to) return true;
  return from <= to;
}

/**
 * 직접 설정 날짜 범위(from, to)로 게시물을 필터링한다.
 * 경계일 포함. 빈 문자열이면 그 쪽 제한 없음.
 *
 * @param {ReadonlyArray} items
 * @param {string} from - 'YYYY-MM-DD' 또는 ''
 * @param {string} to   - 'YYYY-MM-DD' 또는 ''
 * @returns {Array}
 */
export function filterByCustomPeriod(items, from, to) {
  if (!from && !to) return items;
  return items.filter((item) => {
    if (from && item.postedAt < from) return false;
    if (to   && item.postedAt > to)   return false;
    return true;
  });
}

/**
 * 게시물 목록을 정렬한다. 원본 배열을 변경하지 않는다.
 *
 * - newest: 최신 날짜 순
 * - oldest: 오래된 날짜 순
 * - title: 월 그룹(최신 월 → 오래된 월) 내에서 제목 가나다순 (P13)
 *
 * @param {Array} items
 * @param {'newest'|'oldest'|'title'} sort
 * @returns {Array} 새 배열
 */
export function sortItems(items, sort) {
  if (sort === 'oldest') return [...items].sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  if (sort === 'title') {
    const byDate = [...items].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
    return groupItemsByMonth(byDate)
      .flatMap(({ items: g }) => [...g].sort((a, b) => a.title.localeCompare(b.title, 'ko')));
  }
  return [...items].sort((a, b) => b.postedAt.localeCompare(a.postedAt)); // newest (기본)
}

/**
 * 주제 ID 목록으로 게시물을 필터링한다.
 * topicIds가 빈 배열이면 전체를 반환한다 (= 전체 주제).
 * 선택한 주제 중 하나에 속하면 포함 (OR).
 *
 * @param {ReadonlyArray} items
 * @param {string[]} topicIds
 * @returns {Array}
 */
export function filterByTopic(items, topicIds) {
  if (!topicIds || !topicIds.length) return items;
  return items.filter((item) => topicIds.includes(item.topic));
}

/**
 * 이미 필터링된 게시물 목록에서 키워드와 일치하는 제목을 가진 항목을 반환한다.
 * 자동완성 제안 용도. 제목 필드만 검색한다.
 * - 2자 미만이면 빈 배열 반환
 * - maxCount 개수까지만 반환
 *
 * @param {Array} items - 현재 필터가 적용된 목록
 * @param {string} keyword
 * @param {number} maxCount
 * @returns {Array}
 */
export function getSuggestions(items, keyword, maxCount = 6) {
  const q = keyword.trim().toLowerCase();
  if (q.length < 2) return [];
  return items
    .filter((item) => item.title.toLowerCase().includes(q))
    .slice(0, maxCount);
}

/**
 * 키워드·주제·출처·기간 필터를 순서대로 적용한다.
 * period === 'custom' 일 때는 filterByCustomPeriod(customFrom, customTo)를 사용한다.
 *
 * @param {ReadonlyArray} items
 * @param {{ keyword: string, sourceIds: string[], topics?: string[], period: string, customFrom?: string, customTo?: string }} filters
 * @param {string} referenceDate - SAMPLE_REFERENCE_DATE
 * @returns {Array} 필터링된 게시물 목록
 */
export function applyFilters(items, { keyword, sourceIds, topics = [], period, customFrom = '', customTo = '' }, referenceDate) {
  let result = filterByKeyword(items, keyword);
  result = filterBySource(result, sourceIds);
  result = filterByTopic(result, topics);
  if (period === 'custom') {
    result = filterByCustomPeriod(result, customFrom, customTo);
  } else {
    result = filterByPeriod(result, period, referenceDate);
  }
  return result;
}

/**
 * 필터링된 목록에서 특정 페이지를 반환한다.
 *
 * @param {Array} items
 * @param {number} page - 1부터 시작
 * @param {number} pageSize
 * @returns {Array}
 */
export function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * 전체 페이지 수를 반환한다. 최소 1을 보장한다.
 *
 * @param {number} totalItems
 * @param {number} pageSize
 * @returns {number}
 */
export function getTotalPages(totalItems, pageSize) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

/**
 * 기간 옵션(1m/3m/1y)의 실제 날짜 범위를 반환한다.
 * 필터 라벨 옆에 "2026.10.10 ~ 2026.11.10"처럼 표시하기 위한 용도.
 * 'all' 또는 'custom'이면 null을 반환한다.
 *
 * @param {'all'|'1m'|'3m'|'1y'|'custom'} period
 * @param {string} referenceDate - 'YYYY-MM-DD'
 * @returns {{ from: string, to: string } | null}
 */
export function getPeriodDisplayRange(period, referenceDate) {
  const cutoff = getPeriodCutoff(period, referenceDate);
  if (!cutoff) return null;
  return { from: cutoff, to: referenceDate };
}

/**
 * 현재 페이지가 속한 그룹의 페이지 번호 배열을 반환한다.
 * 한 번에 groupSize(기본 10)개의 번호만 표시하기 위한 용도.
 *
 * 예: getVisiblePageRange(1,  12) → [1,2,...,10]
 *     getVisiblePageRange(11, 12) → [11,12]
 *     getVisiblePageRange(27, 36) → [21,...,30]
 *
 * @param {number} currentPage - 1부터 시작
 * @param {number} totalPages
 * @param {number} groupSize - 기본값 10
 * @returns {number[]}
 */
export function getVisiblePageRange(currentPage, totalPages, groupSize = 10) {
  const groupStart = Math.floor((currentPage - 1) / groupSize) * groupSize + 1;
  const groupEnd   = Math.min(groupStart + groupSize - 1, totalPages);
  const range = [];
  for (let i = groupStart; i <= groupEnd; i++) range.push(i);
  return range;
}

/**
 * 중앙 목록 영역에 표시할 상태 유형을 반환한다.
 * - 'list':        regular 항목이 있어 목록을 표시한다
 * - 'pinned-only': regular = 0이지만 pinned > 0 — 고정 게시글 패널에 결과가 있음을 안내한다
 * - 'empty':       matching 결과가 전혀 없다
 *
 * @param {number} regularCount - regular 항목 수
 * @param {number} pinnedCount  - pinned 항목 수
 * @returns {'list'|'pinned-only'|'empty'}
 */
export function getEmptyStateType(regularCount, pinnedCount) {
  if (regularCount > 0) return 'list';
  if (pinnedCount  > 0) return 'pinned-only';
  return 'empty';
}

/**
 * 게시물의 원문 링크 목록을 반환한다.
 * sourceEntries 우선, 없으면 최상위 originalUrl fallback.
 * originalUrl이 없는 entry는 제외한다.
 *
 * @param {object} item
 * @returns {{ source: string, sourceId: string, originalUrl: string }[]}
 */
export function getOriginalLinks(item) {
  if (item.sourceEntries && item.sourceEntries.length) {
    return item.sourceEntries
      .filter((e) => e.originalUrl)
      .map((e) => ({ source: e.source, sourceId: e.sourceId, originalUrl: e.originalUrl }));
  }
  if (item.originalUrl) {
    return [{ source: item.source, sourceId: item.sourceId, originalUrl: item.originalUrl }];
  }
  return [];
}

/**
 * 게시물을 고정(pinned)과 일반(regular)으로 분리한다.
 * selectedSourceIds를 기준으로 itemIsPinnedForCurrentSources를 사용해 판단한다.
 * selectedSourceIds가 비어 있으면 "전체 출처" 기준.
 *
 * @param {ReadonlyArray} items
 * @param {string[]} selectedSourceIds - 현재 선택된 출처 ID 목록 (기본값: [])
 * @returns {{ pinned: Array, regular: Array }}
 */
export function splitPinnedItems(items, selectedSourceIds = []) {
  const pinned  = items.filter((i) => itemIsPinnedForCurrentSources(i, selectedSourceIds));
  const regular = items.filter((i) => !itemIsPinnedForCurrentSources(i, selectedSourceIds));
  return { pinned, regular };
}

/**
 * 게시물 목록을 월 단위로 그룹화한다.
 * 입력 배열의 순서를 유지한다 (정렬 후 호출할 것).
 *
 * @param {Array} items
 * @returns {Array<{ monthKey: string, label: string, items: Array }>}
 */
export function groupItemsByMonth(items) {
  const groups   = [];
  const keyIndex = new Map();
  for (const item of items) {
    const key = item.postedAt.slice(0, 7); // 'YYYY-MM'
    if (!keyIndex.has(key)) {
      const [y, m] = key.split('-');
      keyIndex.set(key, groups.length);
      groups.push({ monthKey: key, label: `${Number(y)}년 ${Number(m)}월`, items: [] });
    }
    groups[keyIndex.get(key)].items.push(item);
  }
  return groups;
}
