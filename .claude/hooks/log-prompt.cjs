#!/usr/bin/env node
/**
 * Claude Code UserPromptSubmit hook
 * 사용자가 Claude Code에 보낸 프롬프트 원문과 입력 시각을 prompts/raw-log.md 끝에 덧붙인다.
 *
 * - 원문은 그대로 기록한다. 줄바꿈, 공백, 코드 블록을 바꾸지 않는다.
 * - stdout에는 아무것도 출력하지 않는다. (UserPromptSubmit hook의 stdout은 Claude의 컨텍스트에 추가된다)
 * - 기록에 실패해도 프롬프트 전송을 막지 않도록 항상 exit 0으로 끝낸다. 실패 이유는 stderr에만 남긴다.
 * - 확장자를 .cjs로 둔 이유: 나중에 package.json에 "type": "module"을 추가해도 CommonJS로 실행되게 하기 위해서다.
 */
const fs = require('fs');
const path = require('path');

// 이 파일 위치(.claude/hooks/) 기준으로 프로젝트 루트를 찾는다. 작업 디렉터리가 바뀌어도 같은 파일에 기록된다.
const ROOT = path.resolve(__dirname, '..', '..');
const LOG_PATH = path.join(ROOT, 'prompts', 'raw-log.md');

const HEADER = [
  '# 프롬프트 자동 기록 원본 (raw-log)',
  '',
  '> 이 파일은 `.claude/hooks/log-prompt.cjs`가 Claude Code에 입력한 프롬프트를 자동으로 덧붙이는 원본입니다.',
  '> 직접 수정하지 않습니다. 제출용 정리는 `PROMPTS.md`에서 합니다.',
  '',
].join('\n');

// 한국 표준시(UTC+9) 문자열. Intl 지원 여부와 관계없이 동작하도록 직접 계산한다.
function kstTimestamp() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace('T', ' ').slice(0, 19) + ' KST';
}

// 프롬프트 안에 ``` 가 있어도 깨지지 않도록 그보다 긴 백틱 울타리를 만든다.
function fenceFor(text) {
  const runs = text.match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}');
    const prompt = typeof input.prompt === 'string' ? input.prompt : '';
    if (prompt.trim() === '') process.exit(0);

    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, HEADER, 'utf8');

    const session = typeof input.session_id === 'string' ? input.session_id.slice(0, 8) : 'unknown';
    const fence = fenceFor(prompt);
    const entry = [
      '',
      '---',
      '',
      `### ${kstTimestamp()} · 세션 ${session}`,
      '',
      fence + 'text',
      prompt,
      fence,
      '',
    ].join('\n');

    fs.appendFileSync(LOG_PATH, entry, 'utf8');
  } catch (err) {
    process.stderr.write(`[log-prompt] 프롬프트 기록 실패: ${err.message}\n`);
  }
  process.exit(0);
});
