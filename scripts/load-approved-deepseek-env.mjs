import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const approvedEnvFiles = [
  join(process.cwd(), '.env.local'),
  join(process.cwd(), '.env'),
  'E:\\AI-Workbench\\.env',
  'E:\\AI-Workbench\\.env.local',
  'C:\\Users\\qingy\\AppData\\Roaming\\ai-workbench\\.env'
];

export function loadApprovedDeepSeekEnv() {
  for (const file of approvedEnvFiles) {
    let raw = '';
    try { raw = readFileSync(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      if (!['DEEPSEEK_API_KEY', 'MODEL_PROXY_DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL'].includes(key)) continue;
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
      if (value && process.env[key] === undefined) process.env[key] = value;
    }
  }
}
