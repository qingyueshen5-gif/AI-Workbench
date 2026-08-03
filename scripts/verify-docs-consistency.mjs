import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildHandoffSnapshot, collectHandoffMetadata, extractMarked, renderHandoffFile, HANDOFF_LINKS } from './generate-handoff.mjs';

const root = process.cwd();
const outDir = path.join(root, 'verification/docs-consistency');
const historicalMarker = '> 历史快照：本文件不再代表当前项目状态。';
const approvedPaths = new Set([
  'AI-Workbench-Handoff.md',
  'CONTEXT.md',
  'CURRENT_PROGRESS_AUDIT.md',
  'CURRENT_STATUS.md',
  'CURRENT_TASK.md',
  'NEXT_STEP.md',
  'PRODUCT.md',
  'TASKLOG.md',
  'scripts/generate-handoff.mjs',
  'scripts/verify-docs-consistency.mjs',
  'verification/docs-consistency/report.md',
  'verification/docs-consistency/run.log',
  'verification/docs-consistency/summary.json',
]);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function git(args, { allowFailure = false } = {}) {
  const result = execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  return result.trim();
}

function changedPaths() {
  const modified = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean);
  const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
  return [...new Set([...modified, ...staged, ...untracked])].sort();
}

function check(name, passed, detail) {
  return { name, status: passed ? 'passed' : 'failed', detail };
}

const checks = [];
const errors = [];
function assertCheck(name, passed, detail) {
  const item = check(name, passed, detail);
  checks.push(item);
  if (!passed) errors.push(`${name}: ${detail}`);
}

try {
  const required = ['PRODUCT.md', 'CURRENT_STATUS.md', 'NEXT_STEP.md', 'CONTEXT.md', 'CURRENT_PROGRESS_AUDIT.md', 'CURRENT_TASK.md', 'AI-Workbench-Handoff.md'];
  for (const file of required) assertCheck(`${file}存在`, exists(file), exists(file) ? '存在' : '缺失');

  const product = read('PRODUCT.md');
  const status = read('CURRENT_STATUS.md');
  const next = read('NEXT_STEP.md');
  const context = read('CONTEXT.md');
  const progress = read('CURRENT_PROGRESS_AUDIT.md');
  const currentTask = read('CURRENT_TASK.md');
  const handoff = read('AI-Workbench-Handoff.md');
  const nextMarked = extractMarked(next, 'AIW_NEXT_STEP');
  const handoffMarked = extractMarked(handoff, 'AIW_GENERATED_HANDOFF');

  assertCheck('CURRENT_STATUS唯一权威', context.includes('| 当前真实状态 | `CURRENT_STATUS.md` |'), 'CONTEXT.md必须明确CURRENT_STATUS.md是当前真实状态唯一权威');
  assertCheck('NEXT_STEP唯一权威', context.includes('| 当前唯一下一步 | `NEXT_STEP.md` |'), 'CONTEXT.md必须明确NEXT_STEP.md是当前唯一下一步唯一权威');
  assertCheck('NEXT_STEP仅含RUN-FENCING-001', nextMarked === 'RUN-FENCING-001重新实现', `标记区实际为：${nextMarked}`);
  assertCheck('NEXT_STEP无旧A/E/G主线', !/(A\/E\/G|A、E、G|工作包 A|工作包 E|工作包 G|v0\.4\.7首批)/i.test(next), 'NEXT_STEP.md不得把旧A/E/G写成当前主线');
  assertCheck('RUN-FENCING实际开发基线', next.includes('实际开发基线：`579ae3c4592bec3de2c1c0c223db557641c1cc68`'), 'NEXT_STEP.md必须以579ae3作为实际开发基线');
  assertCheck('Checkpoint保护祖先口径', next.includes('Checkpoint保护机制祖先：`bc43431e954f708d74d82b49ce367a73e07d0174`'), 'bc43431只能作为Checkpoint保护机制祖先');

  const handoffBranch = handoffMarked.match(/- Branch: `([^`]+)`/)?.[1];
  const handoffHead = handoffMarked.match(/- HEAD: `([0-9a-f]{40})`/)?.[1];
  const handoffGeneratedAt = handoffMarked.match(/生成时间：([^\n]+)/)?.[1];
  const expectedHandoff = renderHandoffFile(buildHandoffSnapshot({ branch: handoffBranch, head: handoffHead, generatedAt: handoffGeneratedAt }));
  const normalizeNewlines = (value) => value.replaceAll('\r\n', '\n');
  assertCheck('Handoff轻量结构', Boolean(handoffBranch && handoffHead && handoffGeneratedAt) && normalizeNewlines(handoff) === normalizeNewlines(expectedHandoff), 'Handoff必须保持生成器定义的轻量索引结构；分支切换本身不要求改写Handoff');
  assertCheck('Handoff四个权威链接', HANDOFF_LINKS.length === 4 && HANDOFF_LINKS.every(([label]) => handoff.includes(`[${label}]`)), 'Handoff必须引用PRODUCT、CURRENT_STATUS、NEXT_STEP、EXECUTION_PROTOCOL');
  assertCheck('Handoff不复制状态正文', handoff.split(/\r?\n/).length <= 22 && !/当前阻断|最近关键事件|已完成能力|Production Smoke失败/.test(handoff), 'Handoff过长或复制了状态正文');

  assertCheck('CURRENT_PROGRESS历史标记', progress.includes(historicalMarker) && progress.includes('当前真实状态唯一以CURRENT_STATUS.md为准；') && progress.includes('当前唯一下一步以NEXT_STEP.md为准。'), 'CURRENT_PROGRESS_AUDIT.md顶部缺少统一历史快照标记');
  assertCheck('CURRENT_TASK历史标记', currentTask.includes(historicalMarker) && currentTask.includes('当前真实状态唯一以CURRENT_STATUS.md为准；') && currentTask.includes('当前唯一下一步以NEXT_STEP.md为准。'), 'CURRENT_TASK.md顶部缺少统一历史快照标记');
  assertCheck('PRODUCT一页看懂置顶', product.startsWith('# AI Workbench：一页看懂'), 'PRODUCT.md最前面必须是一页看懂');
  assertCheck('PRODUCT一句话定义', product.includes('AI Workbench是一个以人的目标为中心，能够调度多个AI、Agent和电脑工具，把任务真正执行完成并交付经过验证结果的智能工作台。'), '缺少批准的一句话定义');
  assertCheck('PRODUCT三条铁律', ['极低门槛', '真正完成任务', '稳定、安全、可验证'].every((text) => product.includes(text)), '缺少三条产品铁律');

  assertCheck('CURRENT_STATUS不宣称RUN-FENCING完成', status.includes('RUN-FENCING正式实现当前不存在') && status.includes('临时通过但已丢失的RUN-FENCING不属于当前已完成成果。') && !/RUN-FENCING正式实现[^\n。]*(已完成|completed|passed)/i.test(status), '不得把RUN-FENCING正式实现写成已完成');
  assertCheck('CURRENT_STATUS不放行部署真人使用', status.includes('产品尚未达到可部署和真人稳定使用状态') && status.includes('当前不能进入正式发布'), '必须明确不可部署、不可宣称真人稳定使用');

  const currentAuthorityClaims = changedPaths().filter((file) => file.endsWith('.md') && file !== 'CURRENT_STATUS.md' && exists(file)).filter((file) => {
    const text = read(file);
    return /当前真实工程状态唯一权威|当前真实状态唯一权威/.test(text) && !text.includes('CURRENT_STATUS.md');
  });
  assertCheck('不存在第二个CURRENT_STATUS类权威', currentAuthorityClaims.length === 0, currentAuthorityClaims.length ? currentAuthorityClaims.join(', ') : '无第二权威声明');

  const changed = changedPaths();
  const outside = changed.filter((file) => !approvedPaths.has(file));
  assertCheck('变更限定在批准范围', outside.length === 0, outside.length ? outside.join(', ') : '所有变更均在批准范围');
  const nameStatus = git(['diff', '--name-status', 'HEAD']);
  assertCheck('不删除不移动原文件', !/^(D|R|C)\s/m.test(nameStatus), nameStatus || '无删除、移动或复制');
} catch (error) {
  errors.push(`校验脚本异常：${error.stack || error.message}`);
}

fs.mkdirSync(outDir, { recursive: true });
const overallStatus = errors.length === 0 ? 'passed' : 'failed';
const summary = {
  taskId: 'DOCUMENT-AUTHORITY-CONSOLIDATION-001',
  overallStatus,
  checks,
  changedPaths: (() => { try { return changedPaths(); } catch { return []; } })(),
  errors,
  verifiedAt: new Date().toISOString(),
};
const report = [
  '# 文档权威一致性校验报告',
  '',
  `- 总状态：${overallStatus}`,
  `- 检查项：${checks.length}`,
  '',
  '## 检查结果',
  ...checks.map((item) => `- ${item.status === 'passed' ? 'PASS' : 'FAIL'}｜${item.name}｜${item.detail}`),
  '',
  '## 错误',
  ...(errors.length ? errors.map((error) => `- ${error}`) : ['- 无']),
].join('\n');
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(outDir, 'report.md'), `${report}\n`, 'utf8');
fs.writeFileSync(path.join(outDir, 'run.log'), `task=DOCUMENT-AUTHORITY-CONSOLIDATION-001 status=${overallStatus} checks=${checks.length}\n`, 'utf8');

if (errors.length) {
  console.error(`文档一致性校验失败：${errors.length}项。`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, taskId: 'DOCUMENT-AUTHORITY-CONSOLIDATION-001', checks: checks.length }));
