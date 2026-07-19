import { spawn } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
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

function runNativeCommand(command, args, { timeoutMs = 30000, cwd = process.cwd(), onChild } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      const executable = nativeCommandPath(command);
      child = spawn(executable, args, {
        cwd,
        windowsHide: true,
        env: { ...process.env, NO_COLOR: '1' }
      });
    } catch (error) {
      resolve({ ok: false, code: null, stdout: '', stderr: error.message, error, timedOut: false });
      return;
    }
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
      resolve({ ok: false, code: null, stdout, stderr: stderr || error.message, error, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut });
    });
  });
}

function startDetachedNative(command, args = [], { cwd = process.cwd(), onChild } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let child;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      const executable = nativeCommandPath(command);
      child = spawn(executable, args, {
        cwd,
        detached: true,
        windowsHide: false,
        stdio: 'ignore',
        env: { ...process.env, NO_COLOR: '1' }
      });
      onChild?.(child);
      child.once('error', (error) => {
        finish({ ok: false, code: null, stdout: '', stderr: error.message, error, timedOut: false });
      });
      const pid = child.pid;
      child.unref();
      setTimeout(() => finish({ ok: true, code: 0, stdout: `started ${command} ${args.join(' ')}`.trim(), stderr: '', timedOut: false, pid }), 700);
    } catch (error) {
      finish({ ok: false, code: null, stdout: '', stderr: error.message, error, timedOut: false });
    }
  });
}

function nativeCommandPath(command) {
  if (/^cmd(?:\.exe)?$/i.test(command)) return process.env.ComSpec || command;
  return command;
}

async function focusNativeWindow({ processName, pid, titlePattern = '' } = {}, { cwd = process.cwd() } = {}) {
  const script = [
    '$code=\'using System; using System.Runtime.InteropServices; public class NativeWindow { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }\'',
    'Add-Type $code -ErrorAction SilentlyContinue',
    "$workbench=Get-Process | Where-Object { $_.ProcessName -eq 'AI Workbench' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1",
    "if($workbench){ [NativeWindow]::ShowWindowAsync($workbench.MainWindowHandle, 6) | Out-Null }",
    `$pidValue=${Number(pid || 0)}`,
    `$processName=${quotePowerShellString(processName || '')}`,
    `$titlePattern=${quotePowerShellString(titlePattern || '')}`,
    '$target=$null',
    'for($i=0; $i -lt 25 -and !$target; $i++){',
    '  if($pidValue -gt 0){ $target=Get-Process -Id $pidValue -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1 }',
    '  if(!$target -and $processName){ $items=Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.ProcessName -match $processName }; if($titlePattern){ $items=$items | Where-Object { $_.MainWindowTitle -match $titlePattern } }; $target=$items | Sort-Object StartTime -Descending -ErrorAction SilentlyContinue | Select-Object -First 1 }',
    '  if(!$target){ Start-Sleep -Milliseconds 200 }',
    '}',
    '$shell=New-Object -ComObject WScript.Shell',
    'if($target){ [NativeWindow]::ShowWindowAsync($target.MainWindowHandle, 9) | Out-Null; Start-Sleep -Milliseconds 120; $shell.AppActivate($target.Id) | Out-Null; [NativeWindow]::SetForegroundWindow($target.MainWindowHandle) | Out-Null; Start-Sleep -Milliseconds 150; $shell.AppActivate($target.Id) | Out-Null; [NativeWindow]::SetForegroundWindow($target.MainWindowHandle) | Out-Null; [pscustomobject]@{Focused=$true;ProcessName=$target.ProcessName;Id=$target.Id;Title=$target.MainWindowTitle} | ConvertTo-Json -Compress } else { Write-Error "target window not found: $processName $pidValue $titlePattern"; exit 2 }'
  ].join('; ');
  return runNativeCommand('powershell.exe', ['-NoProfile', '-Command', script], { timeoutMs: 12000, cwd });
}

function quoteCmdArg(arg) {
  const text = String(arg);
  return /[\s"&|<>]/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function quotePowerShellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function escapeRegexLiteral(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function folderTitlePattern(folderTarget) {
  const name = basename(folderTarget).trim();
  const parts = [];
  if (name) parts.push(escapeRegexLiteral(name));
  if (/downloads/i.test(folderTarget) || /下载/.test(folderTarget)) parts.push('Downloads', '下载');
  return [...new Set(parts)].join('|');
}

function runWinget(args, options = {}) {
  return runNativeCommand('cmd.exe', ['/d', '/s', '/c', ['winget', ...args.map(quoteCmdArg)].join(' ')], options);
}

function installedSoftwareCommand(name) {
  const quoted = quotePowerShellString(name);
  return [
    `$name=${quoted}`,
    "$roots=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')",
    "$apps=Get-ItemProperty $roots -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like \"*$name*\" } | Select-Object DisplayName,DisplayVersion,InstallLocation,Publisher",
    "$menus=@($env:APPDATA+'\\Microsoft\\Windows\\Start Menu\\Programs',$env:ProgramData+'\\Microsoft\\Windows\\Start Menu\\Programs')",
    "$links=Get-ChildItem $menus -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -like \"*$name*\" } | Select-Object -First 10 FullName",
    "$dirs=Get-ChildItem 'C:\\Program Files','C:\\Program Files (x86)',$env:LOCALAPPDATA -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like \"*$name*\" -or $_.Name -match 'IQIYI|Qiyi' } | Select-Object -First 10 FullName",
    "[pscustomobject]@{Apps=@($apps); Shortcuts=@($links); Directories=@($dirs)} | ConvertTo-Json -Depth 5 -Compress"
  ].join('; ');
}

function hasInstalledSoftwareEvidence(text) {
  try {
    const parsed = JSON.parse(String(text || '').trim());
    return Boolean(parsed?.Apps?.length || parsed?.Shortcuts?.length || parsed?.Directories?.length);
  } catch {
    return false;
  }
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
    '规则：优先用terminal真实执行动作类任务，不要只给建议或官网地址；不能写长期记忆；如有记忆建议只写memory_suggestions，没有就写memory_suggestions: []。',
    '下载、安装、打开、查看、清理、配置等电脑操作类请求都按真实执行处理；Windows 软件安装优先尝试 winget、PowerShell、cmd 等原生命令链路。',
    '完成后必须用人话说明结果，并给出可验证证据，例如命令输出、文件路径、安装路径、进程/窗口状态或磁盘数字。',
    '如果失败，先重试一次可恢复步骤；仍失败时说清楚卡在哪、已尝试什么、下一步补救是什么。',
    `task_context_id: ${compactContext.id || ''}`,
    `memory_keys: ${memoryKeys.join(', ') || 'none'}`,
    '工作区路径: F:/AI-Workbench',
    `任务: ${goal}`
  ].join('\n');
}

function createCommandEvidence(args) {
  return `hermes ${args.map((arg) => {
    const text = String(arg);
    return /\s/.test(text) ? JSON.stringify(text) : text;
  }).join(' ')}`;
}

function createNativeEvidence(command, args) {
  return `hermes-direct: ${command} ${args.map((arg) => {
    const text = String(arg);
    return /\s/.test(text) ? JSON.stringify(text) : text;
  }).join(' ')}`;
}

function extractInstallQuery(goal) {
  const match = String(goal || '').match(/(?:下载|安装)\s*(.+?)(?:到电脑上|到电脑|到本机|客户端|软件|程序|$)/);
  return match?.[1]?.replace(/^帮我|请|一下/g, '').trim() || '';
}

function extractOpenTarget(goal) {
  const match = String(goal || '').match(/打开\s*(.+?)(?:$|。|，|,)/);
  return match?.[1]?.replace(/^帮我|请|一下/g, '').trim() || '';
}

function extractUrlTarget(goal) {
  const raw = String(goal || '').trim();
  const explicit = raw.match(/https?:\/\/[^\s，。]+/i)?.[0];
  if (explicit) return explicit;
  if (/github/i.test(raw)) return 'https://github.com';
  const domain = raw.match(/[a-z0-9.-]+\.(com|cn|net|org|io|dev|app|ai|top|xyz)\b/i)?.[0];
  if (domain) return `https://${domain}`;
  return '';
}

function isTerminalTarget(goal) {
  return /终端|terminal|powershell|命令行|cmd/i.test(String(goal || ''));
}

function extractFolderTarget(goal) {
  const raw = String(goal || '').trim();
  if (!/文件夹|目录|downloads?|桌面|desktop|文档|documents/i.test(raw)) return '';
  const explicit = raw.match(/[a-z]:\\[^\r\n，。]+/i)?.[0];
  if (explicit) return explicit.trim();
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  if (/下载|downloads?/i.test(raw)) return join(userHome, 'Downloads');
  if (/桌面|desktop/i.test(raw)) return join(userHome, 'Desktop');
  if (/文档|documents/i.test(raw)) return join(userHome, 'Documents');
  return raw.replace(/帮我|请|打开|启动|运行|文件夹|目录|一下/g, '').trim();
}

function settingsUriForPage(page) {
  const raw = String(page || '').trim();
  if (/^ms-settings:/i.test(raw)) return raw;
  if (/网络|wifi|wi-fi|network|internet/i.test(raw)) return 'ms-settings:network';
  if (/蓝牙|bluetooth/i.test(raw)) return 'ms-settings:bluetooth';
  if (/显示|display|屏幕/i.test(raw)) return 'ms-settings:display';
  if (/应用|apps?|程序/i.test(raw)) return 'ms-settings:appsfeatures';
  if (/更新|update/i.test(raw)) return 'ms-settings:windowsupdate';
  if (/声音|sound|音频/i.test(raw)) return 'ms-settings:sound';
  return 'ms-settings:';
}

function isSettingsTarget(goal) {
  return /设置|settings|网络|蓝牙|显示|系统设置|windows update|更新设置/i.test(String(goal || ''));
}

function commandSucceeded(result) {
  return result.ok && Number(result.code) === 0;
}

function combineResultText(...results) {
  return results
    .map((result) => `${stripAnsi(result.stdout)}\n${stripAnsi(result.stderr)}`.trim())
    .filter(Boolean)
    .join('\n');
}

async function tryDirectWindowsAction(task, context, runId, startedAt, onChild) {
  const goal = String(task?.userGoal || task?.goal || task?.prompt || task?.title || '').trim();
  if (/清理.*c盘|清理.*C盘|C盘.*清理|c盘.*清理|清理.*磁盘|清理.*缓存|清理.*临时文件/i.test(goal)) {
    const script = [
      "$before=[System.IO.DriveInfo]::new('C:\\').AvailableFreeSpace",
      "$paths=@($env:TEMP,$env:TMP,'C:\\Windows\\Temp') | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique",
      "$removed=0",
      "$errors=@()",
      "foreach($path in $paths){",
      "  Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue | ForEach-Object {",
      "    try { $size=0; if($_.PSIsContainer){ $size=(Get-ChildItem -LiteralPath $_.FullName -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum } else { $size=$_.Length }; Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop; $removed += [int64]$size } catch { $errors += $_.Exception.Message }",
      "  }",
      "}",
      "$cacheRoots=@($env:LOCALAPPDATA+'\\Microsoft\\Edge\\User Data\\Default\\Cache',$env:LOCALAPPDATA+'\\Google\\Chrome\\User Data\\Default\\Cache') | Where-Object { Test-Path $_ }",
      "foreach($path in $cacheRoots){ Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue | ForEach-Object { try { $size=0; if($_.PSIsContainer){ $size=(Get-ChildItem -LiteralPath $_.FullName -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum } else { $size=$_.Length }; Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop; $removed += [int64]$size } catch { $errors += $_.Exception.Message } } }",
      "try { Clear-RecycleBin -DriveLetter C -Force -ErrorAction Stop } catch { $errors += $_.Exception.Message }",
      "$after=[System.IO.DriveInfo]::new('C:\\').AvailableFreeSpace",
      "$freed=$after-$before; if($freed -lt 0){ $freed=0 }",
      "[pscustomobject]@{BeforeFreeGB=[math]::Round($before/1GB,2);AfterFreeGB=[math]::Round($after/1GB,2);FreedGB=[math]::Round($freed/1GB,2);EstimatedRemovedGB=[math]::Round($removed/1GB,2);Cleaned='用户临时目录、Windows临时目录、Edge/Chrome默认缓存、C盘回收站';SkippedErrors=@($errors | Select-Object -First 5)} | ConvertTo-Json -Depth 4 -Compress"
    ].join('; ');
    const args = ['-NoProfile', '-Command', script];
    const commandRun = createNativeEvidence('powershell.exe', args);
    const result = await runNativeCommand('powershell.exe', args, { timeoutMs: context.timeoutMs || 120000, cwd: context.cwd || process.cwd(), onChild });
    const finishedAt = new Date();
    const stdout = stripAnsi(result.stdout);
    let parsed = null;
    try {
      parsed = JSON.parse(stdout);
    } catch {}
    const reply = parsed
      ? `C盘安全清理完成。释放 ${parsed.FreedGB} GB；清理前剩余 ${parsed.BeforeFreeGB} GB，清理后剩余 ${parsed.AfterFreeGB} GB。范围：${parsed.Cleaned}。${parsed.SkippedErrors?.length ? `有 ${parsed.SkippedErrors.length} 个正在占用或无权限的缓存项已跳过，不影响安全清理。` : ''}`
      : `C盘清理已执行，但结果解析失败：${stdout || stripAnsi(result.stderr)}`;
    const evidence = {
      commandRun,
      stdout,
      stderr: stripAnsi(result.stderr),
      exitCode: result.code,
      executedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
    };
    return {
      runId,
      agentId: 'hermes',
      status: commandSucceeded(result) && parsed ? 'done' : 'failed',
      output: { result: { text: reply, taskId: task?.id || '' }, evidence, suggestions: [] },
      evidence,
      suggestions: [],
      finishedAt: finishedAt.toISOString()
    };
  }

  if (/c盘|c 盘|磁盘|剩余空间/i.test(goal)) {
    const args = ['-NoProfile', '-Command', "$d=[System.IO.DriveInfo]::new('C:\\'); [pscustomobject]@{Drive='C'; FreeGB=[math]::Round($d.AvailableFreeSpace/1GB,2); TotalGB=[math]::Round($d.TotalSize/1GB,2); UsedGB=[math]::Round(($d.TotalSize-$d.AvailableFreeSpace)/1GB,2)} | ConvertTo-Json -Compress"];
    const commandRun = createNativeEvidence('powershell.exe', args);
    const result = await runNativeCommand('powershell.exe', args, { timeoutMs: context.timeoutMs || 30000, cwd: context.cwd || process.cwd(), onChild });
    const finishedAt = new Date();
    const stdout = stripAnsi(result.stdout);
    let parsed = null;
    try {
      parsed = JSON.parse(stdout);
    } catch {}
    const reply = parsed
      ? `C盘还剩 ${parsed.FreeGB} GB，总容量 ${parsed.TotalGB} GB，已用 ${parsed.UsedGB} GB。`
      : `C盘空间查询完成：${stdout || stripAnsi(result.stderr)}`;
    return {
      runId,
      agentId: 'hermes',
      status: commandSucceeded(result) ? 'done' : 'failed',
      output: {
        result: { text: reply, taskId: task?.id || '' },
        evidence: {
          commandRun,
          stdout,
          stderr: stripAnsi(result.stderr),
          exitCode: result.code,
          executedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
        },
        suggestions: []
      },
      evidence: {
        commandRun,
        stdout,
        stderr: stripAnsi(result.stderr),
        exitCode: result.code,
        executedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
      },
      suggestions: [],
      finishedAt: finishedAt.toISOString()
    };
  }

  if (isTerminalTarget(goal) && /打开|启动|运行/i.test(goal)) {
    const args = ['/d', '/s', '/c', 'start', '""', 'powershell.exe'];
    const commandRun = createNativeEvidence('cmd.exe', args);
    const result = await startDetachedNative('cmd.exe', args, { cwd: context.cwd || process.cwd(), onChild });
    const focus = commandSucceeded(result)
      ? await focusNativeWindow({ processName: 'powershell|pwsh|WindowsTerminal|cmd', pid: result.pid }, { cwd: context.cwd || process.cwd() })
      : null;
    const finishedAt = new Date();
    const ok = commandSucceeded(result) && commandSucceeded(focus);
    const stdout = ok
      ? `opened_terminal=powershell.exe\nforeground=${stripAnsi(focus?.stdout || '')}`
      : combineResultText(result, focus || {});
    const evidence = {
      commandRun,
      stdout,
      stderr: stripAnsi(result.stderr),
      exitCode: result.code,
      executedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
    };
    return {
      runId,
      agentId: 'hermes',
      status: ok ? 'done' : 'failed',
      output: {
        result: { text: ok ? `终端已打开并已前置到最前。验证证据：${stdout || '启动命令退出码为 0。'}` : `终端打开或前置失败：${stdout}`, taskId: task?.id || '' },
        evidence,
        suggestions: []
      },
      evidence,
      suggestions: [],
      finishedAt: finishedAt.toISOString()
    };
  }

  const folderTarget = /打开|启动|运行/i.test(goal) ? extractFolderTarget(goal) : '';
  if (folderTarget) {
    if (!existsSync(folderTarget)) {
      const finishedAt = new Date();
      const evidence = {
        commandRun: createNativeEvidence('cmd.exe', ['/d', '/s', '/c', 'start', '""', folderTarget]),
        stdout: '',
        stderr: `Folder not found: ${folderTarget}`,
        exitCode: 1,
        executedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
      };
      return {
        runId,
        agentId: 'hermes',
        status: 'failed',
        output: { result: { text: `文件夹打开失败：${evidence.stderr}`, taskId: task?.id || '' }, evidence, suggestions: [] },
        evidence,
        suggestions: [],
        finishedAt: finishedAt.toISOString()
      };
    }
    const commandRun = createNativeEvidence('explorer.exe', [folderTarget]);
    const result = await startDetachedNative('explorer.exe', [folderTarget], { cwd: context.cwd || process.cwd(), onChild });
    const focus = commandSucceeded(result)
      ? await focusNativeWindow({ processName: 'explorer', titlePattern: folderTitlePattern(folderTarget) }, { cwd: context.cwd || process.cwd() })
      : null;
    const finishedAt = new Date();
    const ok = commandSucceeded(result) && commandSucceeded(focus);
    const stdout = ok
      ? `opened_folder=${folderTarget}\nforeground=${stripAnsi(focus?.stdout || '')}`
      : combineResultText(result, focus || {});
    const evidence = {
      commandRun,
      stdout,
      stderr: stripAnsi(result.stderr),
      exitCode: result.code,
      executedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
    };
    return {
      runId,
      agentId: 'hermes',
      status: ok ? 'done' : 'failed',
      output: {
        result: { text: ok ? `文件夹已打开并已前置到最前：${folderTarget}。验证证据：${stdout || '启动命令退出码为 0。'}` : `文件夹打开或前置失败：${stdout}`, taskId: task?.id || '' },
        evidence,
        suggestions: []
      },
      evidence,
      suggestions: [],
      finishedAt: finishedAt.toISOString()
    };
  }

  if (isSettingsTarget(goal) && /打开|启动|运行/i.test(goal)) {
    const uri = settingsUriForPage(goal);
    const args = ['/d', '/s', '/c', 'start', '""', uri];
    const commandRun = createNativeEvidence('cmd.exe', args);
    const result = await startDetachedNative('cmd.exe', args, { cwd: context.cwd || process.cwd(), onChild });
    const focus = commandSucceeded(result)
      ? await focusNativeWindow({ processName: 'SystemSettings|ApplicationFrameHost|cmd' }, { cwd: context.cwd || process.cwd() })
      : null;
    const finishedAt = new Date();
    const ok = commandSucceeded(result) && commandSucceeded(focus);
    const stdout = ok
      ? `opened_settings=${uri}\nforeground=${stripAnsi(focus?.stdout || '')}`
      : combineResultText(result, focus || {});
    const evidence = {
      commandRun,
      stdout,
      stderr: stripAnsi(result.stderr),
      exitCode: result.code,
      executedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
    };
    return {
      runId,
      agentId: 'hermes',
      status: ok ? 'done' : 'failed',
      output: {
        result: { text: ok ? `系统设置已打开并已前置到最前：${uri}。验证证据：${stdout || '启动命令退出码为 0。'}` : `系统设置打开或前置失败：${stdout}`, taskId: task?.id || '' },
        evidence,
        suggestions: []
      },
      evidence,
      suggestions: [],
      finishedAt: finishedAt.toISOString()
    };
  }

  const openTarget = extractOpenTarget(goal);
  if (openTarget) {
    const urlTarget = extractUrlTarget(goal);
    if (urlTarget || /网页|页面|网站|浏览器/i.test(goal)) {
      const target = urlTarget || openTarget;
      const args = ['/d', '/s', '/c', 'start', '""', target];
      const commandRun = createNativeEvidence('cmd.exe', args);
      const result = await runNativeCommand('cmd.exe', args, { timeoutMs: context.timeoutMs || 30000, cwd: context.cwd || process.cwd(), onChild });
      const finishedAt = new Date();
      const stdout = commandSucceeded(result)
        ? `opened_url=${target}`
        : combineResultText(result);
      const evidence = {
        commandRun,
        stdout,
        stderr: stripAnsi(result.stderr),
        exitCode: result.code,
        executedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
      };
      return {
        runId,
        agentId: 'hermes',
        status: commandSucceeded(result) ? 'done' : 'failed',
        output: {
          result: {
            text: commandSucceeded(result) ? `已在浏览器打开 ${target}。` : `浏览器打开失败：${combineResultText(result)}`,
            taskId: task?.id || ''
          },
          evidence,
          suggestions: []
        },
        evidence,
        suggestions: [],
        finishedAt: finishedAt.toISOString()
      };
    }
    const commandTarget = /记事本|notepad/i.test(openTarget)
      ? 'notepad.exe'
      : (isTerminalTarget(openTarget) ? 'powershell.exe' : openTarget);
    const args = [];
    const commandRun = createNativeEvidence(commandTarget, args);
    const result = await startDetachedNative(commandTarget, args, { cwd: context.cwd || process.cwd(), onChild });
    const focus = commandSucceeded(result)
      ? await focusNativeWindow({ processName: commandTarget.replace(/\.exe$/i, ''), pid: result.pid }, { cwd: context.cwd || process.cwd() })
      : null;
    if (!commandSucceeded(result) && /logon session|cannot execute|指定程序|登录会话/i.test(`${result.stdout}\n${result.stderr}`)) {
      return null;
    }
    const finishedAt = new Date();
    const ok = commandSucceeded(result) && commandSucceeded(focus);
    const stdout = ok
      ? `opened_app=${commandTarget}\nforeground=${stripAnsi(focus?.stdout || '')}`
      : combineResultText(result, focus || {});
    return {
      runId,
      agentId: 'hermes',
      status: ok ? 'done' : 'failed',
      output: {
        result: { text: ok ? `${openTarget} 已打开并已前置到最前。验证证据：${stdout || '启动命令退出码为 0。'}` : `${openTarget} 打开或前置失败：${stdout}`, taskId: task?.id || '' },
        evidence: {
          commandRun,
          stdout,
          stderr: stripAnsi(result.stderr),
          exitCode: result.code,
          executedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
        },
        suggestions: []
      },
      evidence: {
        commandRun,
        stdout,
        stderr: stripAnsi(result.stderr),
        exitCode: result.code,
        executedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
      },
      suggestions: [],
      finishedAt: finishedAt.toISOString()
    };
  }

  const installQuery = extractInstallQuery(goal);
  if (installQuery) {
    const installedArgs = ['-NoProfile', '-Command', installedSoftwareCommand(installQuery)];
    const installedBefore = await runNativeCommand('powershell.exe', installedArgs, { timeoutMs: 30000, cwd: context.cwd || process.cwd(), onChild });
    if (commandSucceeded(installedBefore) && hasInstalledSoftwareEvidence(installedBefore.stdout)) {
      const finishedAt = new Date();
      const commandRun = createNativeEvidence('powershell.exe', installedArgs);
      const stdout = stripAnsi(installedBefore.stdout);
      return {
        runId,
        agentId: 'hermes',
        status: 'done',
        output: {
          result: {
            text: `${installQuery} 已安装到电脑上。\n安装证据：${stdout}`,
            taskId: task?.id || ''
          },
          evidence: {
            commandRun,
            stdout,
            stderr: stripAnsi(installedBefore.stderr),
            exitCode: installedBefore.code,
            executedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
          },
          suggestions: []
        },
        evidence: {
          commandRun,
          stdout,
          stderr: stripAnsi(installedBefore.stderr),
          exitCode: installedBefore.code,
          executedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
        },
        suggestions: [],
        finishedAt: finishedAt.toISOString()
      };
    }
    const listArgs = ['list', '--name', installQuery, '--accept-source-agreements'];
    const installArgs = ['install', '--name', installQuery, '--accept-source-agreements', '--accept-package-agreements', '--silent'];
    const verifyArgs = ['list', '--name', installQuery, '--accept-source-agreements'];
    const listBefore = await runWinget(listArgs, { timeoutMs: 60000, cwd: context.cwd || process.cwd(), onChild });
    const alreadyInstalled = new RegExp(installQuery, 'i').test(`${listBefore.stdout}\n${listBefore.stderr}`);
    const installResult = alreadyInstalled
      ? { ok: true, code: 0, stdout: '已安装，跳过重复安装。', stderr: '' }
      : await runWinget(installArgs, { timeoutMs: context.timeoutMs || 600000, cwd: context.cwd || process.cwd(), onChild });
    const verifyResult = await runWinget(verifyArgs, { timeoutMs: 60000, cwd: context.cwd || process.cwd() });
    const finishedAt = new Date();
    const commandRun = createNativeEvidence('winget', alreadyInstalled ? listArgs : installArgs);
    const stdout = combineResultText(listBefore, installResult, verifyResult);
    const installed = new RegExp(installQuery, 'i').test(stdout) && !/未找到|No installed package|找不到/i.test(stdout);
    return {
      runId,
      agentId: 'hermes',
      status: installed ? 'done' : 'failed',
      output: {
        result: {
          text: installed
            ? `${installQuery} 已安装到电脑上。验证证据：winget 已能查到该软件。\n${stdout}`
            : `${installQuery} 安装没有完成。失败证据：\n${stdout || combineResultText(installResult)}`,
          taskId: task?.id || ''
        },
        evidence: {
          commandRun,
          stdout,
          stderr: combineResultText({ stdout: '', stderr: installResult.stderr || verifyResult.stderr || listBefore.stderr }),
          exitCode: installed ? 0 : (installResult.code ?? verifyResult.code ?? listBefore.code),
          executedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
        },
        suggestions: []
      },
      evidence: {
        commandRun,
        stdout,
        stderr: combineResultText({ stdout: '', stderr: installResult.stderr || verifyResult.stderr || listBefore.stderr }),
        exitCode: installed ? 0 : (installResult.code ?? verifyResult.code ?? listBefore.code),
        executedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime())
      },
      suggestions: [],
      finishedAt: finishedAt.toISOString()
    };
  }

  return null;
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
      if (!String(task?.userGoal || task?.prompt || task?.goal || task?.title || '').trim()) {
        throw new Error('Hermes 执行任务缺少目标');
      }
      const startedAt = new Date();
      const direct = await tryDirectWindowsAction(task, context, runId, startedAt, (child) => processes.set(runId, child));
      processes.delete(runId);
      if (direct) {
        runs.set(runId, direct);
        return direct;
      }
      const prompt = createHermesPrompt(task, context);
      const toolsets = String(context.toolsets || 'memory,terminal');
      const provider = String(context.provider || 'custom');
      const model = String(context.model || 'deepseek-chat');
      const args = ['chat', '-q', prompt, '--provider', provider, '-m', model, '--toolsets', toolsets];
      const commandRun = createCommandEvidence(args);
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
      const validCommand = String(evidence.commandRun || '').includes('hermes chat') || String(evidence.commandRun || '').startsWith('hermes-direct:');
      const hasModelFailure = /API call failed after \d+ retries|Final error:|HTTP 502: Error code/i.test(combinedOutput);
      const hasTaskFailure = /下载失败|安装失败|没有处理成功|失败原因|HTTPS 下载失败|TLS 握手失败|SEC_E_NO_CREDENTIALS|被安全策略阻止|要我试试|你自己用浏览器下载|下一步补救方案|无法运行/i.test(combinedOutput);
      return {
        ok: Boolean(result?.status === 'done' && hasContract && validCommand && evidence.exitCode === 0 && !hasModelFailure && !hasTaskFailure),
        evidence,
        message: hasModelFailure
          ? 'Hermes 命令返回了模型调用失败信息。'
          : (hasTaskFailure ? 'Hermes 返回的是失败报告或补救建议，不是已完成结果。'
          : (hasContract ? 'Hermes 返回了结构化结果和完整命令证据。' : 'Hermes 输出不符合结构化结果契约。')
          )
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
