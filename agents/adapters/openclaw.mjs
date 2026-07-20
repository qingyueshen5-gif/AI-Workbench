import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRunId, capabilityMatch } from '../adapter-contract.mjs';

function resolveOpenClawCommand() {
  const appData = process.env.APPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  const cmdPath = join(appData, 'npm', 'openclaw.cmd');
  return existsSync(cmdPath) ? cmdPath : 'openclaw.cmd';
}

function stripAnsi(text) {
  return String(text || '').replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').trim();
}

function truncateText(text, maxLength = 1800) {
  const value = String(text || '');
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n...[truncated]` : value;
}

function runOpenClaw(args, { timeoutMs = 30000, cwd = process.cwd(), onChild } = {}) {
  return new Promise((resolve) => {
    const command = resolveOpenClawCommand();
    const child = spawn('cmd.exe', ['/d', '/s', '/c', command, ...args], {
      cwd,
      windowsHide: true,
      shell: false,
      env: {
        ...process.env,
        NO_COLOR: '1'
      }
    });
    onChild?.(child);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(payload);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.unref();
      } else {
        child.kill();
      }
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.stdin?.destroy();
      child.removeAllListeners('close');
      child.removeAllListeners('error');
      child.unref();
      finish({ ok: false, code: null, stdout, stderr, timedOut, command });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      finish({ ok: false, code: null, stdout, stderr, error, timedOut, command });
    });
    child.on('close', (code) => {
      finish({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut, command });
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkTcpPort(port, host = '127.0.0.1', timeoutMs = 1200) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host, port });
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        durationMs: Date.now() - started,
        ...payload
      });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ ok: true, status: 'listening' }));
    socket.once('timeout', () => finish({ ok: false, status: 'timeout', error: `tcp connect timed out after ${timeoutMs}ms` }));
    socket.once('error', (error) => finish({ ok: false, status: 'closed', error: error.message }));
  });
}

function checkGatewayWebSocket(port = 18789, host = '127.0.0.1', timeoutMs = 1500) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host, port });
    let settled = false;
    let response = '';
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        durationMs: Date.now() - started,
        ...payload
      });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.write([
        'GET / HTTP/1.1',
        `Host: ${host}:${port}`,
        'Connection: Upgrade',
        'Upgrade: websocket',
        'Sec-WebSocket-Version: 13',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        '',
        ''
      ].join('\r\n'));
    });
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      if (/\r?\n\r?\n/.test(response)) {
        const statusLine = response.split(/\r?\n/)[0] || '';
        finish({
          ok: /^HTTP\/1\.[01]\s+101\b/i.test(statusLine),
          status: /^HTTP\/1\.[01]\s+101\b/i.test(statusLine) ? 'connected' : 'rejected',
          responseStatus: statusLine
        });
      }
    });
    socket.once('timeout', () => finish({ ok: false, status: 'timeout', error: `websocket probe timed out after ${timeoutMs}ms` }));
    socket.once('error', (error) => finish({ ok: false, status: 'closed', error: error.message }));
    socket.once('close', () => {
      if (!settled) finish({ ok: false, status: 'closed', error: response ? 'connection closed before websocket upgrade completed' : 'gateway socket closed' });
    });
  });
}

function commandCheck(name, args, { timeoutMs = 5000, parser = null } = {}) {
  return runOpenClaw(args, { timeoutMs }).then((result) => {
    const stdout = stripAnsi(result.stdout);
    const stderr = stripAnsi(result.stderr);
    const parsed = parser ? parser(stdout, stderr, result) : null;
    return {
      name,
      ok: result.ok,
      status: result.ok ? 'available' : (result.timedOut ? 'timeout' : 'unavailable'),
      command: commandEvidence(result.command || resolveOpenClawCommand(), args),
      exitCode: result.code,
      timedOut: result.timedOut,
      stdout: truncateText(stdout, 1200),
      stderr: truncateText(stderr, 800),
      parsed,
      error: result.ok ? '' : (result.error?.message || stderr || stdout || `${name} check failed`)
    };
  });
}

async function collectOpenClawHealthChecks() {
  const command = resolveOpenClawCommand();
  const gatewayPort = 18789;
  const installed = {
    name: 'installed',
    ok: existsSync(command),
    status: existsSync(command) ? 'available' : 'missing',
    shimPath: command,
    error: existsSync(command) ? '' : 'OpenClaw npm shim not found'
  };
  const versionPromise = commandCheck('version', ['--version'], { timeoutMs: 5000 });
  const gatewayPortPromise = checkTcpPort(gatewayPort).then((result) => ({
    name: 'gateway_port',
    port: gatewayPort,
    ...result
  }));
  const gatewayWsPromise = checkGatewayWebSocket(gatewayPort).then((result) => ({
    name: 'gateway_ws',
    port: gatewayPort,
    ...result
  }));
  const channelsPromise = commandCheck('channels', ['channels', 'status', '--probe'], {
    timeoutMs: 6000,
    parser: (stdout) => ({
      gatewayReachable: !/Gateway not reachable/i.test(stdout),
      configOnly: /config-only/i.test(stdout)
    })
  });
  const modelsPromise = commandCheck('models', ['models', 'status', '--probe'], { timeoutMs: 6000 });

  const [version, gateway_port, gateway_ws, channels, models] = await Promise.all([
    versionPromise,
    gatewayPortPromise,
    gatewayWsPromise,
    channelsPromise,
    modelsPromise
  ]);

  await wait(0);
  return {
    installed,
    gateway_port,
    gateway_ws,
    channels,
    models,
    version
  };
}

function parseJsonOutput(stdout) {
  const text = stripAnsi(stdout);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    return null;
  }
}

function commandEvidence(command, args) {
  const base = command.endsWith('openclaw.cmd') ? 'openclaw' : command;
  return [base, ...args].map((arg) => {
    const text = String(arg);
    return /\s/.test(text) ? JSON.stringify(text) : text;
  }).join(' ');
}

function compactContextForPrompt(context) {
  const memories = context?.memories || {};
  return {
    taskContextId: context?.id || '',
    taskId: context?.taskId || '',
    memories: {
      user_preferences: (memories.user_preferences || []).slice(0, 2).map((memory) => memory.key),
      project_context: (memories.project_context || []).slice(0, 3).map((memory) => memory.key),
      task_history: (memories.task_history || []).slice(0, 2).map((memory) => memory.key),
      error_experiences: (memories.error_experiences || []).slice(0, 3).map((memory) => ({
        task: memory.value?.task || memory.key,
        reason: memory.value?.reason || '',
        solution: memory.value?.solution || ''
      }))
    }
  };
}

function createOpenClawPrompt(task, context) {
  const goal = String(task?.userGoal || task?.goal || task?.prompt || task?.title || '').trim();
  const contextSummary = compactContextForPrompt(context);
  return [
    '你是 AI Workbench 的 OpenClaw 员工。',
    '定位：处理长任务编排、浏览器/网页自动化、手机聊天通道、Gateway/Agent/Channel 相关工作。',
    '请真实操作，不要只给建议或链接；回答要短，必须给出可验证结果，例如安装路径、窗口状态、页面证据或失败卡点；不要输出 JSON。',
    '如果失败，先重试一次可恢复步骤；仍失败时说清楚卡在哪、已尝试什么、下一步补救是什么。',
    `任务：${goal}`,
    `上下文摘要：${JSON.stringify(contextSummary)}`
  ].join('\n');
}

function extractReply(parsed, stdout) {
  const payloadText = Array.isArray(parsed?.payloads)
    ? parsed.payloads.map((payload) => payload?.text || '').filter(Boolean).join('\n')
    : '';
  return truncateText(payloadText || parsed?.text || stdout || 'OpenClaw 已完成执行。');
}

export function createOpenClawAdapter(agent) {
  const runs = new Map();
  const processes = new Map();

  return {
    async healthCheck() {
      const checkedAt = new Date().toISOString();
      const checks = await collectOpenClawHealthChecks();
      const versionText = stripAnsi(checks.version.stdout || checks.version.stderr);
      const gatewayAvailable = Boolean(checks.gateway_port.ok && checks.gateway_ws.ok);
      const installedAvailable = Boolean(checks.installed.ok && checks.version.ok);
      const ok = Boolean(installedAvailable && gatewayAvailable);
      const unavailableReasons = Object.values(checks)
        .filter((check) => !check.ok)
        .map((check) => `${check.name}:${check.status || 'failed'}`);
      return {
        agentId: agent.id,
        ok,
        status: ok ? 'available' : 'unavailable',
        checkedAt,
        evidence: {
          command: 'openclaw health split checks: installed, gateway_port, gateway_ws, channels, models, version',
          version: versionText,
          installPath: resolveOpenClawCommand(),
          gateway: {
            port: 18789,
            reachable: gatewayAvailable,
            portStatus: checks.gateway_port.status,
            websocketStatus: checks.gateway_ws.status
          },
          channelSummary: checks.channels.parsed ? [checks.channels.parsed] : [],
          checks,
          unavailableReasons
        },
        error: ok ? null : this.normalizeError(new Error(gatewayAvailable ? unavailableReasons.join(', ') : 'OpenClaw gateway不可达'))
      };
    },

    canHandle(task) {
      return capabilityMatch(agent, task);
    },

    async invoke(task, context = {}) {
      const runId = createRunId(agent.id);
      const goal = String(task?.userGoal || task?.goal || task?.prompt || task?.title || '').trim();
      if (!goal) throw new Error('OpenClaw 执行任务缺少目标');
      const timeoutSeconds = Math.max(10, Math.round(Number(context.timeoutMs || 120000) / 1000));
      const prompt = createOpenClawPrompt(task, context);
      const args = ['agent', '--local', '--json', '--agent', context.openClawAgent || 'main', '--timeout', String(timeoutSeconds), '--message', prompt];
      const command = resolveOpenClawCommand();
      const commandRun = commandEvidence(command, args);
      const startedAt = new Date();
      runs.set(runId, {
        runId,
        agentId: agent.id,
        status: 'running',
        startedAt: startedAt.toISOString(),
        evidence: { commandRun }
      });
      const result = await runOpenClaw(args, {
        timeoutMs: (timeoutSeconds + 15) * 1000,
        cwd: context.cwd || process.cwd(),
        onChild: (child) => processes.set(runId, child)
      });
      processes.delete(runId);
      const finishedAt = new Date();
      const stdout = stripAnsi(result.stdout);
      const stderr = stripAnsi(result.stderr);
      const parsed = parseJsonOutput(stdout);
      const evidence = {
        commandRun,
        stdout: truncateText(stdout, 4000),
        stderr: truncateText(stderr, 2000),
        exitCode: result.code,
        executedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        parsedMeta: parsed?.meta || null
      };

      const normalized = result.ok
        ? {
            runId,
            agentId: agent.id,
            status: 'done',
            output: {
              result: {
                text: extractReply(parsed, stdout),
                taskId: task?.id || ''
              },
              evidence,
              suggestions: []
            },
            evidence,
            suggestions: [],
            finishedAt: finishedAt.toISOString()
          }
        : {
            runId,
            agentId: agent.id,
            status: 'failed',
            output: {
              result: {
                text: extractReply(parsed, stdout),
                taskId: task?.id || ''
              },
              evidence,
              suggestions: []
            },
            error: this.normalizeError(result.error || new Error(stderr || stdout || 'OpenClaw execution failed')),
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
      if (!child) return { runId, agentId: agent.id, cancelled: false, reason: '没有正在运行的 OpenClaw 进程。' };
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
      const hasContract = Boolean(output.result?.text && evidence.commandRun && Number.isInteger(evidence.exitCode) && evidence.executedAt);
      return {
        ok: Boolean(result?.status === 'done' && hasContract && evidence.exitCode === 0),
        evidence,
        message: hasContract ? 'OpenClaw 返回了结构化结果和命令证据。' : 'OpenClaw 输出不符合结构化结果契约。'
      };
    },

    normalizeError(error) {
      const message = error?.message || String(error || 'OpenClaw 调用失败');
      return {
        type: /EPERM|permission|denied|权限/i.test(message) ? 'permission_error' : 'agent_error',
        message: message.includes('ENOENT') ? 'OpenClaw 命令不可用或未加入 PATH' : message,
        retryable: /timeout|timed out|ECONNRESET|502|temporar/i.test(message),
        raw: { message }
      };
    }
  };
}

export const createAdapter = createOpenClawAdapter;
