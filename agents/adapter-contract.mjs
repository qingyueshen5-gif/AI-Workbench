export function assertAgentAdapter(adapter, agentId) {
  const required = [
    'healthCheck',
    'canHandle',
    'invoke',
    'execute',
    'status',
    'cancel',
    'verify',
    'normalizeError'
  ];

  for (const name of required) {
    if (typeof adapter?.[name] !== 'function') {
      throw new Error(`Agent adapter "${agentId}" is missing ${name}()`);
    }
  }

  return adapter;
}

export function createRunId(agentId) {
  return `${agentId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeTaskCapabilities(task) {
  return Array.isArray(task?.requiredCapabilities)
    ? task.requiredCapabilities.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

export function capabilityMatch(agent, task) {
  const required = normalizeTaskCapabilities(task);
  if (!required.length) return true;
  const available = new Set(agent.capabilities || []);
  return required.every((capability) => available.has(capability));
}
