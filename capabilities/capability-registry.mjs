export class CapabilityRegistry {
  constructor(entries = defaultCapabilities()) { this.entries = entries.map((entry) => ({ ...entry, supportedActions: [...entry.supportedActions], inputTypes: [...entry.inputTypes], fallbackProviders: [...(entry.fallbackProviders || [])] })); }
  list() { return this.entries.map((entry) => ({ ...entry })); }
  find(capabilityId) { return this.entries.filter((entry) => entry.capabilityId === capabilityId); }
  available(capabilityId) { return this.find(capabilityId).filter((entry) => entry.availability === 'available'); }
  select(capabilityId, context = {}) {
    const candidates = this.available(capabilityId).filter((entry) => !context.action || entry.supportedActions.includes(context.action));
    if (!candidates.length) return null;
    const riskWeight = { low: 0, medium: 15, high: 50 };
    return [...candidates].sort((a, b) => {
      const score = (item) => (item.historicalSuccessRate * 100) - (item.estimatedLatency / 1000) - item.estimatedCost - (riskWeight[item.riskLevel] || 0);
      return score(b) - score(a);
    })[0];
  }
  providers(capabilityId) { return this.find(capabilityId); }
  setAvailability(providerId, availability) { this.entries = this.entries.map((entry) => entry.providerId === providerId ? { ...entry, availability } : entry); }
}

export function defaultCapabilities() {
  return [
    { capabilityId: 'conversation', providerId: 'deepseek', supportedActions: ['answer'], inputTypes: ['text'], riskLevel: 'low', availability: 'available', estimatedLatency: 1500, estimatedCost: 1, historicalSuccessRate: 0.99, requiresConfirmation: false, verificationMethod: 'non_empty_safe_text', fallbackProviders: [] },
    { capabilityId: 'file.read', providerId: 'local-tool-executor', supportedActions: ['read'], inputTypes: ['absolute_path'], riskLevel: 'low', availability: 'available', estimatedLatency: 500, estimatedCost: 0, historicalSuccessRate: 0.99, requiresConfirmation: false, verificationMethod: 'stat_and_sha256', fallbackProviders: [] },
    { capabilityId: 'runtime.status', providerId: 'local-runtime-state', supportedActions: ['status'], inputTypes: ['status_query'], riskLevel: 'low', availability: 'available', estimatedLatency: 100, estimatedCost: 0, historicalSuccessRate: 0.99, requiresConfirmation: false, verificationMethod: 'live_state_files', fallbackProviders: [] },
    { capabilityId: 'code.read', providerId: 'codex', supportedActions: ['read', 'inspect', 'analyze'], inputTypes: ['text', 'workspace'], riskLevel: 'low', availability: 'available', estimatedLatency: 20000, estimatedCost: 3, historicalSuccessRate: 0.96, requiresConfirmation: false, verificationMethod: 'independent_result_verifier', fallbackProviders: [] },
    { capabilityId: 'code.execute', providerId: 'codex', supportedActions: ['execute', 'test', 'build', 'debug'], inputTypes: ['text', 'workspace'], riskLevel: 'medium', availability: 'available', estimatedLatency: 30000, estimatedCost: 5, historicalSuccessRate: 0.95, requiresConfirmation: true, verificationMethod: 'independent_result_verifier', fallbackProviders: [] },
    { capabilityId: 'code.modify', providerId: 'codex', supportedActions: ['write', 'modify', 'fix'], inputTypes: ['text', 'workspace'], riskLevel: 'medium', availability: 'available', estimatedLatency: 60000, estimatedCost: 8, historicalSuccessRate: 0.94, requiresConfirmation: true, verificationMethod: 'diff_and_tests', fallbackProviders: [] },
    { capabilityId: 'process.list', providerId: 'local-process-provider', supportedActions: ['list', 'find'], inputTypes: ['process_name', 'application_alias'], riskLevel: 'low', availability: process.platform === 'win32' ? 'available' : 'unavailable', estimatedLatency: 300, estimatedCost: 0, historicalSuccessRate: 0.99, requiresConfirmation: false, verificationMethod: 'tasklist_snapshot', fallbackProviders: ['fallback-process-provider'] },
    { capabilityId: 'process.list', providerId: 'fallback-process-provider', supportedActions: ['list', 'find'], inputTypes: ['process_name', 'application_alias'], riskLevel: 'low', availability: 'unavailable', estimatedLatency: 500, estimatedCost: 1, historicalSuccessRate: 0.9, requiresConfirmation: false, verificationMethod: 'process_snapshot', fallbackProviders: [] },
    { capabilityId: 'process.stop', providerId: 'local-process-provider', supportedActions: ['stop'], inputTypes: ['exact_process_name', 'pid'], riskLevel: 'medium', availability: process.platform === 'win32' ? 'available' : 'unavailable', estimatedLatency: 1000, estimatedCost: 0, historicalSuccessRate: 0.98, requiresConfirmation: true, verificationMethod: 'post_stop_process_snapshot', fallbackProviders: ['fallback-process-provider'] },
    { capabilityId: 'process.stop', providerId: 'fallback-process-provider', supportedActions: ['stop'], inputTypes: ['pid'], riskLevel: 'medium', availability: 'unavailable', estimatedLatency: 2000, estimatedCost: 1, historicalSuccessRate: 0.9, requiresConfirmation: true, verificationMethod: 'post_stop_process_snapshot', fallbackProviders: [] }
  ];
}

export function applicationCatalog() {
  return [
    { applicationId: 'wechat', aliases: ['微信', 'wechat', 'weixin'], executableNames: ['Weixin.exe', 'WeChat.exe', 'WeChatAppEx.exe'] }
  ];
}

export function resolveApplicationTarget(value, catalog = applicationCatalog()) {
  const text = String(value || '').trim().toLowerCase();
  return catalog.find((entry) => entry.aliases.some((alias) => text === alias.toLowerCase() || text.includes(alias.toLowerCase()))) || null;
}
