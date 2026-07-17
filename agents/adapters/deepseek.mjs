import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRunId, capabilityMatch } from '../adapter-contract.mjs';

const root = process.cwd();
const envFile = join(root, '.env');
const deepSeekBaseUrl = 'https://api.deepseek.com';

function loadLocalEnv() {
  try {
    const raw = readFileSync(envFile, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function getApiKey() {
  loadLocalEnv();
  return String(process.env.DEEPSEEK_API_KEY || '').trim();
}

function describeDeepSeekError(statusCode, payload) {
  const message = payload?.error?.message || payload?.message || '';
  const code = payload?.error?.code || '';
  if (statusCode === 401) return 'DeepSeek API Key 无效或无权限';
  if (statusCode === 403) return 'DeepSeek API Key 权限不足';
  if (statusCode === 408) return 'DeepSeek 网络超时';
  if (statusCode === 429 && (code === 'insufficient_quota' || message.includes('quota'))) return 'DeepSeek 余额不足或额度已用尽';
  if (statusCode === 429) return 'DeepSeek 请求过于频繁或额度受限';
  if (statusCode >= 500) return 'DeepSeek 服务暂时不可用';
  return message || `DeepSeek API 返回错误 ${statusCode}`;
}

async function callDeepSeek({ model = 'deepseek-chat', messages, timeoutMs = 20000 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('DeepSeek API Key 未配置');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(describeDeepSeekError(response.status, payload));
      error.statusCode = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('DeepSeek 网络超时');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createDeepSeekAdapter(agent) {
  const runs = new Map();

  return {
    async healthCheck() {
      const checkedAt = new Date().toISOString();
      try {
        const payload = await callDeepSeek({
          messages: [{ role: 'user', content: 'Reply with OK.' }],
          timeoutMs: 20000
        });
        const content = payload.choices?.[0]?.message?.content || '';
        return {
          agentId: agent.id,
          ok: true,
          status: 'available',
          checkedAt,
          evidence: {
            provider: 'DeepSeek',
            model: payload.model || 'deepseek-chat',
            reply: content.trim()
          }
        };
      } catch (error) {
        return {
          agentId: agent.id,
          ok: false,
          status: 'unavailable',
          checkedAt,
          error: this.normalizeError(error)
        };
      }
    },

    canHandle(task) {
      return capabilityMatch(agent, task);
    },

    async execute(task, context = {}) {
      const runId = createRunId(agent.id);
      const prompt = String(task?.prompt || task?.goal || task?.title || '').trim();
      if (!prompt) throw new Error('DeepSeek 执行任务缺少 prompt');
      try {
        const payload = await callDeepSeek({
          model: context.model || 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是 AI Workbench 的模型员工。请简洁完成任务，并给出可验证摘要。' },
            { role: 'user', content: prompt }
          ],
          timeoutMs: context.timeoutMs || 30000
        });
        const output = payload.choices?.[0]?.message?.content || '';
        const result = {
          runId,
          agentId: agent.id,
          status: 'done',
          output,
          evidence: {
            provider: 'DeepSeek',
            model: payload.model || context.model || 'deepseek-chat',
            responseId: payload.id || ''
          },
          finishedAt: new Date().toISOString()
        };
        runs.set(runId, result);
        return result;
      } catch (error) {
        const result = {
          runId,
          agentId: agent.id,
          status: 'failed',
          error: this.normalizeError(error),
          finishedAt: new Date().toISOString()
        };
        runs.set(runId, result);
        return result;
      }
    },

    async status(runId) {
      return runs.get(runId) || { runId, agentId: agent.id, status: 'unknown' };
    },

    async cancel(runId) {
      return { runId, agentId: agent.id, cancelled: false, reason: 'DeepSeek 当前执行为短连接请求，无常驻任务可取消。' };
    },

    verify(result) {
      return {
        ok: Boolean(result?.status === 'done' && result.output && result.evidence?.model),
        evidence: result?.evidence || {},
        message: result?.status === 'done' ? 'DeepSeek 返回了模型输出和模型证据。' : 'DeepSeek 未返回可验证的完成结果。'
      };
    },

    normalizeError(error) {
      return {
        type: 'model_error',
        message: error?.message || 'DeepSeek 调用失败',
        retryable: ['DeepSeek 网络超时', 'DeepSeek 服务暂时不可用'].includes(error?.message),
        raw: {
          statusCode: error?.statusCode || null
        }
      };
    }
  };
}

export const createAdapter = createDeepSeekAdapter;
