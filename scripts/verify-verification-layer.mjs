import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 19881;
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', (chunk) => {
  output += chunk;
});
server.stderr.on('data', (chunk) => {
  output += chunk;
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, method = 'GET', payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.json();
  return { response, body };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const { response } = await request('/api/data');
      if (response.ok) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error(`API server did not start.\n${output}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createRunScenario(name, runPayload) {
  const taskResponse = await request('/api/tasks', 'POST', {
    userGoal: name,
    title: name,
    assignedAgentId: 'hermes',
    evidenceRequired: ['hermes_command', 'stdout', 'stderr', 'exit_code']
  });
  assert(taskResponse.response.status === 201, `Task create failed: ${taskResponse.body.error || taskResponse.response.status}`);
  const runResponse = await request('/api/runs', 'POST', {
    taskId: taskResponse.body.task.id,
    agentId: 'hermes',
    status: 'done',
    ...runPayload
  });
  assert(runResponse.response.status === 201, `Run create failed: ${runResponse.body.error || runResponse.response.status}`);
  const verificationResponse = await request(`/api/runs/${encodeURIComponent(runResponse.body.run.id)}/verify`, 'POST');
  assert(verificationResponse.response.ok, `Verify failed: ${verificationResponse.body.error || verificationResponse.response.status}`);
  return {
    task: taskResponse.body.task,
    beforeVerify: runResponse.body.run,
    verification: verificationResponse.body.verification,
    afterVerify: verificationResponse.body.run
  };
}

async function main() {
  await waitForServer();

  const rules = await request('/api/verification-rules');
  assert(rules.response.ok && Array.isArray(rules.body.rules), 'Verification rules endpoint failed');

  const success = await createRunScenario('成功场景：Hermes 读取文件成功', {
    output: {
      result: {
        text: '已读取 CURRENT_TASK.md，并总结出当前待办：运行 hermes setup、补齐 API keys、评估部署方案。'
      },
      evidence: {
        commandRun: 'hermes chat -q "读取 F:/AI-Workbench/CURRENT_TASK.md" --provider custom -m deepseek-chat --toolsets memory,terminal',
        stdout: 'cat "F:/AI-Workbench/CURRENT_TASK.md"\n当前待办：hermes setup；补齐 API keys；评估部署方案。',
        stderr: '',
        exitCode: 0,
        executedAt: new Date().toISOString(),
        durationMs: 1234
      },
      suggestions: []
    },
    evidence: {
      commandRun: 'hermes chat -q "读取 F:/AI-Workbench/CURRENT_TASK.md" --provider custom -m deepseek-chat --toolsets memory,terminal',
      stdout: 'cat "F:/AI-Workbench/CURRENT_TASK.md"\n当前待办：hermes setup；补齐 API keys；评估部署方案。',
      stderr: '',
      exitCode: 0,
      executedAt: new Date().toISOString(),
      durationMs: 1234
    }
  });
  assert(success.verification.ok === true, 'Success scenario should verify');
  assert(success.afterVerify.verified === true, 'Success scenario should set verified=true');

  const fakeDone = await createRunScenario('假完成场景：员工说做完但没有证据', {
    output: {
      result: { text: '我做完了。' },
      evidence: {},
      suggestions: []
    },
    evidence: {}
  });
  assert(fakeDone.verification.ok === false, 'Fake-done scenario should fail');
  assert(fakeDone.verification.reason === 'missing_evidence', 'Fake-done reason should be missing_evidence');
  assert(fakeDone.afterVerify.verified === false, 'Fake-done should set verified=false');

  const executionFailed = await createRunScenario('执行失败场景：Hermes 命令报错', {
    status: 'failed',
    output: {
      result: { text: '读取失败。' },
      evidence: {
        commandRun: 'hermes chat -q "读取 F:/AI-Workbench/MISSING.md" --provider custom -m deepseek-chat --toolsets memory,terminal',
        stdout: '',
        stderr: 'cat: F:/AI-Workbench/MISSING.md: No such file or directory',
        exitCode: 1,
        executedAt: new Date().toISOString(),
        durationMs: 456
      },
      suggestions: []
    },
    evidence: {
      commandRun: 'hermes chat -q "读取 F:/AI-Workbench/MISSING.md" --provider custom -m deepseek-chat --toolsets memory,terminal',
      stdout: '',
      stderr: 'cat: F:/AI-Workbench/MISSING.md: No such file or directory',
      exitCode: 1,
      executedAt: new Date().toISOString(),
      durationMs: 456
    }
  });
  assert(executionFailed.verification.ok === false, 'Execution-failed scenario should fail');
  assert(executionFailed.verification.reason === 'execution_failed', 'Execution-failed reason should be execution_failed');
  assert(executionFailed.afterVerify.verified === false, 'Execution-failed should set verified=false');

  console.log(JSON.stringify({
    rules: rules.body.rules,
    scenarios: {
      success,
      fakeDone,
      executionFailed
    }
  }, null, 2));
}

try {
  await main();
} finally {
  server.kill();
}
