import { agentDefinitions } from './definitions.mjs';
import { assertAgentAdapter } from './adapter-contract.mjs';

function cloneAgent(agent) {
  return JSON.parse(JSON.stringify(agent));
}

async function loadAdapterFactory(agent) {
  const adapterPath = agent?.invoke?.adapter;
  if (!adapterPath) throw new Error(`Agent "${agent.id}" is missing invoke.adapter`);
  const moduleUrl = new URL(`../${adapterPath}`, import.meta.url);
  const module = await import(moduleUrl);
  if (typeof module.createAdapter !== 'function') {
    throw new Error(`Agent adapter "${adapterPath}" must export createAdapter(agent)`);
  }
  return module.createAdapter;
}

export async function createAgentRegistry(definitions = agentDefinitions) {
  const agents = new Map();
  const adapters = new Map();

  for (const definition of definitions) {
    const agent = cloneAgent(definition);
    const factory = await loadAdapterFactory(agent);
    agents.set(agent.id, agent);
    adapters.set(agent.id, assertAgentAdapter(factory(agent), agent.id));
  }

  function getAgent(agentId) {
    const agent = agents.get(agentId);
    if (!agent) throw new Error(`Unknown agent "${agentId}"`);
    return agent;
  }

  function getAdapter(agentId) {
    getAgent(agentId);
    return adapters.get(agentId);
  }

  return {
    listAgents() {
      return [...agents.values()].map(cloneAgent);
    },

    getAgent(agentId) {
      return cloneAgent(getAgent(agentId));
    },

    async healthCheck(agentId) {
      const adapter = getAdapter(agentId);
      const result = await adapter.healthCheck();
      const agent = getAgent(agentId);
      agent.status = result.status || (result.ok ? 'available' : 'unavailable');
      agent.lastHealthCheckAt = result.checkedAt || new Date().toISOString();
      agent.failureCount = result.ok ? 0 : Number(agent.failureCount || 0) + 1;
      return result;
    },

    canHandle(agentId, task) {
      return getAdapter(agentId).canHandle(task);
    },

    execute(agentId, task, context = {}) {
      return getAdapter(agentId).execute(task, context);
    },

    status(agentId, runId) {
      return getAdapter(agentId).status(runId);
    },

    cancel(agentId, runId) {
      return getAdapter(agentId).cancel(runId);
    },

    verify(agentId, result) {
      return getAdapter(agentId).verify(result);
    },

    normalizeError(agentId, error) {
      return getAdapter(agentId).normalizeError(error);
    }
  };
}

export const agentRegistry = await createAgentRegistry();
