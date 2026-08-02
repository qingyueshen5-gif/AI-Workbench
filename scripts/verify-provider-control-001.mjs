import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { AgentRuntime } from '../agents/agent-runtime.mjs';

const runtime = new AgentRuntime({
  sessions: {}, tasks: {}, activeController: {}, models: {}, tools: {}, verifier: {},
  taskInterpreter: {}, scheduler: {}, capabilityRegistry: {}, providers: {}
});
assert.doesNotThrow(() => runtime.assertProviderAuthorized({ capabilityId: 'conversation', authorization: { required: false, valid: true } }));
assert.doesNotThrow(() => runtime.assertProviderAuthorized({ capabilityId: 'process.stop', authorization: { required: true, valid: true } }));
assert.throws(() => runtime.assertProviderAuthorized({ capabilityId: 'process.stop', authorization: { required: true, valid: false } }), /authorization missing/);
assert.throws(() => runtime.assertProviderAuthorized({ capabilityId: 'code.modify', authorization: { required: true } }), /authorization missing/);

const source = await fs.readFile('agents/agent-runtime.mjs', 'utf8');
assert.match(source, /processCapabilities[\s\S]+assertProviderAuthorized/);
assert.match(source, /codeTask[\s\S]+assertProviderAuthorized/);
console.log(JSON.stringify({ ok: true, module: 'PROVIDER-CONTROL-001', providerBoundaryRechecksAuthorization: true, processProviderGuarded: true, codeProviderGuarded: true, lowRiskUnaffected: true }));
