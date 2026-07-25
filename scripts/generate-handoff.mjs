import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();

const files = {
  packageJson: 'package.json',
  nextStep: 'NEXT_STEP.md',
  capability: 'CURRENT_PROGRESS_AUDIT.md',
  product: 'PRODUCT.md',
  vision: 'VISION.md',
  principles: 'PRINCIPLES.md',
  decisions: 'DECISIONS.md',
  release: 'verification/3b-release/summary.json',
  handoff: 'AI-Workbench-Handoff.md',
};

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
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

function firstMatchingLines(text, terms, maxLines) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') && terms.some((term) => line.includes(term)));
  return [...new Set(lines)].slice(0, maxLines);
}

function summarizeCapabilities(markedText, heading, maxLines = 12) {
  const match = markedText.match(new RegExp(`${heading}：\\s*([\\s\\S]*?)(?:\\n\\n[^\\n]+：|$)`));
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .slice(0, maxLines);
}

export function buildHandoffSnapshot() {
  const packageJson = readJson(files.packageJson);
  const nextStep = extractMarked(readText(files.nextStep), 'AIW_NEXT_STEP');
  const capabilityMarked = extractMarked(readText(files.capability), 'AIW_CAPABILITY_STATUS');
  const product = readText(files.product);
  const vision = readText(files.vision);
  const principles = readText(files.principles);
  const decisions = readText(files.decisions);
  const release = readJson(files.release);

  const done = summarizeCapabilities(capabilityMarked, '已完成', 10);
  const notDone = summarizeCapabilities(capabilityMarked, '未完成', 20);
  const directionHints = [
    ...firstMatchingLines(product, ['一个输入框', '长期用户范围', '产品价值'], 3),
    ...firstMatchingLines(vision, ['质量基线', '状态差', '状态正常', '很强', '全球'], 3),
    ...firstMatchingLines(principles, ['高质量', '真实完成', '低损耗', '透明'], 3),
    ...firstMatchingLines(decisions, ['借用生态', '跨平台执行边界', '用户状态波动补偿'], 3),
  ].slice(0, 8);

  const releaseUrl = release.release?.url ?? '';
  const assetUrl = release.assets?.installer?.url ?? '';
  const releaseVersion = release.release?.tag ?? `v${packageJson.version}`;

  return `快照来源时间：${release.generatedAt ?? release.release?.publishedAt ?? 'unknown'}

## 项目是什么

AI Workbench 是一个面向普通人和专业人的 Windows 桌面 AI 工作台，也是模型与 Agent 无关的调度框架。用户只通过一个输入框表达目标，工作台负责上下文读取、任务拆解、模型和工具调用、质量检查、失败恢复、证据留存和最终交付。

长期方向是全球产品，不只服务某一个国家或地区；不同语言、模型、平台规则和合规差异由后台逐步适配。

## 当前版本与公开 Release

- 当前版本：${releaseVersion} Alpha（package.json version ${packageJson.version}）
- Release 页面：${releaseUrl}
- 安装包下载：${assetUrl}
- Release 状态：${release.release?.isDraft === false ? 'public' : 'draft'} / ${release.release?.isPrerelease ? 'prerelease' : 'release'}
- 安装包大小：${release.assets?.installer?.sizeBytes} bytes
- SHA256：${release.assets?.installer?.sha256}

## 当前架构

Workbench / Hermes / OpenClaw -> 127.0.0.1:18800 -> AI Workbench provider-aware Managed Proxy -> 当前生产 provider

DeepSeek 是当前唯一已接入的生产实现，属于可替换的实现细节，不是产品定位。真实 DeepSeek Key 只存在 Cloudflare Secret，不进入安装包、用户电脑、前端、员工配置或公开仓库。

## 已完成能力摘要

${done.join('\n')}

## 未完成能力摘要

${notDone.join('\n')}

## 当前唯一下一步

${nextStep}

不得自动上传或部署新 Worker version、发起新的真实模型调用、电脑清理、首屏示例、反馈入口、安全告知、真实用户测试、模型分层、上下文压缩、手机端、情报流水线或任何新功能开发，除非产品负责人明确批准对应任务。

## 产品方向要点

${directionHints.join('\n')}

## 产品负责人、Claude、GPT、Codex 分工

- 产品负责人：定产品方向、定优先级、决定是否改变当前唯一任务、接受或拒绝风险、最终拍板阶段是否通过。
- Claude：帮助产品负责人梳理想法并结构化，从产品角度把关，对完整产品阶段基于 GitHub 可访问证据做独立验收并给出 PASS / CONDITIONAL_PASS / BLOCKED；不声称访问无权访问的本地或生产环境。
- GPT：统一跨对话上下文、判断当前唯一任务、防止任务线漂移、把产品负责人决定转化为完整有边界的 Codex 指令，并根据 Codex 回报帮助理解进度；不替代最终拍板。
- Codex：在授权范围内执行，修改代码或文档，运行测试，检查基线，发现基线冲突、证据不足或风险时停止，生成 verification，commit + push，如实汇报 passed / failed / blocked；不自行宣布完整产品阶段最终通过。

## 新对话交接方法

- 普通新对话：提供 AI-Workbench-Handoff.md、NEXT_STEP.md、THINKING.md、PRINCIPLES.md 和 GROWTH_LOG.md。
- 新对话如需理解决策背景，应阅读 THINKING.md、PRINCIPLES.md 和 GROWTH_LOG.md。
- 需要判断某项验收：再提供对应 verification/<task>/summary.json、report.md、必要的 commands.log、对应 commit 和 Git diff。
- 新对话不需要默认读取全部 verification 目录，只有当前任务相关证据才需要增加。
- 对方无法访问本机仓库时，必须提供文件内容或 GitHub 链接，不能只给本地路径。
- 任何新决策、任务结论和验收结果都必须回写仓库，不得只留在聊天里。`;
}

export function renderHandoffFile(existingText, snapshot) {
  const start = '<!-- AIW_GENERATED_HANDOFF_START -->';
  const end = '<!-- AIW_GENERATED_HANDOFF_END -->';
  const startIndex = existingText.indexOf(start);
  const endIndex = existingText.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('AI-Workbench-Handoff.md 缺少 AIW_GENERATED_HANDOFF 标记区');
  }
  return `${existingText.slice(0, startIndex + start.length)}\n${snapshot}\n${existingText.slice(endIndex)}`;
}

function main() {
  const handoffPath = path.join(root, files.handoff);
  const current = readText(files.handoff);
  const next = renderHandoffFile(current, buildHandoffSnapshot());
  fs.writeFileSync(handoffPath, next, 'utf8');
  console.log('已生成 AI-Workbench-Handoff.md 自动交接快照。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
