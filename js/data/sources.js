/*
 * P15: 국립목포대학교 공개 게시판 출처 5개
 *
 * 2026-11-11 기준 데이터 수집에 사용된 실제 게시판 목록이다.
 * 실제 학교 시스템과 직접 연결되어 있지 않으며, 정적 snapshot 데이터를 탐색하는 프로토타입이다.
 *
 * [관찰] 일반공지·학사공지는 사용자 조사(P01)에서 직접 관찰한 출처다.
 * [가설] 나머지 3개(장학·취업·의과대학소식)는 설계 가설(H1) 검증을 위해 추가한 출처다.
 *
 * 필드
 * - id: URL과 필터에서 쓰는 짧은 식별자 (소문자 영문)
 * - label: 화면에 보이는 출처 이름. 배지는 반드시 이 텍스트를 함께 표시한다 (색만으로 구분 금지)
 * - description: 이 출처가 다루는 내용 (필터 도움말 등에 사용)
 * - colorToken: 출처 배지 색을 연결할 CSS 변수 이름 (css/styles.css에 정의)
 */

export const SOURCES = Object.freeze([
  Object.freeze({
    id: 'general',
    label: '일반공지',
    description: '행사, 시설, 생활 안내',
    colorToken: '--source-general',
  }),
  Object.freeze({
    id: 'haksa',
    label: '학사공지',
    description: '수강신청, 학사일정, 학습 프로그램',
    colorToken: '--source-haksa',
  }),
  Object.freeze({
    id: 'scholar',
    label: '장학',
    description: '교내외 장학금, 근로장학',
    colorToken: '--source-scholar',
  }),
  Object.freeze({
    id: 'career',
    label: '취업',
    description: '채용, 인턴십, 취업 프로그램',
    colorToken: '--source-career',
  }),
  Object.freeze({
    id: 'medical',
    label: '의과대학소식',
    description: '의과대학 관련 소식',
    colorToken: '--source-medical',
  }),
]);
