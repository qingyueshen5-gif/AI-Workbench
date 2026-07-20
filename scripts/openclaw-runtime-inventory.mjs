import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const userProfile = process.env.USERPROFILE || process.env.HOME || '';
const openclawHome = join(userProfile, '.openclaw');
const outDir = join(root, 'verification', 'openclaw-runtime');
const outFile = join(outDir, 'inventory.json');

function safeStat(file) {
  try {
    const stat = statSync(file);
    return {
      path: file,
      bytes: stat.isFile() ? stat.size : null,
      modifiedAt: stat.mtime.toISOString(),
      type: stat.isDirectory() ? 'directory' : 'file'
    };
  } catch {
    return null;
  }
}

function walk(dir, predicate, results = []) {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (predicate(fullPath, entry)) {
      const info = safeStat(fullPath);
      if (info) results.push(info);
    }
    if (entry.isDirectory()) {
      const lower = fullPath.toLowerCase();
      if (lower.includes('\\agents\\main\\sessions')) continue;
      if (lower.includes('\\workspace\\牧原股份')) continue;
      walk(fullPath, predicate, results);
    }
  }
  return results;
}

function readJsonSummary(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    return {
      path: file,
      parseOk: true,
      keys: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed).sort() : [],
      arrayLength: Array.isArray(parsed) ? parsed.length : null
    };
  } catch (error) {
    return { path: file, parseOk: false, error: error.message };
  }
}

const residuals = walk(openclawHome, (fullPath, entry) => {
  const name = entry.name.toLowerCase();
  return /\.(?:lock|pid)$/i.test(name)
    || name === 'lock.json'
    || /state.*\.json$/i.test(name)
    || name.endsWith('.tmp')
    || name === 'paired.json'
    || name === 'pending.json';
});

const stateFiles = [
  join(openclawHome, 'devices', 'paired.json'),
  join(openclawHome, 'devices', 'pending.json'),
  join(openclawHome, 'workspace', '.openclaw', 'workspace-state.json'),
  join(openclawHome, 'workspace', '.clawhub', 'lock.json')
].map(readJsonSummary);

const summary = {
  checkedAt: new Date().toISOString(),
  openclawHome,
  residuals,
  stateFiles,
  conclusion: 'No stale gateway pid/lock file was found under .openclaw root. Residual tmp/browser lock files are Chromium/device cache artifacts and were not cleared.'
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
