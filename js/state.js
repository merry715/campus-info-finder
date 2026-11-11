/**
 * URL 해시 ↔ 탐색 상태 변환 (P05, P11 확장, P14: topics 추가)
 *
 * 목록 해시: #/  또는  #/?q=검색어&src=haksa,dept&period=3m&page=2
 *           #/?sort=oldest&cols=2&period=custom&from=2026-10-01&to=2026-11-10
 *           #/?topics=academic,scholarship
 * 상세 해시: #/item/haksa-003
 */

const VALID_PERIODS = new Set(['all', '1m', '3m', '1y', 'custom']);
const VALID_SORTS   = new Set(['newest', 'oldest', 'title']);

/**
 * URL 해시 문자열을 파싱해 라우트 정보를 반환한다.
 * @param {string} hash - location.hash
 * @returns {{ view: 'list', keyword: string, sourceIds: string[], topics: string[], period: string,
 *             page: number, sort: string, cols: number, customFrom: string, customTo: string }
 *          | { view: 'detail', itemId: string }}
 */
export function parseHash(hash) {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  const path = fragment || '/';

  // 상세 화면: #/item/{id}
  const detailMatch = path.match(/^\/item\/(.+)$/);
  if (detailMatch) {
    return { view: 'detail', itemId: detailMatch[1] };
  }

  // 목록 화면: #/ 또는 #/?...
  const qIdx = path.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? path.slice(qIdx + 1) : '');

  const keyword      = params.get('q')       ?? '';
  const srcParam     = params.get('src')     ?? '';
  const sourceIds    = srcParam ? srcParam.split(',').filter(Boolean) : [];
  const topicsParam  = params.get('topics')  ?? '';
  const topics       = topicsParam ? topicsParam.split(',').filter(Boolean) : [];

  const rawPeriod = params.get('period') ?? 'all';
  const period    = VALID_PERIODS.has(rawPeriod) ? rawPeriod : 'all';

  const rawPage = parseInt(params.get('page') ?? '1', 10);
  const page    = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

  const rawSort = params.get('sort') ?? 'newest';
  const sort    = VALID_SORTS.has(rawSort) ? rawSort : 'newest';

  const rawCols = parseInt(params.get('cols') ?? '1', 10);
  const cols    = [1, 2, 3].includes(rawCols) ? rawCols : 1;

  const customFrom = params.get('from') ?? '';
  const customTo   = params.get('to')   ?? '';

  return { view: 'list', keyword, sourceIds, topics, period, page, sort, cols, customFrom, customTo };
}

/**
 * 목록 상태를 URL 해시 문자열로 직렬화한다.
 * 기본 상태(조건 없음, 1페이지)는 '#/'로 단순화한다.
 * @param {{ keyword: string, sourceIds: string[], topics?: string[], period: string, page: number,
 *           sort?: string, cols?: number, customFrom?: string, customTo?: string }} state
 * @returns {string}
 */
export function serializeListState({
  keyword, sourceIds, topics = [], period, page,
  sort = 'newest', cols = 1, customFrom = '', customTo = '',
}) {
  const params = new URLSearchParams();
  if (keyword)          params.set('q',      keyword);
  if (sourceIds.length) params.set('src',    sourceIds.join(','));
  if (topics.length)    params.set('topics', topics.join(','));
  if (period !== 'all') params.set('period', period);
  if (period === 'custom') {
    if (customFrom) params.set('from', customFrom);
    if (customTo)   params.set('to',   customTo);
  }
  if (page  !== 1)        params.set('page', String(page));
  if (sort  !== 'newest') params.set('sort', sort);
  if (cols  !== 1)        params.set('cols', String(cols));

  const query = params.toString();
  return query ? `#/?${query}` : '#/';
}
