/*
 * ⚠ HCI 과제용 샘플 데이터 (휴먼컴퓨터인터페이스 2026-2, 개인 프로젝트)
 *
 * 사용자가 정보가 원래 어느 게시판에 있는지 몰라도 내용 중심으로 탐색할 수 있도록
 * 7개 공통 주제(topic)를 정의한다.
 *
 * topic vs source
 * - topic: 내용 중심의 공통 분류 (이 서비스가 제공하는 카테고리)
 * - source: 게시물이 실제로 게시된 원본 게시판/위치
 */

export const TOPICS = Object.freeze([
  Object.freeze({ id: 'academic',        label: '학사·수업' }),
  Object.freeze({ id: 'scholarship',     label: '장학·등록' }),
  Object.freeze({ id: 'career',          label: '취업·진로' }),
  Object.freeze({ id: 'admission',       label: '입학' }),
  Object.freeze({ id: 'extracurricular', label: '비교과·대외활동' }),
  Object.freeze({ id: 'campus',          label: '대학생활·지원' }),
  Object.freeze({ id: 'university',      label: '학교·기관소식' }),
]);

export const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
