import assert from 'node:assert/strict';
import { analyzeActiveTaskMessage, ActiveTaskController, isStaleAcceptedTask } from '../agents/active-task-controller.mjs';

const active = { activeTaskId: 'old-task', conversationId: 'conversation', originalUserGoal: '旧任务', stage: 'executing', startedAt: 1000, lastProgressAt: 9000, supplementalInstructions: [] };
const cases = [
  { name: 'new-read-path', text: '读取 E:\\AI-Workbench\\NEXT_STEP.md，不要修改文件', expected: { action: 'read', target: 'E:\\AI-Workbench\\NEXT_STEP.md', constraints: ['不要修改文件'], relationToActiveTask: 'new_task', kind: 'new_task' } },
  { name: 'new-delete-constrained', text: '删除临时文件，但不要删除项目文件', expected: { action: 'delete', target: '临时文件', constraints: ['不要删除项目文件'], relationToActiveTask: 'new_task', kind: 'new_task' } },
  { name: 'new-check-no-restart', text: '检查服务状态，不要重启', expected: { action: 'check', target: '服务状态', constraints: ['不要重启'], relationToActiveTask: 'new_task', kind: 'new_task' } },
  { name: 'new-open-version', text: '打开package.json，只告诉我版本号', expected: { action: 'read', target: 'package.json', constraints: ['只告诉我版本号'], relationToActiveTask: 'new_task', kind: 'new_task' } },
  { name: 'new-search-log', text: '搜索日志，不要修改任何配置', expected: { action: 'search', target: '日志', constraints: ['不要修改任何配置'], relationToActiveTask: 'new_task', kind: 'new_task' } },
  { name: 'correction-reference', text: '刚才那个任务不要修改文件', expected: { action: '', target: '', constraints: ['不要修改文件'], relationToActiveTask: 'correction', kind: 'correction' } },
  { name: 'correction-change-above', text: '把上面的要求改成只读', expected: { action: '', target: '', constraints: ['只读'], relationToActiveTask: 'correction', kind: 'correction' } },
  { name: 'continue', text: '继续刚才的任务', expected: { relationToActiveTask: 'continue', kind: 'continue' } },
  { name: 'pause', text: '暂停当前任务', expected: { relationToActiveTask: 'pause', kind: 'pause' } },
  { name: 'cancel', text: '取消刚才的读取任务', expected: { relationToActiveTask: 'cancel', kind: 'cancel' } },
  { name: 'ordinary-chat', text: '你好，今天怎么样', expected: { action: '', target: '', relationToActiveTask: 'new_task', kind: 'new_task' } }
];

const results = [];
for (const item of cases) {
  const actual = analyzeActiveTaskMessage(item.text, true);
  for (const [key, value] of Object.entries(item.expected)) assert.deepEqual(actual[key], value, `${item.name}:${key}`);
  const shouldCreateNewJob = ['new_task', 'needs_semantic_judgment'].includes(actual.kind);
  results.push({ name: item.name, text: item.text, action: actual.action, target: actual.target, expected_result: actual.expectedResult, constraints: actual.constraints, relation_to_active_task: actual.relationToActiveTask, final_classification: actual.kind, should_create_new_job: shouldCreateNewJob, incorrectly_merged_old_task: !shouldCreateNewJob && actual.kind === 'new_task' });
}

class FakeStore {
  constructor(task) { this.task = task; this.updates = []; }
  async active() { return this.task && !['completed', 'failed'].includes(this.task.stage) ? this.task : null; }
  async update(_conversationId, patch) { this.updates.push(patch); this.task = { ...this.task, ...patch }; return this.task; }
  async load() { return this.task; }
}

const controller = new ActiveTaskController({ store: new FakeStore(active), now: () => 10_000, staleAcceptedMs: 1000 });
const fileResult = await controller.handle({ conversationId: 'conversation', text: '读取 E:\\AI-Workbench\\NEXT_STEP.md，告诉我当前最重要的目标。不要修改文件。' });
assert.equal(fileResult.intercepted, false);
assert.equal(fileResult.classification.action, 'read');
assert.equal(fileResult.classification.target, 'E:\\AI-Workbench\\NEXT_STEP.md');
assert.deepEqual(fileResult.classification.constraints, ['不要修改文件']);

for (const stage of ['completed', 'failed']) {
  const result = await new ActiveTaskController({ store: new FakeStore({ ...active, stage }) }).handle({ conversationId: 'conversation', text: '读取NEXT_STEP.md，不要修改文件' });
  assert.equal(result.intercepted, false, stage);
}
const stale = { ...active, stage: 'accepted', startedAt: 1, lastProgressAt: 1, completedSteps: [], toolResults: [] };
assert.equal(isStaleAcceptedTask(stale, 10_000, 1000), true);
const staleResult = await new ActiveTaskController({ store: new FakeStore(stale), now: () => 10_000, staleAcceptedMs: 1000 }).handle({ conversationId: 'conversation', text: '刚才那个任务不要修改文件' });
assert.equal(staleResult.intercepted, false);

console.log(JSON.stringify({ ok: true, passed: results.length + 5, cases: results, stateCases: ['normal_active_task', 'completed', 'failed', 'stale_accepted', 'ordinary_chat'] }, null, 2));
