import { doctor } from '../versions/manager.mjs';

const release = process.argv[2] || 'current';
const result = doctor(release);
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
