import { existsSync, mkdirSync, readdirSync, renameSync, statSync, copyFileSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function getRuntimeRoot() {
  const explicit = String(process.env.AI_WORKBENCH_RUNTIME_DIR || '').trim();
  if (explicit) return explicit;
  const appData = String(process.env.APPDATA || '').trim();
  if (appData) return join(appData, 'ai-workbench');
  return join(process.cwd(), '.ai-workbench-runtime');
}

export const runtimeRoot = getRuntimeRoot();
export const runtimeDataDir = join(runtimeRoot, 'data');
export const runtimeLogsDir = join(runtimeRoot, 'logs');
export const runtimeEvidenceDir = join(runtimeRoot, 'evidence');
export const runtimeDataFile = join(runtimeDataDir, 'workbench.json');
export const runtimeModelProxyLogFile = join(runtimeLogsDir, 'model-proxy-calls.jsonl');
export const runtimeStartupLogFile = join(runtimeLogsDir, 'workbench-startup.log');
export const runtimeStartupErrorLogFile = join(runtimeLogsDir, 'workbench-startup.err.log');

export function ensureRuntimeDirs() {
  for (const dir of [runtimeRoot, runtimeDataDir, runtimeLogsDir, runtimeEvidenceDir]) {
    mkdirSync(dir, { recursive: true });
  }
}

function uniqueDestination(path) {
  if (!existsSync(path)) return path;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = dirname(path);
  const name = path.slice(folder.length + 1);
  return join(folder, `${stamp}-${name}`);
}

function copyThenRemoveFile(source, destination) {
  try {
    if (!existsSync(source) || !statSync(source).isFile()) return false;
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, uniqueDestination(destination));
    rmSync(source, { force: true });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function copyThenRemoveDir(source, destination) {
  try {
    if (!existsSync(source) || !statSync(source).isDirectory()) return false;
    mkdirSync(dirname(destination), { recursive: true });
    if (!existsSync(destination)) {
      renameSync(source, destination);
    } else {
      cpSync(source, destination, { recursive: true, force: false, errorOnExist: false });
      rmSync(source, { recursive: true, force: true });
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    if (error.code === 'EEXIST') {
      rmSync(source, { recursive: true, force: true });
      return true;
    }
    throw error;
  }
}

export function migrateLegacyRuntimeData(projectRoot = process.cwd()) {
  ensureRuntimeDirs();
  const migrated = [];

  if (copyThenRemoveFile(join(projectRoot, 'data', 'workbench.json'), runtimeDataFile)) {
    migrated.push('data/workbench.json');
  }
  if (copyThenRemoveFile(join(projectRoot, 'data', 'model-proxy-calls.jsonl'), runtimeModelProxyLogFile)) {
    migrated.push('data/model-proxy-calls.jsonl');
  }
  copyThenRemoveDir(join(projectRoot, 'evidence'), runtimeEvidenceDir) && migrated.push('evidence/');

  const logNames = [
    '.workbench-startup.log',
    '.workbench-startup.err.log',
    '.dev-server.log',
    '.dev-server.err.log',
    '.api.log',
    '.api.err.log',
    '.e2e-dev.log',
    '.e2e-dev.err.log'
  ];
  for (const name of logNames) {
    if (copyThenRemoveFile(join(projectRoot, name), join(runtimeLogsDir, name.replace(/^\./, '')))) {
      migrated.push(name);
    }
  }

  const legacyDataDir = join(projectRoot, 'data');
  try {
    if (existsSync(legacyDataDir) && statSync(legacyDataDir).isDirectory() && readdirSync(legacyDataDir).length === 0) {
      rmSync(legacyDataDir, { recursive: true, force: true });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return migrated;
}
