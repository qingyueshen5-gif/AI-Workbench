const FAILED = new Set(['failed', '失败']);
const CANCELLED = new Set(['cancelled', 'canceled', '已取消', '取消']);
const RUNNING = new Set(['running', '进行中']);
const TERMINAL = new Set(['completed', 'done', '已完成']);

export function deriveVerificationView(value = {}) {
  const structured = value.verificationStatus;
  const structuredVerified = structured?.verified === true
    && structured?.trusted === true
    && structured?.source === 'BOUND_VERIFIER';
  const directVerified = !structured && value.verified === true;
  const verified = structuredVerified || directVerified;
  return {
    code: verified ? 'VERIFIED' : 'UNVERIFIED',
    verified,
    trusted: structured ? structuredVerified : directVerified,
    source: structured?.source || (directVerified ? 'SERVER_VERIFIED' : 'UNVERIFIED'),
    semanticRole: verified ? 'trusted-verification' : 'verification-pending'
  };
}

export function deriveExecutionView(value = {}, verification = deriveVerificationView(value)) {
  const status = value.currentState || value.status || '';
  const failed = Boolean(value.failure) || FAILED.has(status);
  const cancelled = CANCELLED.has(status);
  const running = RUNNING.has(status) || (!failed && !cancelled && value.executionStarted === true && value.executionCompleted !== true);
  const terminal = failed || cancelled || TERMINAL.has(status) || value.executionCompleted === true;
  let code = 'NOT_STARTED';
  if (failed) code = 'FAILED';
  else if (cancelled) code = 'CANCELLED';
  else if (running) code = 'RUNNING';
  else if (terminal && verification.verified) code = 'VERIFIED_COMPLETED';
  else if (terminal) code = 'TERMINAL_UNVERIFIED';
  const inconsistentVerification = verification.verified && !['VERIFIED_COMPLETED'].includes(code);
  if (inconsistentVerification) {
    return { code: failed ? 'FAILED' : cancelled ? 'CANCELLED' : running ? 'RUNNING' : code, terminal, failed, cancelled, inconsistentVerification: true, semanticRole: failed ? 'failure' : cancelled ? 'cancelled' : running ? 'in-progress' : 'execution' };
  }
  return { code, terminal, failed, cancelled, inconsistentVerification: false, semanticRole: code === 'VERIFIED_COMPLETED' ? 'execution-terminal' : failed ? 'failure' : cancelled ? 'cancelled' : running ? 'in-progress' : 'execution' };
}

export function deriveRunStatusView(value = {}) {
  let verification = deriveVerificationView(value);
  const execution = deriveExecutionView(value, verification);
  if (execution.inconsistentVerification) verification = { ...verification, code: 'UNVERIFIED', verified: false, trusted: false, semanticRole: 'verification-inconsistent' };
  return {
    execution,
    verification,
    failure: value.failure || null,
    facts: {
      executionStarted: value.executionStarted === true,
      executionCompleted: value.executionCompleted === true,
      postconditionObserved: value.postconditionObserved === true,
      runEvidenceValidated: value.runEvidenceValidated === true,
      handled: value.handled === true,
      rendered: value.rendered === true,
      policyApplied: value.policyApplied === true
    },
    businessSummary: value.userVisibleSummary || value.notes || ''
  };
}
