import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkHealth } from '../health/self-heal.mjs';
import { migrateLegacyRuntimeData, runtimeDataFile } from '../runtime-paths.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
migrateLegacyRuntimeData(root);

const result = await checkHealth({
  root,
  dataFile: runtimeDataFile,
  envFile: join(root, '.env')
});

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
