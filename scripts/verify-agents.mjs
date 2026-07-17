import { agentRegistry } from '../agents/registry.mjs';

const results = [];

for (const agent of agentRegistry.listAgents()) {
  const result = await agentRegistry.healthCheck(agent.id);
  results.push({
    id: agent.id,
    name: agent.name,
    type: agent.type,
    ok: result.ok,
    status: result.status,
    checkedAt: result.checkedAt,
    evidence: result.evidence || null,
    error: result.error || null
  });
}

console.log(JSON.stringify({ agents: results }, null, 2));

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  process.exitCode = 1;
}
