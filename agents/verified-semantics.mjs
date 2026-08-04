export function deriveBoundVerifierResult({ task, run, verification, finalResult, finalEvidence } = {}) {
  if (!task || task.currentState !== 'completed' || task.failure) return false;
  if (!run || run.status !== 'completed' || run.taskId !== task.taskId) return false;
  if (!verification || verification.passed !== true) return false;
  if (!finalResult || finalResult.verified !== true) return false;
  if (!finalEvidence || finalEvidence.passed !== true) return false;

  const authoritativeRevision = run.taskRevision;
  if (verification.taskId !== task.taskId || verification.runId !== run.runId || verification.taskRevision !== authoritativeRevision) return false;
  if (finalResult.taskId !== task.taskId || finalResult.runId !== run.runId || finalResult.taskRevision !== authoritativeRevision) return false;
  if (finalEvidence.taskId !== task.taskId || finalEvidence.runId !== run.runId || finalEvidence.taskRevision !== authoritativeRevision) return false;

  if (task.activeRunId && task.activeRunId !== run.runId) return false;
  if (verification.verifierId !== finalEvidence.verifierId) return false;
  return true;
}

export function deriveTaskTerminalVerification(task) {
  if (!task || task.currentState !== 'completed' || task.failure) return false;
  const finalResult = task.finalResult;
  const runId = typeof finalResult?.runId === 'string' ? finalResult.runId : '';
  const run = Array.isArray(task.runs) ? task.runs.find((item) => item.runId === runId) : null;
  return deriveBoundVerifierResult({
    task,
    run,
    verification: run?.verification,
    finalResult,
    finalEvidence: run?.finalEvidence
  });
}
