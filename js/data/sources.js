/*
 * ⚠ HCI 과제용 샘플 데이터 (휴먼컴퓨터인터페이스 2026-2, 개인 프로젝트)
 *
 * 이 파일의 정보 출처 6개는 "여러 학교 정보 출처를 한곳에서 탐색한다"는 설계 가설(H1)을
 * 시험하기 위해 만든 샘플 분류입니다. 실제 학교 게시판 구조를 그대로 옮긴 것이 아니며,
 * 실제 학교 시스템과 연결되어 있지 않습니다.
 *
 * [관찰] 사용자 조사에서 실제로 관찰한 분류는 학사공지·일반공지 2개뿐입니다.
 * [가설] 나머지 4개(학과공지·장학정보·취업정보·비교과·프로그램)는 교수님 피드백을 반영해 확장한 출처입니다.
 *
 * 필드
 * - id: URL과 필터에서 쓰는 짧은 식별자 (소문자 영문)
 * - label: 화면에 보이는 출처 이름. 배지는 반드시 이 텍스트를 함께 표시한다 (색만으로 구분 금지)
 * - description: 이 출처가 다루는 내용 (필터 도움말 등에 사용)
 * - colorToken: 출처 배지 색을 연결할 CSS 변수 이름. 실제 색 값은 이후 단계에서 css/styles.css에 정의한다
 * - observed: 사용자 조사에서 실제로 관찰한 분류인지 여부 (근거 수준 구분용)
 */

export const SOURCES = Object.freeze([
  Object.freeze({
    id: 'haksa',
    label: '학사공지',
    description: '수강신청·정정, 졸업, 학적, 학사일정',
    colorToken: '--source-haksa',
    observed: true,
  }),
  Object.freeze({
    id: 'general',
    label: '일반공지',
    description: '행사, 시설, 생활 안내',
    colorToken: '--source-general',
    observed: true,
  }),
  Object.freeze({
    id: 'dept',
    label: '학과공지',
    description: '학과 단위의 전공·졸업 안내',
    colorToken: '--source-dept',
    observed: false,
  }),
  Object.freeze({
    id: 'scholar',
    label: '장학정보',
    description: '교내외 장학금, 근로장학',
    colorToken: '--source-scholar',
    observed: false,
  }),
  Object.freeze({
    id: 'career',
    label: '취업정보',
    description: '채용, 현장실습, 취업 준비 프로그램',
    colorToken: '--source-career',
    observed: false,
  }),
  Object.freeze({
    id: 'program',
    label: '비교과·프로그램',
    description: '비교과 활동, 경진대회, 부트캠프',
    colorToken: '--source-program',
    observed: false,
  }),
]);
