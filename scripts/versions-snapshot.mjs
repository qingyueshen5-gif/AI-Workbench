import { saveSnapshot } from '../versions/manager.mjs';

const releaseArg = process.argv.find((arg) => arg.startsWith('--release='));
const release = releaseArg ? releaseArg.slice('--release='.length) : undefined;

const matrix = saveSnapshot({ release });
console.log(JSON.stringify({
  ok: true,
  release: matrix.release,
  workbench: matrix.workbench,
  employees: Object.fromEntries(Object.entries(matrix.employees).map(([id, item]) => [id, item.version])),
  models: Object.fromEntries(Object.entries(matrix.models).map(([id, item]) => [id, item.model]))
}, null, 2));
