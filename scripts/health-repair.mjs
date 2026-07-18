import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairAll } from '../health/self-heal.mjs';
import { migrateLegacyRuntimeData, runtimeDataFile } from '../runtime-paths.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
migrateLegacyRuntimeData(root);

const result = await repairAll({
  root,
  dataFile: runtimeDataFile,
  envFile: join(root, '.env'),
  defaultData: {
    dailyGoals: {},
    messages: [],
    conversations: [],
    activeConversationId: '',
    tasks: [],
    runs: [],
    memories: [],
    systemErrors: []
  }
});

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.repairs.some((repair) => repair.ok === false && repair.userVisible === true) ? 1 : 0;
