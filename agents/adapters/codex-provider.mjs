import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { runtimeRoot } from '../../runtime-paths.mjs';

const providerRoot = join(runtimeRoot, 'direct-codex', 'provider');

function lastAgentMessage(stdout) {
  let text = '';
  let sessionId = '';
  const events = [];
  for (const line of String(stdout || '').split(/\r?\n/)) {
    try {
      const item = JSON.parse(line);
      events.push(item.type || 'unknown');
      if (item.type === 'thread.started' || item.type === 'session.started') sessionId = item.thread_id || item.session_id || item.id || sessionId;
      if (item.type === 'item.completed' && item.item?.type === 'agent_message' && item.item?.text) text = item.item.text;
      if (item.type === 'message' && item.message) text = String(item.message);
    } catch {}
  }
  return { text: text.trim(), sessionId, events };
}

function runCodex(args, input, timeoutMs, signal) {
  return new Promise((resolveRun, rejectRun) => {
    const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'codex';
    const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'call', 'codex.cmd', ...args] : args;
    const child = spawn(command, commandArgs, { cwd: process.cwd(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let settled = false; let timer;
    const finish = (error, code = 0) => {
      if (settled) return;
      settled = true;
      if(timer)clearTimeout(timer);
      if (error || code !== 0) rejectRun(error || new Error(stderr || stdout || `Codex exited ${code}`));
      else resolveRun({ stdout, stderr });
    };
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', finish);
    child.once('exit', (code) => finish(null, code));
    const abort=()=>{child.kill();finish(Object.assign(new Error('Codex execution cancelled'),{name:'AbortError'}));};
    if(signal?.aborted)return abort();
    signal?.addEventListener('abort',abort,{once:true});
    timer = setTimeout(() => { child.kill(); finish(new Error('Codex provider timeout')); }, timeoutMs);
    child.stdin.end(input);
  });
}

export class CodexProvider {
  constructor(options = {}) {
    this.timeoutMs = Number(options.timeoutMs || process.env.AIW_CODEX_PROVIDER_TIMEOUT_MS || 120000);
  }
  async healthCheck() {
    const version = await runCodex(['--version'], '', 15000);
    const auth = await runCodex(['login', 'status'], '', 15000);
    return { ok: /codex-cli/i.test(version.stdout), provider: 'codex', version: version.stdout.trim(), authClass: /Logged in using ChatGPT/i.test(auth.stdout + auth.stderr) ? 'chatgpt_subscription' : 'unknown' };
  }
  async generate({ conversationId, prompt, workspace, writable = false, signal }) {
    await fs.mkdir(providerRoot, { recursive: true });
    const resolvedWorkspace=resolve(workspace);
    const sandbox=writable?'workspace-write':'read-only';
    const policyHash=Buffer.from(`${resolvedWorkspace}\0${sandbox}`).toString('base64url');
    const sessionPath = join(providerRoot, `${String(conversationId).replace(/[^A-Za-z0-9_-]/g, '_')}.json`);
    let state = {};
    try { state = JSON.parse(await fs.readFile(sessionPath, 'utf8')); } catch {}
    if(state.workspace!==resolvedWorkspace||state.sandbox!==sandbox||state.policyHash!==policyHash) state={};
    const outputFile = join(providerRoot, `last-${process.pid}-${Date.now()}.txt`);
    const common = ['--ignore-user-config', '--skip-git-repo-check', '--json', '--output-last-message', outputFile];
    const args = state.sessionId
      ? ['exec', 'resume', '--ignore-user-config', '--skip-git-repo-check', '--json', '--output-last-message', outputFile, state.sessionId, '-']
      : ['exec', '-', '-C', resolvedWorkspace, '--sandbox', sandbox, ...common];
    const startedAt = Date.now();
    const result = await runCodex(args, prompt, this.timeoutMs, signal);
    const parsed = lastAgentMessage(result.stdout);
    let text = parsed.text;
    if (!text) { try { text = (await fs.readFile(outputFile, 'utf8')).trim(); } catch {} }
    await fs.rm(outputFile, { force: true }).catch(() => {});
    const sessionId = parsed.sessionId || state.sessionId || '';
    await fs.writeFile(sessionPath, `${JSON.stringify({ conversationId, sessionId, workspace:resolvedWorkspace, sandbox, policyHash, updatedAt: Date.now() }, null, 2)}\n`, 'utf8');
    if (!text) throw new Error('Codex returned no final answer');
    return { provider: 'codex', text, sessionId, durationMs: Date.now() - startedAt, events: parsed.events };
  }
}
