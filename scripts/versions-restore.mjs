import { restoreEmployees } from '../versions/manager.mjs';

const release = process.argv.find((arg) => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]) || 'current';
const execute = process.argv.includes('--execute');

const result = restoreEmployees(release, { dryRun: !execute });
console.log(JSON.stringify(result, null, 2));
if (execute && result.results.some((item) => !item.ok && !item.skipped)) process.exit(1);
