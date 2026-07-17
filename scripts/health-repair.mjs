import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairAll } from '../health/self-heal.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const result = await repairAll({
  root,
  dataFile: join(root, 'data', 'workbench.json'),
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
