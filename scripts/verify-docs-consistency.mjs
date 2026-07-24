import fs from 'node:fs';
import path from 'node:path';
import { buildHandoffSnapshot, extractMarked, renderHandoffFile } from './generate-handoff.mjs';

const root = process.cwd();
const outDir = path.join(root, 'verification/docs-consistency');

const requiredFiles = [
  'EXECUTION_PROTOCOL.md',
  'package.json',
  'PRODUCT.md',
  'VISION.md',
  'PRINCIPLES.md',
  'DECISIONS.md',
  'CONTEXT.md',
  'CURRENT_TASK.md',
  'CURRENT_PROGRESS_AUDIT.md',
  'NEXT_STEP.md',
  'AI-Workbench-Handoff.md',
  'TASKLOG.md',
  'CHANGELOG.md',
  'LAUNCH.md',
  'verification/3a-final/summary.json',
  'verification/3b-release/summary.json',
  'verification/managed-proxy-production/summary.json',
];

const scannedFiles = [
  'CONTEXT.md',
  'CURRENT_TASK.md',
  'CURRENT_PROGRESS_AUDIT.md',
  'NEXT_STEP.md',
  'AI-Workbench-Handoff.md',
  'DECISIONS.md',
  'LAUNCH.md',
];

const ignoredHistoricalPaths = ['CHANGELOG.md', 'TASKLOG.md', 'tasks/**', 'verification/**', 'research/**'];
const expectedNextStep = '等待产品负责人验收第 3B-2b1 段部署候选。未经批准不得部署 Worker 或进入第 3B-2b2 段。';

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function stripHistoricalVersionMentions(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/历史|以下是历史版本|不代表当前版本|v0\.2\.0：/.test(line))
    .join('\n');
}

function pushCheck(checks, name, passed, detail) {
  checks.push({ name, status: passed ? 'passed' : 'failed', detail });
  return passed;
}

function scanForSecrets(filesToScan) {
  const findings = [];
  const patterns = [
    /\bsk-[A-Za-z0-9_-]{20,}\b/g,
    /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
    /\bAIza[0-9A-Za-z_-]{20,}\b/g,
    /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\b(?:password|passwd|pwd|cookie|authorization|bearer)\s*[:=]\s*["']?[^"'\s`]{12,}/gi,
  ];
  for (const relativePath of filesToScan) {
    const text = readText(relativePath);
    for (const pattern of patterns) {
      const matches = text.match(pattern) ?? [];
      if (matches.length > 0) {
        findings.push(`${relativePath}: 命中 ${matches.length} 个疑似敏感值模式`);
      }
    }
  }
  return findings;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const errors = [];
  const warnings = [];
  const capabilityStatusChecks = [];
  const log = [];
  let packageVersion = '';
  let contextVersion = '';
  let releaseVersion = '';
  let nextStep = '';
  let handoffGeneratedCheck = { status: 'failed', detail: '' };
  let handoffIdempotentCheck = { status: 'failed', detail: '' };

  try {
    for (const file of requiredFiles) {
      if (!exists(file)) errors.push(`必读文件不存在：${file}`);
    }

    const packageJson = readJson('package.json');
    packageVersion = packageJson.version;
    const contextText = readText('CONTEXT.md');
    const nextStepText = readText('NEXT_STEP.md');
    const capabilityText = readText('CURRENT_PROGRESS_AUDIT.md');
    const handoffText = readText('AI-Workbench-Handoff.md');
    const release = readJson('verification/3b-release/summary.json');
    const final3a = readJson('verification/3a-final/summary.json');
    const managedProxy = readJson('verification/managed-proxy-production/summary.json');

    const contextMarked = extractMarked(contextText, 'AIW_CURRENT_VERSION');
    const nextStepMarked = extractMarked(nextStepText, 'AIW_NEXT_STEP');
    const capabilityMarked = extractMarked(capabilityText, 'AIW_CAPABILITY_STATUS');
    const handoffMarked = extractMarked(handoffText, 'AIW_GENERATED_HANDOFF');
    nextStep = nextStepMarked.trim();
    releaseVersion = release.release?.tag ?? '';
    const contextVersionMatch = contextMarked.match(/当前版本：v([0-9]+\.[0-9]+\.[0-9]+)\s+Alpha/);
    contextVersion = contextVersionMatch?.[1] ?? '';

    if (contextVersion !== packageVersion) {
      errors.push(`CONTEXT.md 当前版本标记区与 package.json 不一致：CONTEXT=${contextVersion || '未识别'}，package=${packageVersion}`);
    }
    if (!contextMarked.includes(`package.json.version：${packageVersion}`)) {
      errors.push('CONTEXT.md 版本标记区没有明确展示 package.json.version。');
    }

    for (const file of scannedFiles) {
      const currentText = stripHistoricalVersionMentions(readText(file));
      if (/当前版本[^\n]*v0\.2\.0|当前版本状态：v0\.2\.0/.test(currentText)) {
        errors.push(`${file} 将 v0.2.0 描述为当前版本。`);
      }
    }

    if (nextStep !== expectedNextStep) {
      errors.push(`NEXT_STEP.md 标记区不是当前唯一下一步：${nextStep}`);
    }
    for (const file of scannedFiles.filter((file) => file !== 'NEXT_STEP.md')) {
      const text = readText(file);
      const nextLines = text.split(/\r?\n/).filter((line) => /当前唯一下一步|下一任务|下一步/.test(line));
      const conflict = nextLines.some((line) => {
        if (/^\s*#/.test(line)) return false;
        if (line.includes('用途：')) return false;
        if (line.includes(expectedNextStep)) return false;
        if (line.includes('电脑环境治理')) return false;
        if (line.includes('NEXT_STEP.md')) return false;
        if (line.includes('新对话交接')) return false;
        if (/不得|不自动|不能|需要继续执行任务/.test(line)) return false;
        if (line.includes('历史')) return false;
        return true;
      });
      if (conflict) {
        errors.push(`${file} 存在与 NEXT_STEP.md 冲突的下一步表述。`);
      }
    }

    const unfinished = ['模型分层', '手机端', '完整多 Agent 调度', '情报流水线', '跨网站复杂执行', '国际化和区域合规'];
    for (const item of unfinished) {
      const donePattern = new RegExp(`(?:已完成|完成|passed)[^\\n。；;]*${item}|${item}[^\\n。；;]*(?:已完成|完成|passed)`);
      const passed = !donePattern.test(capabilityMarked);
      pushCheck(capabilityStatusChecks, `${item} 未标记为已完成`, passed, passed ? '未完成口径正确' : '被标记为已完成');
      if (!passed) errors.push(`CURRENT_PROGRESS_AUDIT.md 将未完成能力标记为已完成：${item}`);
    }

    if (final3a.status !== 'passed') errors.push('verification/3a-final/summary.json 不是 passed。');
    if (managedProxy.status !== 'passed') errors.push('verification/managed-proxy-production/summary.json 不是 passed。');
    if (release.status !== 'passed') errors.push('verification/3b-release/summary.json 不是 passed。');
    if (release.release?.tag !== `v${packageVersion}`) errors.push('Release tag 与 package.json.version 不一致。');
    if (release.release?.isDraft !== false || release.release?.isPrerelease !== true) errors.push('Release 不是公开 prerelease。');
    for (const file of scannedFiles) {
      const text = readText(file);
      if (/③A 总验收/.test(text) && !/③A[^。\n]*passed|③A[^。\n]*已通过|③A 总验收[：：]?passed|③A 总验收.*均已通过/s.test(text)) {
        errors.push(`${file} 的 ③A 状态未与 summary.json passed 保持一致。`);
      }
      if (/③B/.test(text) && !/③B[^。\n]*passed|③B[^。\n]*已通过|③B GitHub Release[：：]?passed|③B GitHub Alpha Release 均已通过/s.test(text)) {
        errors.push(`${file} 的 ③B 状态未与 summary.json passed 保持一致。`);
      }
    }

    const expectedHandoff = renderHandoffFile(handoffText, buildHandoffSnapshot());
    const generatedMatches = expectedHandoff === handoffText;
    handoffGeneratedCheck = {
      status: generatedMatches ? 'passed' : 'failed',
      detail: generatedMatches ? '自动生成区与权威文件一致' : '运行 docs:generate-handoff 后会产生差异',
    };
    handoffIdempotentCheck = {
      status: generatedMatches ? 'passed' : 'failed',
      detail: generatedMatches ? '生成结果幂等稳定' : '生成结果非幂等或未刷新',
    };
    if (!generatedMatches) errors.push('AI-Workbench-Handoff.md 自动生成区不是最新生成结果。');

    const handoffBodyLineCount = handoffMarked.split(/\r?\n/).length;
    if (handoffBodyLineCount > 90) errors.push(`Handoff 自动生成区过长：${handoffBodyLineCount} 行，疑似复制源文档正文。`);
    for (const required of ['当前版本', '当前架构', '当前唯一下一步', 'GPT', 'Claude', 'Codex', '新对话交接方法']) {
      if (!handoffMarked.includes(required)) errors.push(`Handoff 缺少新对话最小上下文：${required}`);
    }

    const secretFindings = scanForSecrets([...scannedFiles, 'scripts/generate-handoff.mjs', 'scripts/verify-docs-consistency.mjs']);
    errors.push(...secretFindings.map((finding) => `疑似敏感信息：${finding}`));

    log.push('文档一致性检查完成。');
  } catch (error) {
    errors.push(`校验脚本执行异常：${error.message}`);
  }

  const overallStatus = errors.length === 0 ? 'passed' : 'failed';
  const summary = {
    overallStatus,
    packageVersion,
    contextVersion,
    releaseVersion,
    nextStep,
    capabilityStatusChecks,
    handoffGeneratedCheck,
    handoffIdempotentCheck,
    scannedFiles,
    ignoredHistoricalPaths,
    errors,
    warnings,
    verifiedAt: new Date().toISOString(),
  };

  const report = [
    '# 文档一致性校验报告',
    '',
    `- 总状态：${overallStatus}`,
    `- package.json.version：${packageVersion}`,
    `- CONTEXT.md 版本：${contextVersion}`,
    `- Release 版本：${releaseVersion}`,
    `- 当前唯一下一步：${nextStep}`,
    `- Handoff 生成校验：${handoffGeneratedCheck.status}`,
    `- Handoff 幂等校验：${handoffIdempotentCheck.status}`,
    '',
    '## 错误',
    ...(errors.length ? errors.map((error) => `- ${error}`) : ['- 无']),
    '',
    '## 警告',
    ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- 无']),
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, 'report.md'), `${report}\n`, 'utf8');
  fs.writeFileSync(path.join(outDir, 'run.log'), `${log.join('\n')}\n`, 'utf8');

  if (overallStatus !== 'passed') {
    console.error(`文档一致性校验失败：发现 ${errors.length} 个问题。`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('文档一致性校验 passed。');
}

main();
