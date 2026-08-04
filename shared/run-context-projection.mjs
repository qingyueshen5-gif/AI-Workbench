import { deriveBoundVerifierResult } from '../agents/verified-semantics.mjs';
import { RUN_OPAQUE_BOUNDARIES } from './run-trust-field-policy.mjs';

export function projectRunForAgentContext(run) {
  const boundRun = run ? { ...run, runId: run.id } : null;
  const verified = deriveBoundVerifierResult({
    task: run?.trustedTask,
    run: boundRun,
    verification: run?.verification,
    finalResult: run?.finalResult,
    finalEvidence: run?.finalEvidence
  });
  const revision = run?.taskRevision ?? null;
  const businessData = Object.fromEntries(RUN_OPAQUE_BOUNDARIES
    .filter((path) => path !== 'memorySuggestions' && Object.hasOwn(run || {}, path))
    .map((path) => [path, run[path]]));
  if (Object.hasOwn(run || {}, 'memorySuggestions')) businessData.memorySuggestions = run.memorySuggestions;
  return {
    id: run?.id,
    taskId: run?.taskId,
    agentId: run?.agentId,
    verified,
    verificationStatus: {
      verified,
      source: verified ? 'BOUND_VERIFIER' : 'UNVERIFIED',
      trusted: verified,
      taskId: verified ? run.trustedTask?.taskId ?? null : null,
      runId: verified ? run.id ?? null : null,
      taskRevision: verified ? revision : null
    },
    executionFacts: {
      status: run?.status,
      executionStarted: run?.executionStarted === true,
      executionCompleted: run?.executionCompleted === true,
      postconditionObserved: run?.postconditionObserved === true,
      runEvidenceValidated: run?.runEvidenceValidated === true,
      handled: run?.handled === true,
      rendered: run?.rendered === true,
      policyApplied: run?.policyApplied === true,
      failure: run?.trustedTask?.failure || run?.failure || null
    },
    businessData
  };
}
