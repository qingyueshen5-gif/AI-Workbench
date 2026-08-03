import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const handoffFile = 'AI-Workbench-Handoff.md';

export const HANDOFF_START = '<!-- AIW_GENERATED_HANDOFF_START -->';
export const HANDOFF_END = '<!-- AIW_GENERATED_HANDOFF_END -->';
export const HANDOFF_LINKS = [
  ['PRODUCT.md', './PRODUCT.md'],
  ['CURRENT_STATUS.md', './CURRENT_STATUS.md'],
  ['NEXT_STEP.md', './NEXT_STEP.md'],
  ['EXECUTION_PROTOCOL.md', './EXECUTION_PROTOCOL.md'],
];

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

export function extractMarked(text, name) {
  const start = `<!-- ${name}_START -->`;
  const end = `<!-- ${name}_END -->`;
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(`缺少标记区：${name}`);
  }
  return text.slice(startIndex + start.length, endIndex).trim();
}

export function collectHandoffMetadata(now = new Date()) {
  return {
    branch: git('branch', '--show-current'),
    head: git('rev-parse', 'HEAD'),
    generatedAt: now.toISOString(),
  };
}

export function buildHandoffSnapshot(metadata = collectHandoffMetadata()) {
  const links = HANDOFF_LINKS.map(([label, target], index) => `${index + 1}. [${label}](${target})`).join('\n');
  return `## 读取顺序\n\n${links}\n\n## 当前 Git\n\n- Branch: \`${metadata.branch}\`\n- HEAD: \`${metadata.head}\`\n\n生成时间：${metadata.generatedAt}`;
}

export function renderHandoffFile(snapshot) {
  return `# AI Workbench Handoff\n\n${HANDOFF_START}\n${snapshot}\n${HANDOFF_END}\n`;
}

function main() {
  const output = renderHandoffFile(buildHandoffSnapshot());
  fs.writeFileSync(path.join(root, handoffFile), output, 'utf8');
  console.log('已生成轻量 AI-Workbench-Handoff.md。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
