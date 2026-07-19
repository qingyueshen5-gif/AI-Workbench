import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkModelAvailability,
  doctor,
  restorePlan,
  writeVerificationReport
} from '../versions/manager.mjs';

const tempRoot = join(process.cwd(), '.tmp-version-management', 'fixture-versions');
mkdirSync(join(tempRoot, 'releases'), { recursive: true });

const lockedEmployees = {
  hermes: {
    id: 'hermes',
    name: 'Hermes',
    version: '0.17.0',
    available: true,
    manager: 'pip',
    packageName: 'hermes',
    installPath: 'C:\\Tools\\hermes.exe',
    command: 'hermes --version',
    checkedAt: new Date().toISOString(),
    error: ''
  },
  openclaw: {
    id: 'openclaw',
    name: 'OpenClaw',
    version: '1.2.3',
    available: true,
    manager: 'npm',
    packageName: 'openclaw',
    installPath: 'C:\\Users\\me\\AppData\\Roaming\\npm\\openclaw.cmd',
    command: 'openclaw --version',
    checkedAt: new Date().toISOString(),
    error: ''
  }
};

const lockedModels = {
  deepseek: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    version: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    purpose: 'default_chat_and_extraction',
    lockedAt: new Date().toISOString()
  }
};

const matrix = {
  schemaVersion: 1,
  release: 'v0.4.5-test',
  workbench: {
    version: '0.4.4',
    commit: 'fixture',
    tag: 'v0.4.5-test',
    dirty: false
  },
  createdAt: new Date().toISOString(),
  employees: lockedEmployees,
  models: lockedModels,
  verification: {
    snapshot: 'passed',
    doctor: 'passed',
    modelAvailability: 'simulated'
  },
  notes: 'Version-management verification fixture.'
};
writeFileSync(join(tempRoot, 'current.json'), `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
writeFileSync(join(tempRoot, 'releases', 'v0.4.5-test.json'), `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');

const query = doctor('v0.4.5-test', {
  versionsDir: tempRoot,
  currentEmployees: lockedEmployees,
  currentModels: lockedModels
});
assert.equal(query.ok, true, 'current version matrix should be queryable and consistent');

const driftedEmployees = {
  ...lockedEmployees,
  hermes: { ...lockedEmployees.hermes, version: '0.18.0' }
};
const drift = doctor('v0.4.5-test', {
  versionsDir: tempRoot,
  currentEmployees: driftedEmployees,
  currentModels: lockedModels
});
assert.equal(drift.ok, false, 'doctor should detect an employee upgrade drift');
assert(drift.checks.some((check) => check.id === 'hermes' && !check.ok), 'Hermes drift should be explicit');

const rollback = restorePlan('v0.4.5-test', { versionsDir: tempRoot, dryRun: true });
assert.equal(rollback.dryRun, true, 'rollback demo must be dry-run');
assert(rollback.commands.some((command) => command.id === 'hermes' && command.command === 'pip' && command.args.includes('hermes==0.17.0')), 'Hermes rollback should pin pip version');
assert(rollback.commands.some((command) => command.id === 'openclaw' && command.command === 'npm.cmd' && command.args.includes('openclaw@1.2.3')), 'OpenClaw rollback should pin npm version');

const unavailable = await checkModelAvailability({
  matrix,
  simulateUnavailable: 'deepseek-chat'
});
assert.equal(unavailable.ok, false, 'model unavailable simulation should fail');
assert.match(unavailable.results[0].message, /不可用|下线|候选模型|功能降级/, 'unavailable model message should guide user choice');

const report = {
  ok: true,
  matrix: {
    release: query.release,
    employees: Object.fromEntries(Object.entries(matrix.employees).map(([id, item]) => [id, item.version])),
    models: Object.fromEntries(Object.entries(matrix.models).map(([id, item]) => [id, item.model]))
  },
  demo: {
    locked: query,
    upgradedDrift: drift,
    rollbackPlan: rollback,
    modelUnavailable: unavailable
  }
};

const file = writeVerificationReport('summary.json', report);
console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
