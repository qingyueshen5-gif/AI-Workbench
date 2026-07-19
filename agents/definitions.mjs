export const agentDefinitions = [
  {
    id: 'deepseek',
    type: 'model',
    name: 'DeepSeek',
    version: 'deepseek-chat',
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
    version: 'detected-at-runtime',
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
  },
  {
    id: 'openclaw',
    type: 'agent',
    name: 'OpenClaw',
    version: 'detected-at-runtime',
    capabilities: ['orchestration', 'browser_automation', 'long_running_task', 'mobile_channel', 'chat_channel', 'gateway', 'agent_session', 'feishu', 'telegram', 'discord', 'slack'],
    inputContract: 'natural_language_task',
    outputContract: 'structured_result_with_evidence',
    riskLevel: 'medium',
    costLevel: 'medium',
    healthCheck: {
      type: 'command',
      command: 'openclaw',
      args: ['status', '--json', '--timeout', '5000'],
      description: 'Run OpenClaw CLI through the Windows npm .cmd shim and inspect gateway/channel/agent status.'
    },
    invoke: {
      adapter: 'agents/adapters/openclaw.mjs',
      mode: 'openclaw_agent_cli',
      command: 'openclaw agent --local --json --agent main --message "<task>"'
    },
    status: 'available',
    lastHealthCheckAt: '',
    failureCount: 0,
    notes: '适合长任务编排、浏览器或网页自动化、手机/聊天通道、Gateway 和多 Agent 会话；纯文本总结优先 DeepSeek，终端/文件读写优先 Hermes。'
  }
];
