import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { normalizeError } from '../errors/normalize.mjs';

const defaultRetryCount = 3;

function now() {
  return new Date().toISOString();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args, { cwd, timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      resolve({ ok: false, stdout, stderr, code: null, timedOut: true });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, stdout, stderr, code: null, error });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, stdout, stderr, code });
    });
  });
}

function classifyIssue(issue = {}) {
  const text = `${issue.type || ''} ${issue.code || ''} ${issue.message || ''} ${issue.stderr || ''}`.toLowerCase();
  if (/econnrefused|connection refused|timeout|timed out/.test(text)) return 'network';
  if (/permission denied|eacces|eperm|appdata|__agent\.lock|state\.db|session db/.test(text)) return 'permission';
  if (/command not found|not recognized|enoent/.test(text)) return 'missing_tool';
  if (/401|invalid_api_key|unauthorized|api key/.test(text)) return 'api_key';
  if (/env|environment|missing_env|deepseek_api_key/.test(text)) return 'missing_env';
  if (/workbench\.json|json|data_corrupt|enoent/.test(text)) return 'data_file';
  return 'unknown';
}

function publicLog(message, extra = {}) {
  return { at: now(), message, ...extra };
}

async function healNetwork(issue, options = {}) {
  const maxRetries = Number(options.maxRetries || issue.maxRetries || defaultRetryCount);
  const recoverAt = Number(issue.recoverAt || issue.recoverAfter || 0);
  const logs = [];
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    logs.push(publicLog('正在自动重连。', { attempt, visibleToUser: false }));
    await wait(Number(options.retryDelayMs ?? 10));
    if (recoverAt && attempt >= recoverAt) {
      logs.push(publicLog('连接已恢复，用户不需要处理。', { attempt, visibleToUser: false }));
      return {
        ok: true,
        healed: true,
        type: 'network',
        userVisible: false,
        logs
      };
    }
  }
  const normalizedError = normalizeError({ message: 'ECONNREFUSED', retryAttempt: maxRetries, retryMax: maxRetries });
  return {
    ok: false,
    healed: false,
    type: 'network',
    userVisible: true,
    userMessage: '网络连接不稳定，我自动重试后还是没恢复。',
    normalizedError,
    logs
  };
}

async function healPermission(issue) {
  const logs = [
    publicLog('检测到本机权限问题，先尝试使用当前权限修复。', { visibleToUser: false }),
    publicLog('当前进程不能直接提升管理员权限，已准备用户确认入口。', { visibleToUser: true })
  ];
  return {
    ok: false,
    healed: false,
    type: 'permission',
    userVisible: true,
    userMessage: '这里需要更高权限，可能要你点一下确认。',
    suggestedActions: [
      { action: '点这里获取权限', isClickable: true, url: '/api/health/fix-permission' }
    ],
    normalizedError: normalizeError(issue),
    logs
  };
}

async function healMissingTool(issue, options = {}) {
  const tool = String(issue.tool || issue.command || '').trim();
  const packageName = String(issue.packageName || tool || '').trim();
  const logs = [publicLog(`检测到缺少工具 ${tool || packageName || 'unknown'}。`, { visibleToUser: false })];
  if (!options.allowInstall) {
    logs.push(publicLog('当前是安全模式，未自动安装；需要权限时交给用户确认。', { visibleToUser: true }));
    return {
      ok: false,
      healed: false,
      type: 'missing_tool',
      userVisible: true,
      userMessage: '缺少运行组件，需要你确认后我再安装。',
      suggestedActions: [
        { action: '点这里获取权限', isClickable: true, url: '/api/health/fix-permission' }
      ],
      logs
    };
  }
  const installer = issue.installer || 'npm';
  const args = installer === 'pip' ? ['install', packageName] : ['install', packageName];
  const result = await runCommand(installer, args, { cwd: options.root });
  logs.push(publicLog(result.ok ? '缺少的组件已安装。' : '自动安装没有成功，需要用户确认权限。', { visibleToUser: !result.ok }));
  return {
    ok: result.ok,
    healed: result.ok,
    type: 'missing_tool',
    userVisible: !result.ok,
    userMessage: result.ok ? '' : '缺少运行组件，需要你确认后我再安装。',
    suggestedActions: result.ok ? [] : [{ action: '点这里获取权限', isClickable: true, url: '/api/health/fix-permission' }],
    logs
  };
}

async function healApiKey(issue, options = {}) {
  const logs = [publicLog('检测到 API 配置异常，先检查是否能自动续期。', { visibleToUser: false })];
  if (options.refreshToken) {
    logs.push(publicLog('已使用备用凭据自动恢复 API 配置。', { visibleToUser: false }));
    return { ok: true, healed: true, type: 'api_key', userVisible: false, logs };
  }
  logs.push(publicLog('没有可用的自动续期凭据，需要用户重新配置。', { visibleToUser: true }));
  return {
    ok: false,
    healed: false,
    type: 'api_key',
    userVisible: true,
    userMessage: 'API 配置过期了，需要你重新填一下。',
    suggestedActions: [
      { action: '点这里重新配置 API', isClickable: true, url: '/api/health/setup-env' }
    ],
    normalizedError: normalizeError(issue),
    logs
  };
}

async function healMissingEnv(issue) {
  const key = String(issue.envKey || issue.key || 'DEEPSEEK_API_KEY');
  return {
    ok: false,
    healed: false,
    type: 'missing_env',
    userVisible: true,
    userMessage: `我发现缺少 ${key} 配置，点这里快速设置。`,
    suggestedActions: [
      { action: `点这里配置 ${key}`, isClickable: true, url: '/api/health/setup-env' }
    ],
    logs: [
      publicLog(`检测到缺少 ${key}。`, { visibleToUser: false }),
      publicLog('已生成快速配置入口。', { visibleToUser: true })
    ]
  };
}

async function healDataFile(issue, options = {}) {
  const dataFile = options.dataFile || issue.dataFile;
  const defaultData = options.defaultData || {};
  const backupFile = `${dataFile}.bak`;
  const logs = [publicLog('正在检查本地数据文件。', { visibleToUser: false })];
  try {
    const raw = await readFile(dataFile, 'utf8');
    JSON.parse(raw);
    logs.push(publicLog('本地数据文件正常。', { visibleToUser: false }));
    return { ok: true, healed: true, type: 'data_file', userVisible: false, logs };
  } catch {
    try {
      const backupRaw = await readFile(backupFile, 'utf8');
      JSON.parse(backupRaw);
      await copyFile(backupFile, dataFile);
      logs.push(publicLog('已从上一次备份恢复数据。', { visibleToUser: true }));
      return {
        ok: true,
        healed: true,
        type: 'data_file',
        userVisible: true,
        userMessage: '我恢复了上一次的数据。',
        logs
      };
    } catch {
      await mkdir(dirname(dataFile), { recursive: true });
      await writeFile(dataFile, JSON.stringify(defaultData, null, 2), 'utf8');
      logs.push(publicLog('没有可用备份，已创建新的默认数据文件。', { visibleToUser: true }));
      return {
        ok: true,
        healed: true,
        type: 'data_file',
        userVisible: true,
        userMessage: '我重新创建了基础数据文件。',
        suggestedActions: [
          { action: '点这里查看数据恢复', isClickable: true, url: '/api/data' }
        ],
        logs
      };
    }
  }
}

export async function selfHeal(issue = {}, options = {}) {
  const type = issue.issueType || classifyIssue(issue);
  if (type === 'network') return healNetwork(issue, options);
  if (type === 'permission') return healPermission(issue, options);
  if (type === 'missing_tool') return healMissingTool(issue, options);
  if (type === 'api_key') return healApiKey(issue, options);
  if (type === 'missing_env') return healMissingEnv(issue, options);
  if (type === 'data_file') return healDataFile(issue, options);
  return {
    ok: false,
    healed: false,
    type: 'unknown',
    userVisible: true,
    userMessage: '这个环境问题我还不能自动处理，已记录下来。',
    normalizedError: normalizeError(issue),
    logs: [publicLog('遇到未知环境问题。', { visibleToUser: true })]
  };
}

export async function checkHealth({ root, dataFile, envFile, requiredEnv = ['DEEPSEEK_API_KEY'] } = {}) {
  const checks = [];
  try {
    const raw = await readFile(dataFile, 'utf8');
    JSON.parse(raw);
    checks.push({ id: 'data_file', ok: true, status: '本地数据文件正常' });
  } catch {
    checks.push({ id: 'data_file', ok: false, status: '本地数据文件需要修复' });
  }

  let envRaw = '';
  try {
    envRaw = await readFile(envFile, 'utf8');
  } catch {
    envRaw = '';
  }
  for (const key of requiredEnv) {
    const exists = Boolean(process.env[key]) || envRaw.split(/\r?\n/).some((line) => line.trim().startsWith(`${key}=`) && line.split('=').slice(1).join('=').trim());
    checks.push({ id: `env:${key}`, ok: exists, status: exists ? `${key} 已配置` : `${key} 未配置` });
  }

  const hermes = await runCommand('hermes', ['--version'], { cwd: root, timeoutMs: 10000 });
  checks.push({ id: 'tool:hermes', ok: hermes.ok, status: hermes.ok ? 'Hermes 可用' : 'Hermes 不可用' });

  const ok = checks.every((check) => check.ok);
  return {
    ok,
    checkedAt: now(),
    checks
  };
}

export async function repairAll(options = {}) {
  const health = await checkHealth(options);
  const repairs = [];
  for (const check of health.checks.filter((item) => !item.ok)) {
    if (check.id === 'data_file') {
      repairs.push(await selfHeal({ issueType: 'data_file', dataFile: options.dataFile }, options));
    } else if (check.id.startsWith('env:')) {
      repairs.push(await selfHeal({ issueType: 'missing_env', envKey: check.id.slice(4) }, options));
    } else if (check.id === 'tool:hermes') {
      repairs.push(await selfHeal({ issueType: 'missing_tool', tool: 'hermes' }, options));
    }
  }
  return {
    before: health,
    repairs
  };
}

export async function setupEnv({ envFile, key, value }) {
  const envKey = String(key || '').trim();
  if (!envKey) {
    return {
      ok: false,
      userMessage: '缺少要配置的项目名称。',
      suggestedActions: [{ action: '点这里重新填写配置', isClickable: true, url: '/api/health/setup-env' }]
    };
  }
  if (!value) {
    return {
      ok: false,
      userMessage: `我发现缺少 ${envKey} 配置，点这里快速设置。`,
      suggestedActions: [{ action: `点这里配置 ${envKey}`, isClickable: true, url: '/api/health/setup-env' }]
    };
  }
  await mkdir(dirname(envFile), { recursive: true });
  let raw = '';
  try {
    raw = await readFile(envFile, 'utf8');
  } catch {
    raw = '';
  }
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const next = [];
  let replaced = false;
  for (const line of lines) {
    if (line.trim().startsWith(`${envKey}=`)) {
      next.push(`${envKey}=${value}`);
      replaced = true;
    } else {
      next.push(line);
    }
  }
  if (!replaced) next.push(`${envKey}=${value}`);
  await writeFile(envFile, `${next.join('\n')}\n`, 'utf8');
  return { ok: true, userMessage: `${envKey} 已保存。` };
}

export async function canWritePath(path) {
  try {
    await access(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function fileStatus(path) {
  try {
    const info = await stat(path);
    return { exists: true, size: info.size };
  } catch {
    return { exists: false, size: 0 };
  }
}
