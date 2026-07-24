import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

不得自动部署生产钱包刹车、执行远端 D1 migration、进入第 3B 段、电脑清理、首屏示例、反馈入口、安全告知、真实用户测试、模型分层、上下文压缩、手机端、情报流水线或任何新功能开发，除非产品负责人明确批准对应任务。

## 产品方向要点

${directionHints.join('\n')}

## GPT、Claude、Codex 分工

- GPT：产品方向、路线规划、任务拆分和验收结果复核。
- Claude：口头想法结构化、代码调试、Review 和日常执行协调。
- Codex：读取仓库、执行代码/文档修改、运行验证、生成证据、commit + push 和真实汇报。

## 新对话交接方法

- 普通新对话：提供 AI-Workbench-Handoff.md、NEXT_STEP.md 和 THINKING.md。
- 新对话如需理解决策背景，应阅读 THINKING.md。
- 需要判断某项验收：再提供对应 verification/<task>/summary.json。
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
