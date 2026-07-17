export const agentDefinitions = [
  {
    id: 'deepseek',
    type: 'model',
    name: 'DeepSeek',
    capabilities: ['chat', 'structured_extraction', 'web_search', 'summarize', 'reasoning'],
    inputContract: 'messages_or_structured_task',
    outputContract: 'structured_result_with_evidence',
    riskLevel: 'low',
    costLevel: 'low',
    healthCheck: {
      type: 'api',
      description: 'Call DeepSeek chat completions with a minimal ping.'
    },
    invoke: {
      adapter: 'agents/adapters/deepseek.mjs',
      mode: 'openai_compatible_chat'
    },
    status: 'available',
    lastHealthCheckAt: '',
    failureCount: 0,
    notes: '适合大量、简单、重复的聊天提炼、总结和低成本文本任务。'
  },
  {
    id: 'hermes',
    type: 'agent',
    name: 'Hermes',
    capabilities: ['browser', 'terminal', 'file', 'memory', 'web_search', 'automation'],
    inputContract: 'natural_language_task',
    outputContract: 'structured_result_with_evidence',
    riskLevel: 'medium',
    costLevel: 'medium',
    healthCheck: {
      type: 'command',
      command: 'hermes',
      args: ['--version'],
      description: 'Run hermes --version from the Windows native Hermes install.'
    },
    invoke: {
      adapter: 'agents/adapters/hermes.mjs',
      mode: 'hermes_chat_cli',
      command: 'hermes chat -q "<task>" --provider custom -m deepseek-chat --toolsets memory,terminal'
    },
    status: 'available',
    lastHealthCheckAt: '',
    failureCount: 0,
    notes: '适合浏览器、终端、文件和重复流程执行；当前通过 Windows native Hermes + Git Bash 工作。'
  }
];
