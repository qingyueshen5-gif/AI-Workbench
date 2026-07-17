import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 19879;
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

async function main() {
  await waitForServer();

  const suffix = new Date().toISOString();
  const preference = await request('/api/memories', 'POST', {
    type: 'user_preferences',
    key: `default_model.${suffix}`,
    value: { defaultModel: 'DeepSeek', reason: 'MVP 默认低成本文本模型' },
    source: 'workbench',
    visibility: 'agent',
    confidence: 0.95
  });
  assert(preference.response.status === 201, `Memory write failed: ${preference.body.error || preference.response.status}`);

  const taskCreated = await request('/api/tasks', 'POST', {
    userGoal: `验证中央记忆库 ${suffix}`,
    title: '验证中央记忆库',
    assignedAgentId: 'deepseek',
    evidenceRequired: ['task_context', 'memory_suggestion']
  });
  assert(taskCreated.response.status === 201, `Task create failed: ${taskCreated.body.error || taskCreated.response.status}`);
  const task = taskCreated.body.task;

  const context = await request(`/api/tasks/${encodeURIComponent(task.id)}/context`);
  assert(context.response.ok, `Task context failed: ${context.body.error || context.response.status}`);
  const includedPreference = context.body.task_context.memories.user_preferences
    .some((memory) => memory.id === preference.body.memory.id);
  assert(includedPreference, 'Task context did not include the written user preference');
  assert(context.body.task_context.policy.agentCanWriteMainMemory === false, 'Context policy should forbid agent memory writes');

  const runCreated = await request('/api/runs', 'POST', {
    taskId: task.id,
    agentId: 'hermes',
    status: 'done',
    input: { task_context_id: context.body.task_context.id },
    output: { summary: 'Hermes 建议记录一个已验证的文件读取方案。' },
    evidence: { checkedBy: 'verify-memories' },
    verified: true,
    verificationResult: { ok: true }
  });
  assert(runCreated.response.status === 201, `Run create failed: ${runCreated.body.error || runCreated.response.status}`);
  const run = runCreated.body.run;

  const suggested = await request(`/api/runs/${encodeURIComponent(run.id)}/memory-suggestions`, 'POST', {
    memory_suggestions: [
      {
        type: 'error_experiences',
        key: `hermes.file_reading.fix.${suffix}`,
        value: {
          problem: 'Hermes terminal backend 命中默认 WSL 时读不到 F:\\AI-Workbench',
          solution: '使用 Windows native Hermes + Git Bash，并把工作区路径传给 Hermes。'
        },
        visibility: 'agent',
        confidence: 0.9,
        reason: '下次遇到 Hermes 文件读取问题时可直接套用。'
      }
    ]
  });
  assert(suggested.response.status === 201, `Suggestion submit failed: ${suggested.body.error || suggested.response.status}`);
  assert(suggested.body.memoryWritten === false, 'Agent suggestion should not write main memory');
  const suggestion = suggested.body.suggestions[0];

  const beforeApprove = await request('/api/memories/error_experiences');
  assert(beforeApprove.response.ok, 'Error memories query before approval failed');
  const alreadyWritten = beforeApprove.body.memories.some((memory) => memory.key === suggestion.key);
  assert(!alreadyWritten, 'Suggestion was written before workbench approval');

  const approved = await request('/api/memories', 'POST', {
    runId: run.id,
    suggestionId: suggestion.id,
    approved: true,
    source: 'workbench'
  });
  assert(approved.response.status === 201, `Approval write failed: ${approved.body.error || approved.response.status}`);

  const afterApprove = await request('/api/memories/error_experiences');
  const writtenMemory = afterApprove.body.memories.find((memory) => memory.key === suggestion.key);
  assert(writtenMemory, 'Approved suggestion was not written to main memory');

  const runAfterApproval = await request(`/api/runs/${encodeURIComponent(run.id)}`);
  const storedSuggestion = runAfterApproval.body.run.memorySuggestions.find((item) => item.id === suggestion.id);
  assert(storedSuggestion?.status === 'accepted', 'Suggestion status was not marked accepted');

  console.log(JSON.stringify({
    storage: 'local_json:data/workbench.json',
    rule: 'memory_owner_is_workbench_not_agent',
    write_user_preference: preference.body.memory,
    task_context_contains_preference: includedPreference,
    task_context_policy: context.body.task_context.policy,
    agent_memory_suggestion_recorded_only: suggestion,
    main_memory_before_workbench_approval: alreadyWritten,
    workbench_approved_memory: writtenMemory,
    suggestion_status_after_approval: storedSuggestion
  }, null, 2));
}

try {
  await main();
} finally {
  server.kill();
}
