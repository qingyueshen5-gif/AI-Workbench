import { checkModelAvailability } from '../versions/manager.mjs';

const release = process.argv.find((arg) => arg.startsWith('--release='))?.slice('--release='.length) || 'current';
const simulateUnavailable = process.argv.find((arg) => arg.startsWith('--simulate-unavailable='))?.slice('--simulate-unavailable='.length);
const remoteCheck = process.argv.includes('--remote');

const result = await checkModelAvailability({ release, simulateUnavailable, remoteCheck });
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
