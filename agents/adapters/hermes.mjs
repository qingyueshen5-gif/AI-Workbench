import { spawn } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRunId, capabilityMatch } from '../adapter-contract.mjs';

const modelProxyBaseUrl = String(process.env.MODEL_PROXY_BASE_URL || 'http://127.0.0.1:18800/v1').replace(/\/+$/, '');
const hermesLocalToken = 'aiw.hermes.local';

function patchHermesConfig(configPath) {
  let config = '';
  if (existsSync(configPath)) {
    config = readFileSync(configPath, 'utf8');
  }
  const modelBlock = [
    'model:',
    '  provider: custom',
    `  base_url: ${modelProxyBaseUrl}`,
    '  default: deepseek-chat',
    `  api_key: ${hermesLocalToken}`
  ].join('\n');
  if (/^model:\s*\r?\n(?:^[ \t].*\r?\n?)*/m.test(config)) {
    config = config.replace(/^model:\s*\r?\n(?:^[ \t].*\r?\n?)*/m, `${modelBlock}\n`);
  } else {
    config = `${modelBlock}\n${config}`;
  }
  writeFileSync(configPath, config, 'utf8');
}

function writeHermesEnv(envPath) {
  writeFileSync(envPath, [
    `OPENAI_BASE_URL=${modelProxyBaseUrl}`,
    `OPENAI_API_KEY=${hermesLocalToken}`,
    `DEEPSEEK_API_KEY=${hermesLocalToken}`,
    ''
  ].join('\n'), 'utf8');
}

function prepareHermesHome(cwd) {
  const runtimeHome = join(cwd, '.hermes-runtime');
  const sourceHome = process.env.HERMES_SOURCE_HOME || join(process.env.LOCALAPPDATA || '', 'hermes');
  mkdirSync(runtimeHome, { recursive: true });
  for (const dir of ['logs', 'sessions', 'memories', 'skills', 'cache', 'sandboxes', 'cron']) {
    mkdirSync(join(runtimeHome, dir), { recursive: true });
  }
  for (const fileName of ['config.yaml', 'auth.json', 'SOUL.md']) {
    const source = join(sourceHome, fileName);
    const target = join(runtimeHome, fileName);
    if (existsSync(source) && !existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
  }
  for (const dirName of ['memories', 'skills']) {
    const source = join(sourceHome, dirName);
    const target = join(runtimeHome, dirName);
    if (existsSync(source)) {
      cpSync(source, target, { recursive: true, force: false });
    }
  }
  patchHermesConfig(join(runtimeHome, 'config.yaml'));
  writeHermesEnv(join(runtimeHome, '.env'));
  return runtimeHome;
}

function runCommand(command, args, { timeoutMs = 30000, cwd = process.cwd(), onChild } = {}) {
  return new Promise((resolve) => {
    const hermesHome = prepareHermesHome(cwd);
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      env: {
        ...process.env,
        HERMES_HOME: hermesHome,
        OPENAI_BASE_URL: modelProxyBaseUrl,
        OPENAI_API_KEY: hermesLocalToken,
        DEEPSEEK_API_KEY: hermesLocalToken,
        HERMES_GIT_BASH_PATH: process.env.HERMES_GIT_BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe'
      }
    });
    onChild?.(child);
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

function jsonForPrompt(value) {
  return JSON.stringify(value || {}, null, 2);
}

function truncateText(text, maxLength = 1600) {
  const value = String(text || '');
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n...[truncated]` : value;
}

function compactMemory(memory) {
  return {
    id: memory?.id,
    type: memory?.type,
    key: memory?.key,
    summary: typeof memory?.value === 'object'
      ? (memory.value.summary || memory.value.file || memory.key)
      : truncateText(memory?.value, 160),
    source: memory?.source,
    confidence: memory?.confidence
  };
}

function compactContextForPrompt(context) {
  const memories = context?.memories || {};
  return {
    id: context?.id,
    taskId: context?.taskId,
    generatedAt: context?.generatedAt,
    policy: context?.policy,
    task: context?.task,
    memories: {
      user_preferences: (memories.user_preferences || []).slice(0, 3).map(compactMemory),
      project_context: (memories.project_context || []).slice(0, 4).map(compactMemory),
      task_history: (memories.task_history || []).slice(0, 3).map(compactMemory),
      error_experiences: (memories.error_experiences || []).slice(0, 3).map(compactMemory)
    },
    recentRuns: (context?.recentRuns || []).slice(0, 3)
  };
}

function createHermesPrompt(task, context) {
  const goal = String(task?.userGoal || task?.goal || task?.prompt || task?.title || '').trim();
  const compactContext = compactContextForPrompt(context);
  const memoryKeys = Object.entries(compactContext.memories || {})
    .flatMap(([type, memories]) => (memories || []).map((memory) => `${type}:${memory.key}`))
    .slice(0, 12);
  return [
    '你是AI Workbench的Hermes员工。完成任务，中文回答。',
    '规则：只能读工作台给的上下文；不能写长期记忆；如有记忆建议只写memory_suggestions，没有就写memory_suggestions: []。',
    `task_context_id: ${compactContext.id || ''}`,
    `memory_keys: ${memoryKeys.join(', ') || 'none'}`,
    '工作区路径: F:/AI-Workbench',
    `任务: ${goal}`,
    '请用terminal读取需要的文件，并总结当前待办。'
  ].join('\n');
}

function createCommandEvidence(args) {
  return `hermes ${args.map((arg) => {
    const text = String(arg);
    return /\s/.test(text) ? JSON.stringify(text) : text;
  }).join(' ')}`;
}

function parseMemorySuggestions(stdout) {
  const match = String(stdout || '').match(/memory_suggestions\s*:\s*(\[[\s\S]*?\])\s*$/i);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createHermesAdapter(agent) {
  const runs = new Map();
  const processes = new Map();

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

    async invoke(task, context = {}) {
      const runId = createRunId(agent.id);
      const prompt = createHermesPrompt(task, context);
      if (!String(task?.userGoal || task?.prompt || task?.goal || task?.title || '').trim()) {
        throw new Error('Hermes 执行任务缺少目标');
      }
      const toolsets = String(context.toolsets || 'memory,terminal');
      const provider = String(context.provider || 'custom');
      const model = String(context.model || 'deepseek-chat');
      const args = ['chat', '-q', prompt, '--provider', provider, '-m', model, '--toolsets', toolsets];
      const commandRun = createCommandEvidence(args);
      const startedAt = new Date();
      runs.set(runId, {
        runId,
        agentId: agent.id,
        status: 'running',
        startedAt: startedAt.toISOString(),
        evidence: { commandRun }
      });
      const result = await runCommand('hermes', args, {
        timeoutMs: context.timeoutMs || 180000,
        cwd: context.cwd || process.cwd(),
        onChild: (child) => processes.set(runId, child)
      });
      processes.delete(runId);
      const finishedAt = new Date();
      const stdout = stripAnsi(result.stdout);
      const stderr = stripAnsi(result.stderr);
      const evidence = {
        commandRun,
        stdout,
        stderr,
        exitCode: result.code,
        executedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
      };

      const normalized = result.ok
        ? {
            runId,
            agentId: agent.id,
            status: 'done',
            output: {
              result: {
                text: stdout,
                taskId: task?.id || ''
              },
              evidence,
              suggestions: parseMemorySuggestions(stdout)
            },
            evidence,
            suggestions: parseMemorySuggestions(stdout),
            finishedAt: finishedAt.toISOString()
          }
        : {
            runId,
            agentId: agent.id,
            status: 'failed',
            output: {
              result: {
                text: stdout,
                taskId: task?.id || ''
              },
              evidence,
              suggestions: []
            },
            error: this.normalizeError(result.error || new Error(stderr || stdout || 'Hermes execution failed')),
            evidence: { ...evidence, timedOut: result.timedOut },
            suggestions: [],
            finishedAt: finishedAt.toISOString()
          };
      runs.set(runId, normalized);
      return normalized;
    },

    execute(task, context = {}) {
      return this.invoke(task, context);
    },

    async status(runId) {
      return runs.get(runId) || { runId, agentId: agent.id, status: 'unknown' };
    },

    async cancel(runId) {
      const child = processes.get(runId);
      if (!child) return { runId, agentId: agent.id, cancelled: false, reason: '没有正在运行的 Hermes 进程。' };
      child.kill();
      processes.delete(runId);
      const current = runs.get(runId) || {};
      const cancelled = { ...current, runId, agentId: agent.id, status: 'cancelled', finishedAt: new Date().toISOString() };
      runs.set(runId, cancelled);
      return { runId, agentId: agent.id, cancelled: true };
    },

    verify(result) {
      const output = result?.output || {};
      const evidence = output.evidence || result?.evidence || {};
      const combinedOutput = `${evidence.stdout || ''}\n${evidence.stderr || ''}`;
      const hasContract = Boolean(output.result && evidence.commandRun && Number.isInteger(evidence.exitCode) && evidence.executedAt);
      const hasModelFailure = /API call failed after \d+ retries|Final error:|HTTP 502: Error code/i.test(combinedOutput);
      return {
        ok: Boolean(result?.status === 'done' && hasContract && evidence.exitCode === 0 && !hasModelFailure),
        evidence,
        message: hasModelFailure
          ? 'Hermes 命令返回了模型调用失败信息。'
          : (hasContract ? 'Hermes 返回了结构化结果和完整命令证据。' : 'Hermes 输出不符合结构化结果契约。')
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
