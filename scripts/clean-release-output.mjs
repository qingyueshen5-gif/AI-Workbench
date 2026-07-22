import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const releaseDir = join(root, `release-v${version}-installer`);

if (existsSync(releaseDir)) {
  for (const name of readdirSync(releaseDir)) {
    if (
      name === 'win-unpacked'
      || name.startsWith('win-unpacked.tmp')
      || name === `AI-Workbench-Setup-v${version}-x64.exe`
      || name === `AI-Workbench-Setup-v${version}-x64.exe.blockmap`
      || name === 'builder-debug.yml'
      || name === 'latest.yml'
    ) {
      rmSync(join(releaseDir, name), { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
    }
  }
}

console.log(`Cleaned ${releaseDir}`);
