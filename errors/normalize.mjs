const recoveryHints = {
  timeout: {
    userMessage: '我在等待 Hermes 回复，有点慢……但我会继续等。',
    possibleCauses: ['Hermes 正在处理较慢的任务', '本机或网络暂时比较忙'],
    suggestedActions: [
      { action: '点这里查看 Hermes 状态', isClickable: true, url: '/api/agents/health' }
    ],
    severity: 'medium'
  },
  permission_denied: {
    userMessage: '这里需要更高权限，可能要你手动确认一下。',
    possibleCauses: ['当前运行环境权限不够', '目标文件或系统目录被保护'],
    suggestedActions: [
      { action: '点这里了解怎么解决', isClickable: true, url: '/help/permissions' }
    ],
    severity: 'high'
  },
  api_key_invalid: {
    userMessage: '我发现 DeepSeek API 配置不对，需要你重新填一下。',
    possibleCauses: ['API 配置填错了', 'API 配置已过期或没有权限'],
    suggestedActions: [
      { action: '点这里配置 API', isClickable: true, url: '/settings/api' }
    ],
    severity: 'high'
  },
  connection_refused: {
    userMessage: '连接断掉了，我在自动重连……',
    possibleCauses: ['本地服务没启动', '网络或代理暂时断开'],
    suggestedActions: [
      { action: '点这里查看连接状态', isClickable: true, url: '/api/data' }
    ],
    severity: 'medium'
  },
  rate_limit: {
    userMessage: '请求太频繁了，我会稍等一会儿再继续。',
    possibleCauses: ['短时间内请求太多', '服务方临时限制了请求'],
    suggestedActions: [
      { action: '点这里查看稍后重试建议', isClickable: true, url: '/help/retry-later' }
    ],
    severity: 'low'
  },
  invalid_argument: {
    userMessage: '我用错了某个参数，这是我的问题，我会调整后再试。',
    possibleCauses: ['调用参数格式不对', '某个员工接口要求变化了'],
    suggestedActions: [
      { action: '点这里查看内部记录', isClickable: true, url: '/api/data' }
    ],
    severity: 'medium'
  },
  fake_completion: {
    userMessage: '员工说完成了，但我没查出真正的证据，结果不算有效。',
    possibleCauses: ['员工没有返回证据', '证据和结果对不上'],
    suggestedActions: [
      { action: '点这里看具体是哪里出了问题', isClickable: true, url: '/api/verification-rules' }
    ],
    severity: 'high'
  },
  execution_failed: {
    userMessage: '执行过程中出了问题，我已经把失败原因记录下来了。',
    possibleCauses: ['命令没有执行成功', '目标文件、网络或工具状态异常'],
    suggestedActions: [
      { action: '点这里查看执行记录', isClickable: true, url: '/api/data' }
    ],
    severity: 'medium'
  },
  unknown: {
    userMessage: '这一步没有处理成功，我已经记录下来，后面会按错误记录继续排查。',
    possibleCauses: ['出现了暂未分类的问题'],
    suggestedActions: [
      { action: '点这里查看错误记录', isClickable: true, url: '/api/data' }
    ],
    severity: 'medium'
  }
};

const forbiddenUserTerms = [
  'timeout',
  'permission denied',
  'eacces',
  'invalid_api_key',
  '401 unauthorized',
  'econnrefused',
  'network error',
  'traceback'
];

function rawText(rawError) {
  if (typeof rawError === 'string') return rawError;
  if (rawError?.stack) return rawError.stack;
  if (rawError?.message) return rawError.message;
  return JSON.stringify(rawError || {});
}

function detectErrorType(rawError = {}) {
  const explicit = rawError.errorType || rawError.type || rawError.reason || rawError.code;
  const text = `${explicit || ''} ${rawText(rawError)}`.toLowerCase();
  if (/fake_completion|missing_evidence|invalid_evidence/.test(text)) return 'fake_completion';
  if (/execution_failed|exitcode|exit code|no such file|command failed/.test(text)) return 'execution_failed';
  if (/timeout|timed out|aborterror/.test(text)) return 'timeout';
  if (/permission denied|eacces|eperm|access is denied/.test(text)) return 'permission_denied';
  if (/invalid_api_key|401|unauthorized|api key|apikey|密钥/.test(text)) return 'api_key_invalid';
  if (/econnrefused|connection refused|network error|proxy|socket hang up/.test(text)) return 'connection_refused';
  if (/rate_limit|too many requests|429|限流/.test(text)) return 'rate_limit';
  if (/invalid argument|bad request|400|参数/.test(text)) return 'invalid_argument';
  return 'unknown';
}

function addRetryStatus(message, rawError) {
  const retryAttempt = rawError?.retryAttempt ?? rawError?.retry?.attempt;
  const retryMax = rawError?.retryMax ?? rawError?.retry?.max;
  if (retryAttempt === undefined) return message;
  return `${message} 当前是第 ${retryAttempt}${retryMax ? `/${retryMax}` : ''} 次重试。`;
}

function sanitizeUserMessage(message) {
  let output = String(message || recoveryHints.unknown.userMessage);
  for (const term of forbiddenUserTerms) {
    output = output.replace(new RegExp(term, 'ig'), '这个问题');
  }
  return output;
}

export function normalizeError(rawError = {}) {
  const errorType = detectErrorType(rawError);
  const hint = recoveryHints[errorType] || recoveryHints.unknown;
  const userMessage = sanitizeUserMessage(addRetryStatus(hint.userMessage, rawError));
  const technicalDetails = rawText(rawError);
  return {
    type: errorType,
    userMessage,
    technicalDetails,
    possibleCauses: hint.possibleCauses,
    suggestedActions: hint.suggestedActions,
    severity: hint.severity,
    fallbackDescription: `错误类型：${errorType}。原始信息已保留在 technicalDetails，默认不展示给用户。`
  };
}

export function getRecoveryHint(errorType) {
  const type = recoveryHints[errorType] ? errorType : 'unknown';
  return {
    type,
    ...recoveryHints[type]
  };
}

export function listRecoveryHints() {
  return Object.entries(recoveryHints).map(([type, hint]) => ({ type, ...hint }));
}

export function userMessageContainsForbiddenTerms(userMessage) {
  const text = String(userMessage || '').toLowerCase();
  return forbiddenUserTerms.filter((term) => text.includes(term));
}
