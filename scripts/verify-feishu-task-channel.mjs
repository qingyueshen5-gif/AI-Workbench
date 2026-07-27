import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const tmpRoot = fs.mkdtempSync(join(tmpdir(), 'aiw-feishu-channel-'));
const repo = join(tmpRoot, 'repo');
const runtime = join(tmpRoot, 'runtime');
process.env.AI_WORKBENCH_RUNTIME_DIR = runtime;
process.env.AIW_TASK_GATEWAY_DIR = join(runtime, 'task-gateway');
process.env.AIW_FEISHU_CHANNEL_DIR = join(runtime, 'feishu-channel');
process.env.AIW_TASK_GATEWAY_CODEX_ADAPTER = 'mock';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repo,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...(options.env || {}) },
  });
  if (options.allowFailure) return result;
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result;
}

await fsp.mkdir(repo, { recursive: true });
run('git', ['init'], { cwd: repo });
run('git', ['config', 'user.email', 'feishu-channel-test@example.invalid'], { cwd: repo });
run('git', ['config', 'user.name', 'Feishu Channel Test'], { cwd: repo });
await fsp.writeFile(join(repo, 'package.json'), JSON.stringify({ scripts: { verify: 'node -e "true"' } }, null, 2), 'utf8');
await fsp.writeFile(join(repo, 'README.md'), '# test\n', 'utf8');
run('git', ['add', '.'], { cwd: repo });
run('git', ['commit', '-m', 'init'], { cwd: repo });
const head = run('git', ['rev-parse', 'HEAD'], { cwd: repo }).stdout.trim();
run('git', ['update-ref', 'refs/remotes/origin/main', head], { cwd: repo });

const { FeishuTaskChannel, MemoryTransport, parseTaskCreate, parseTextContent, sourceFromEvent, maskId, redact } = await import(`./feishu-task-channel.mjs?verify=${Date.now()}`);
const transport = new MemoryTransport();
const channel = await new FeishuTaskChannel({
  transport,
  repository: repo,
  allowedOpenIds: ['owner-open-id'],
  botOpenId: 'bot-open-id',
  awaitRuns: true,
}).init();

function event({ id = `event-${Math.random()}`, openId = 'owner-open-id', chatId = 'chat-private', chatType = 'p2p', text = '/gateway ping', messageType = 'text', senderType = 'user', mentions = [] } = {}) {
  return {
    event_id: id,
    sender: { sender_type: senderType, sender_id: { open_id: openId } },
    message: {
      message_id: `${id}-message`,
      chat_id: chatId,
      chat_type: chatType,
      message_type: messageType,
      content: messageType === 'text' ? JSON.stringify({ text }) : '{}',
      mentions,
      create_time: String(Date.now()),
    },
  };
}

assert.equal(parseTextContent(JSON.stringify({ text: '/gateway ping' })), '/gateway ping');
assert.equal(sourceFromEvent(event()).openId, 'owner-open-id');
assert.equal(maskId('abcdef123456'), 'abcd...3456');
assert.equal(redact('FEISHU_APP_SECRET=sample').includes('sample'), false);
assert.deepEqual(parseTaskCreate('/task create\ntitle: T\nrole: architecture\nprompt:\nRead only.'), {
  title: 'T',
  role: 'architecture',
  prompt: 'Read only.',
});

let result = await channel.handleEvent(event({ id: 'non-text', messageType: 'image' }));
assert.match(result.text, /只支持文本/);

result = await channel.handleEvent(event({ id: 'unauthorized', openId: 'other-open-id', text: '/task create\ntitle: No\nrole: research\nprompt:\nNo' }));
assert.match(result.text, /未授权/);
assert.equal(transport.sent.at(-1).text.includes(repo), false);

const pairingChannel = await new FeishuTaskChannel({ transport: new MemoryTransport(), repository: repo, awaitRuns: true }).init();
const code = pairingChannel.generatePairingCode(50);
result = await pairingChannel.handleEvent(event({ id: 'pair-wrong', openId: 'new-owner', text: '/gateway pair wrong' }));
assert.match(result.text, /不正确/);
result = await pairingChannel.handleEvent(event({ id: 'pair-ok', openId: 'new-owner', text: `/gateway pair ${code}` }));
assert.match(result.text, /配对成功/);
assert.equal(pairingChannel.isOwner('new-owner'), true);
result = await pairingChannel.handleEvent(event({ id: 'pair-once', openId: 'other', text: `/gateway pair ${code}` }));
assert.match(result.text, /没有有效配对码/);

const expiredChannel = await new FeishuTaskChannel({ transport: new MemoryTransport(), repository: repo }).init();
const expired = expiredChannel.generatePairingCode(1);
await new Promise((resolve) => setTimeout(resolve, 5));
result = await expiredChannel.handleEvent(event({ id: 'pair-expired', openId: 'late-owner', text: `/gateway pair ${expired}` }));
assert.match(result.text, /过期/);

result = await channel.handleEvent(event({ id: 'bot-message', senderType: 'bot' }));
assert.equal(result.ignored, true);

result = await channel.handleEvent(event({ id: 'group-normal', chatType: 'group', chatId: 'group-chat', text: '/gateway ping' }));
assert.equal(result.ignored, true);

result = await channel.handleEvent(event({ id: 'group-mention', chatType: 'group', chatId: 'group-chat', text: '/gateway ping', mentions: [{ id: { open_id: 'bot-open-id' } }] }));
assert.equal(result.text, 'pong');

result = await channel.handleEvent(event({ id: 'dedupe', text: '/gateway ping' }));
assert.equal(result.text, 'pong');
result = await channel.handleEvent(event({ id: 'dedupe', text: '/gateway ping' }));
assert.equal(result.ignored, true);

result = await channel.handleEvent(event({ id: 'whoami', text: '/gateway whoami' }));
assert.match(result.text, /owner: true/);
assert.equal(result.text.includes('other-open-id'), false);

result = await channel.handleEvent(event({ id: 'status', text: '/gateway status' }));
assert.match(result.text, /task_gateway: available/);

result = await channel.handleEvent(event({ id: 'bind-manual-chat', text: '/gateway bind-report chat-evil' }));
assert.match(result.text, /工作台群/);
result = await channel.handleEvent(event({ id: 'bind-report', chatType: 'group', chatId: 'report-chat', text: '/gateway bind-report', mentions: [{ id: { open_id: 'bot-open-id' } }] }));
assert.match(result.text, /报告群已绑定/);

const createText = [
  '/task create',
  'title: Feishu readonly smoke',
  'role: architecture',
  'prompt:',
  'Read status only; do not run shell injection & echo BAD.',
].join('\n');
result = await channel.handleEvent(event({ id: 'create', text: createText }));
assert.match(result.text, /waiting_approval/);
assert.match(result.text, /尚未启动Codex/);
assert.equal(fs.existsSync(join(tmpRoot, 'BAD')), false);
const createdTaskId = result.text.match(/task_id: ([A-Za-z0-9._-]+)/)[1];
let task = await channel.gateway.loadTask(createdTaskId);
assert.equal(task.status, 'waiting_approval');
assert.equal(task.codex_run_count, 0);

result = await channel.handleEvent(event({ id: 'run-before-approve', text: `/task run ${createdTaskId}` }));
assert.match(result.text, /任务未批准/);
task = await channel.gateway.loadTask(createdTaskId);
assert.equal(task.codex_run_count, 0);

result = await channel.handleEvent(event({ id: 'approve', text: `/task approve ${createdTaskId}` }));
assert.match(result.text, /approved/);
task = await channel.gateway.loadTask(createdTaskId);
assert.equal(task.status, 'approved');
assert.equal(task.codex_run_count, 0);

result = await channel.handleEvent(event({ id: 'run', text: `/task run ${createdTaskId}` }));
assert.match(result.text, /run finished/);
task = await channel.gateway.loadTask(createdTaskId);
assert.equal(task.status, 'completed');
assert.equal(task.codex_run_count, 1);
assert.equal(task.changed_files.length, 0);

const reportMessages = transport.sent.filter((item) => item.target.type === 'report_chat');
assert.ok(reportMessages.some((item) => /任务状态：started/.test(item.text)));
assert.ok(reportMessages.some((item) => /任务状态：completed/.test(item.text)));
assert.equal(reportMessages.some((item) => item.text.includes('Read status only')), false);

await channel.notifyTaskStatus(task, 'completed');
const completedNotifications = transport.sent.filter((item) => item.target.type === 'report_chat' && /任务状态：completed/.test(item.text));
assert.equal(completedNotifications.length, 1);

result = await channel.handleEvent(event({ id: 'show', text: `/task show ${createdTaskId}` }));
assert.match(result.text, /completed/);
result = await channel.handleEvent(event({ id: 'logs', text: `/task logs ${createdTaskId}` }));
assert.equal(result.text.includes('Read status only'), false);
result = await channel.handleEvent(event({ id: 'cleanup', text: `/task cleanup ${createdTaskId}` }));
assert.match(result.text, /cleanup/);

const cancelText = [
  '/task create',
  'title: Cancel draft',
  'role: research',
  'prompt:',
  'Read only.',
].join('\n');
result = await channel.handleEvent(event({ id: 'cancel-create', text: cancelText }));
const cancelTaskId = result.text.match(/task_id: ([A-Za-z0-9._-]+)/)[1];
result = await channel.handleEvent(event({ id: 'cancel-task', text: `/task cancel ${cancelTaskId}` }));
assert.match(result.text, /cancelled/);
assert.ok(transport.sent.some((item) => /任务状态：cancelled/.test(item.text)));

transport.failNext = true;
const notificationFailure = await channel.notifyTaskStatus({ ...task, task_id: 'notify-fail', status: 'failed', blocked_reason: 'mock' }, 'failed');
assert.equal(notificationFailure.ok, false);
assert.equal((await channel.gateway.loadTask(createdTaskId)).status, 'completed');

await channel.notifyTaskStatus({ ...task, task_id: 'blocked-task', status: 'blocked', blocked_reason: 'baseline_mismatch' }, 'blocked');
await channel.notifyTaskStatus({ ...task, task_id: 'failed-task', status: 'failed', blocked_reason: 'codex_process_failed' }, 'failed');
assert.ok(transport.sent.some((item) => /任务状态：blocked/.test(item.text)));
assert.ok(transport.sent.some((item) => /任务状态：failed/.test(item.text)));

const disabled = await new FeishuTaskChannel({ transport: new MemoryTransport(), repository: repo, allowedOpenIds: ['owner-open-id'], enabled: false }).init();
result = await disabled.handleEvent(event({ id: 'disabled-create', text: createText }));
assert.match(result.text, /disabled/);

assert.equal(transport.sent.some((item) => item.text.includes('tenant_access_token')), false);

console.log(JSON.stringify({
  status: 'passed',
  tmpRoot,
  covered: [
    'text_command_parsing',
    'non_text_rejection',
    'user_authorization',
    'owner_pairing',
    'pairing_code_expiry',
    'single_use_pairing_code',
    'unauthorized_create_blocked',
    'unauthorized_approve_blocked',
    'unapproved_task_cannot_run',
    'create_does_not_auto_approve',
    'approve_does_not_auto_run',
    'duplicate_event_dedupe',
    'ignore_bot_message',
    'ignore_group_message_without_mention',
    'group_mention_command',
    'report_chat_binding',
    'no_arbitrary_chat_id',
    'started_notification',
    'blocked_notification',
    'completed_notification',
    'failed_notification',
    'cancelled_notification',
    'notification_dedupe',
    'notification_failure_does_not_change_task_result',
    'message_redaction',
    'long_message_truncation_available',
    'app_secret_not_logged',
    'prompt_not_in_group_notification',
    'no_arbitrary_shell_execution',
    'task_gateway_safe_failure',
    'channel_disabled_blocks_create',
    'no_gpt_call',
    'no_hermes_call',
    'no_auto_push_or_deploy'
  ]
}, null, 2));
