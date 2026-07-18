import { spawn } from 'node:child_process';
import { copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentRegistry } from '../agents/registry.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = join(root, 'data', 'workbench.json');
const backupFile = join(root, 'data', `workbench.openclaw-backup-${Date.now()}.json`);
const port = 19989;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore'
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/data`);
      if (response.ok) return;
    } catch {}
    await wait(150);
  }
  throw new Error('server did not start');
}

async function request(path, method = 'GET', payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `${path} failed`);
  return body;
}

async function ask(content, conversationId = `openclaw-verify-${Date.now()}`) {
  return request('/api/chat-message', 'POST', { content, conversationId });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (existsSync(dataFile)) await copyFile(dataFile, backupFile);
  try {
    await waitForServer();

    const health = await agentRegistry.healthCheck('openclaw');
    assert(health.ok && health.status === 'available', 'OpenClaw healthCheck failed');
    assert(/OpenClaw/.test(health.evidence?.version || ''), 'OpenClaw health evidence missing version');

    const directTask = {
      id: 'verify-openclaw-direct',
      title: 'OpenClaw 直接执行测试',
      userGoal: '请用一句中文回答：OpenClaw 直接执行成功。',
      requiredCapabilities: ['orchestration']
    };
    const direct = await agentRegistry.invoke('openclaw', directTask, {
      cwd: root,
      timeoutMs: 90000,
      openClawAgent: 'main'
    });
    const directVerification = agentRegistry.verify('openclaw', direct);
    assert(directVerification.ok, 'OpenClaw direct invoke did not verify');
    assert(direct.output?.result?.text, 'OpenClaw direct invoke missing text result');

    const deepseek = await ask('请用一句话总结：今天验证 DeepSeek 路由。', 'route-deepseek');
    assert(deepseek.routedAgentId === 'deepseek' || deepseek.applied || deepseek.suggestions, 'DeepSeek route did not complete');
    const hermes = await ask('请 Hermes 做一次终端路由测试，只用一句话回复 Hermes 路由已命中。', 'route-hermes');
    assert(hermes.routedAgentId === 'hermes', 'Hermes route did not select Hermes');
    const openclaw = await ask('请 OpenClaw 做一个浏览器自动化编排测试，只用一句话回复已完成测试。', 'route-openclaw');
    assert(openclaw.routedAgentId === 'openclaw', 'OpenClaw route did not select OpenClaw');
    const openclawRun = openclaw.data.runs.find((run) => run.id === openclaw.runId);
    assert(openclawRun?.output?.evidence?.commandRun && openclawRun?.verified, 'OpenClaw chat result missing structured evidence');

    console.log(JSON.stringify({
      health: {
        ok: health.ok,
        status: health.status,
        version: health.evidence.version,
        installPath: health.evidence.installPath,
        channelSummary: health.evidence.channelSummary,
        gatewayReachable: health.evidence.gateway?.reachable
      },
      directInvoke: {
        status: direct.status,
        text: direct.output.result.text,
        evidence: {
          commandRun: direct.output.evidence.commandRun,
          exitCode: direct.output.evidence.exitCode,
          durationMs: direct.output.evidence.durationMs
        },
        verified: directVerification.ok
      },
      routing: {
        deepseek: deepseek.routedAgentId || 'deepseek',
        hermes: hermes.routedAgentId,
        openclaw: openclaw.routedAgentId,
        openclawEvidence: {
          commandRun: openclawRun.output.evidence.commandRun,
          exitCode: openclawRun.output.evidence.exitCode,
          durationMs: openclawRun.output.evidence.durationMs
        }
      }
    }, null, 2));
  } finally {
    server.kill();
    await wait(150);
    if (existsSync(backupFile)) {
      await copyFile(backupFile, dataFile);
      await rm(backupFile, { force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
