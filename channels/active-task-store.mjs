import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { runtimeRoot } from '../runtime-paths.mjs';

const defaultRoot = process.env.AIW_ACTIVE_TASK_DIR || join(runtimeRoot, 'feishu-workbench-bridge', 'active-tasks');
const key = (id) => createHash('sha256').update(String(id || 'unknown')).digest('hex').slice(0, 24);
const terminalStages = new Set(['completed', 'failed']);

export class ActiveTaskStore {
  constructor(options = {}) { this.root = options.root || defaultRoot; }
  path(conversationId) { return join(this.root, `${key(conversationId)}.json`); }
  async load(conversationId) {
    try { return JSON.parse(await fs.readFile(this.path(conversationId), 'utf8')); } catch { return null; }
  }
  async save(task) {
    if (!task?.conversationId) throw new Error('active task conversationId is required');
    const path = this.path(task.conversationId);
    await fs.mkdir(dirname(path), { recursive: true });
    const next = { ...task, updatedAt: Date.now() };
    const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await fs.rename(tmp, path);
    return next;
  }
  async create(job) {
    const now = Date.now();
    return this.save({
      activeTaskId: job.activeTaskId || job.messageId,
      conversationId: job.conversationId || job.chatId,
      originalMessageId: job.originalMessageId || job.messageId,
      originalUserGoal: job.text,
      effectiveUserGoal: job.text,
      stage: 'accepted',
      currentStep: '任务已接收，等待理解',
      completedSteps: [],
      currentActor: 'AI Workbench',
      startedAt: now,
      lastProgressAt: now,
      toolResults: [],
      paused: false,
      waitingUser: false,
      estimatedRemainingRange: '当前正在准备处理，完成后会直接回复你。',
      latestFailureReason: '',
      supplementalInstructions: [],
      cancelled: false
    });
  }
  async update(conversationId, patch) {
    const current = await this.load(conversationId);
    if (!current) return null;
    return this.save({ ...current, ...patch, conversationId, lastProgressAt: patch.lastProgressAt || Date.now() });
  }
  async addCompletedStep(conversationId, step) {
    const current = await this.load(conversationId);
    if (!current) return null;
    const completedSteps = [...new Set([...(current.completedSteps || []), step].filter(Boolean))];
    return this.save({ ...current, completedSteps, lastProgressAt: Date.now() });
  }
  async addToolResult(conversationId, result) {
    const current = await this.load(conversationId);
    if (!current) return null;
    return this.save({ ...current, toolResults: [...(current.toolResults || []), result].slice(-10), lastProgressAt: Date.now() });
  }
  async active(conversationId) {
    const task = await this.load(conversationId);
    return task && !terminalStages.has(task.stage) && !task.cancelled ? task : null;
  }
  async list() {
    await fs.mkdir(this.root, { recursive: true });
    const tasks = [];
    for (const name of (await fs.readdir(this.root)).filter((item) => item.endsWith('.json'))) {
      try { tasks.push(JSON.parse(await fs.readFile(join(this.root, name), 'utf8'))); } catch {}
    }
    return tasks;
  }
}

export function activeTaskSummary(task) {
  if (!task) return '当前没有运行中的任务。';
  return [
    `任务目标：${task.effectiveUserGoal || task.originalUserGoal}`,
    `当前阶段：${task.stage}`,
    `当前步骤：${task.currentStep || '未记录'}`,
    `已完成步骤：${(task.completedSteps || []).join('；') || '暂无'}`,
    `当前执行方：${task.currentActor || 'AI Workbench'}`,
    `已有工具结果：${(task.toolResults || []).map((item) => item.summary || item.text || '').filter(Boolean).join('；') || '暂无'}`,
    `暂停：${task.paused ? '是' : '否'}`,
    `等待用户：${task.waitingUser ? '是' : '否'}`,
    `预计剩余：${task.estimatedRemainingRange || '无法准确估算'}`,
    `最近失败原因：${task.latestFailureReason || '无'}`
  ].join('\n');
}
