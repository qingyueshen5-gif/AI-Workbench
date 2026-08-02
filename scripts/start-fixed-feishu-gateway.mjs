import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeRoot } from '../runtime-paths.mjs';
import { writeRuntimeSelection } from './runtime-supervisor.mjs';

const gatewayRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const baselineRoot = process.env.AIW_BASELINE_RUNTIME_ROOT || gatewayRoot;
const baselineCommit = process.env.AIW_BASELINE_RUNTIME_COMMIT || '8d62cdd6432f500254b48847ea58c132c3c5cdad';
const ipcRoot = join(runtimeRoot, 'feishu-workbench-bridge', 'ipc');
const conversationRoot = join(runtimeRoot, 'feishu-workbench-bridge', 'conversations');
await writeRuntimeSelection({ selected: { root: baselineRoot, commit: baselineCommit, tag: 'v0.4.7-workflow-baseline-rc1' }, fallback: { root: baselineRoot, commit: baselineCommit, tag: 'v0.4.7-workflow-baseline-rc1' }, requestedBy: 'gateway-startup' });
const common = { ...process.env, AIW_FEISHU_IPC_DIR: ipcRoot, AIW_CONVERSATION_DIR: conversationRoot, AIW_ACTIVE_TASK_DIR: join(runtimeRoot, 'feishu-workbench-bridge', 'active-tasks'), AIW_RUNTIME_GIT_COMMIT: baselineCommit };
const gateway = spawn(process.execPath, ['scripts/workbench-feishu-adapter.mjs'], { cwd: gatewayRoot, env: common, stdio: 'inherit' });
const supervisor = spawn(process.execPath, ['scripts/runtime-supervisor.mjs'], { cwd: gatewayRoot, env: common, stdio: 'inherit' });
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;gateway.kill('SIGTERM');supervisor.kill('SIGTERM');setTimeout(()=>process.exit(code),100);}
process.once('SIGINT',()=>stop(0));process.once('SIGTERM',()=>stop(0));
for(const child of [gateway,supervisor]) child.once('exit',(code)=>{if(!stopping&&code)stop(code);});
