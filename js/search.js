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
 * - 대상 필드: title, summary, body
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
    const haystack = `${item.title} ${item.summary} ${item.body}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * 출처 ID 목록으로 게시물을 필터링한다.
 * sourceIds가 빈 배열이면 전체를 반환한다 (= 전체 출처).
 *
 * @param {ReadonlyArray} items
 * @param {string[]} sourceIds
 * @returns {Array}
 */
export function filterBySource(items, sourceIds) {
  if (!sourceIds.length) return items;
  return items.filter((item) => sourceIds.includes(item.sourceId));
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
 * 키워드·출처·기간 필터를 순서대로 적용한다.
 *
 * @param {ReadonlyArray} items - 최신순으로 정렬된 전체 게시물 목록
 * @param {{ keyword: string, sourceIds: string[], period: string }} filters
 * @param {string} referenceDate - SAMPLE_REFERENCE_DATE
 * @returns {Array} 필터링된 게시물 목록 (정렬 순서 유지)
 */
export function applyFilters(items, { keyword, sourceIds, period }, referenceDate) {
  let result = filterByKeyword(items, keyword);
  result = filterBySource(result, sourceIds);
  result = filterByPeriod(result, period, referenceDate);
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
