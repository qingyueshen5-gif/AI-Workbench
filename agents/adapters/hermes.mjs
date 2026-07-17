import { spawn } from 'node:child_process';
import { createRunId, capabilityMatch } from '../adapter-contract.mjs';

function runCommand(command, args, { timeoutMs = 30000, cwd = process.cwd() } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      env: {
        ...process.env,
        HERMES_GIT_BASH_PATH: process.env.HERMES_GIT_BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe'
      }
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, code: null, stdout, stderr, error, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut });
    });
  });
}

function stripAnsi(text) {
  return String(text || '').replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').trim();
}

export function createHermesAdapter(agent) {
  const runs = new Map();

  return {
    async healthCheck() {
      const checkedAt = new Date().toISOString();
      const result = await runCommand('hermes', ['--version'], { timeoutMs: 30000 });
      if (result.ok) {
        return {
          agentId: agent.id,
          ok: true,
          status: 'available',
          checkedAt,
          evidence: {
            command: 'hermes --version',
            output: stripAnsi(result.stdout || result.stderr)
          }
        };
      }
      return {
        agentId: agent.id,
        ok: false,
        status: 'unavailable',
        checkedAt,
        error: this.normalizeError(result.error || new Error(result.stderr || result.stdout || 'Hermes health check failed'))
      };
    },

    canHandle(task) {
      return capabilityMatch(agent, task);
    },

    async execute(task, context = {}) {
      const runId = createRunId(agent.id);
      const prompt = String(task?.prompt || task?.goal || task?.title || '').trim();
      if (!prompt) throw new Error('Hermes 执行任务缺少 prompt');
      const toolsets = String(context.toolsets || 'memory,terminal');
      const result = await runCommand('hermes', ['chat', '-q', prompt, '--toolsets', toolsets], {
        timeoutMs: context.timeoutMs || 120000,
        cwd: context.cwd || process.cwd()
      });

      const normalized = result.ok
        ? {
            runId,
            agentId: agent.id,
            status: 'done',
            output: stripAnsi(result.stdout),
            evidence: {
              command: `hermes chat -q "<task>" --toolsets ${toolsets}`,
              exitCode: result.code
            },
            finishedAt: new Date().toISOString()
          }
        : {
            runId,
            agentId: agent.id,
            status: 'failed',
            output: stripAnsi(result.stdout),
            error: this.normalizeError(result.error || new Error(result.stderr || result.stdout || 'Hermes execution failed')),
            evidence: {
              command: `hermes chat -q "<task>" --toolsets ${toolsets}`,
              exitCode: result.code,
              timedOut: result.timedOut
            },
            finishedAt: new Date().toISOString()
          };
      runs.set(runId, normalized);
      return normalized;
    },

    async status(runId) {
      return runs.get(runId) || { runId, agentId: agent.id, status: 'unknown' };
    },

    async cancel(runId) {
      return { runId, agentId: agent.id, cancelled: false, reason: 'Hermes 当前通过短任务 CLI 调用，未保留可取消的后台 run。' };
    },

    verify(result) {
      return {
        ok: Boolean(result?.status === 'done' && result.evidence?.command && result.evidence?.exitCode === 0),
        evidence: result?.evidence || {},
        message: result?.status === 'done' ? 'Hermes 返回了 CLI 输出和退出码证据。' : 'Hermes 未返回可验证的完成结果。'
      };
    },

    normalizeError(error) {
      const message = error?.message || String(error || 'Hermes 调用失败');
      return {
        type: 'agent_error',
        message: message.includes('ENOENT') ? 'Hermes 命令不可用或未加入 PATH' : message,
        retryable: /timeout|timed out|ECONNRESET|502|temporar/i.test(message),
        raw: {
          message
        }
      };
    }
  };
}

export const createAdapter = createHermesAdapter;
