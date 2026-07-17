export const verificationRules = [
  {
    type: 'code',
    evidenceRequired: ['gitDiff_or_commitHash', 'testResult'],
    checks: ['has_code_change_evidence', 'has_test_result']
  },
  {
    type: 'hermes',
    evidenceRequired: ['commandRun', 'stdout', 'stderr', 'exitCode', 'durationMs'],
    checks: ['exitCode_is_0', 'stderr_empty', 'durationMs_present', 'stdout_present']
  },
  {
    type: 'search',
    evidenceRequired: ['sourceLinks', 'dates', 'summary'],
    checks: ['sources_have_links', 'sources_have_dates', 'summary_present']
  },
  {
    type: 'file',
    evidenceRequired: ['fileExists', 'fileSizeBytes', 'contentHash_or_summary'],
    checks: ['file_exists', 'file_size_present', 'hash_or_summary_present']
  }
];

function getEvidence(run) {
  return run?.output?.evidence || run?.evidence || {};
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && value !== '';
}

function detectVerificationType(run) {
  const evidence = getEvidence(run);
  const explicit = run?.verificationType || run?.input?.verificationType || run?.input?.task?.verificationType;
  if (explicit) return explicit;
  if (run?.agentId === 'hermes' || evidence.commandRun?.includes?.('hermes')) return 'hermes';
  if (hasValue(evidence.filePath) || hasValue(evidence.fileExists)) return 'file';
  if (hasValue(evidence.sources) || hasValue(evidence.sourceLinks)) return 'search';
  if (hasValue(evidence.gitDiff) || hasValue(evidence.commitHash) || hasValue(evidence.testResult)) return 'code';
  return 'generic';
}

function missing(reason, details = {}) {
  return { ok: false, reason, details };
}

function pass(type, evidence, details = {}) {
  return {
    ok: true,
    reason: 'verified',
    type,
    evidence,
    details
  };
}

function verifyHermes(run, evidence) {
  const required = ['commandRun', 'stdout', 'stderr', 'exitCode', 'durationMs'];
  const missingFields = required.filter((field) => !Object.prototype.hasOwnProperty.call(evidence, field));
  if (missingFields.length) return missing('missing_evidence', { type: 'hermes', missingFields });
  if (!String(evidence.commandRun || '').includes('hermes chat')) {
    return missing('invalid_evidence', { type: 'hermes', field: 'commandRun' });
  }
  if (Number(evidence.exitCode) !== 0) {
    return missing('execution_failed', { type: 'hermes', exitCode: evidence.exitCode, stderr: evidence.stderr || '' });
  }
  if (String(evidence.stderr || '').trim()) {
    return missing('execution_failed', { type: 'hermes', exitCode: evidence.exitCode, stderr: evidence.stderr });
  }
  if (!hasValue(evidence.stdout)) return missing('missing_evidence', { type: 'hermes', missingFields: ['stdout'] });
  if (!Number.isFinite(Number(evidence.durationMs)) || Number(evidence.durationMs) < 0) {
    return missing('invalid_evidence', { type: 'hermes', field: 'durationMs' });
  }
  return pass('hermes', evidence);
}

function verifyFile(run, evidence) {
  const missingFields = [];
  if (!Object.prototype.hasOwnProperty.call(evidence, 'fileExists')) missingFields.push('fileExists');
  if (!Object.prototype.hasOwnProperty.call(evidence, 'fileSizeBytes')) missingFields.push('fileSizeBytes');
  if (!hasValue(evidence.contentHash) && !hasValue(evidence.summary)) missingFields.push('contentHash_or_summary');
  if (missingFields.length) return missing('missing_evidence', { type: 'file', missingFields });
  if (evidence.fileExists !== true) return missing('execution_failed', { type: 'file', fileExists: evidence.fileExists });
  if (!Number.isFinite(Number(evidence.fileSizeBytes)) || Number(evidence.fileSizeBytes) < 0) {
    return missing('invalid_evidence', { type: 'file', field: 'fileSizeBytes' });
  }
  return pass('file', evidence);
}

function verifySearch(run, evidence) {
  const sources = evidence.sources || evidence.sourceLinks || [];
  const missingFields = [];
  if (!Array.isArray(sources) || !sources.length) missingFields.push('sourceLinks');
  if (!hasValue(evidence.summary)) missingFields.push('summary');
  if (missingFields.length) return missing('missing_evidence', { type: 'search', missingFields });
  const invalidSource = sources.find((source) => !source.link || !source.date);
  if (invalidSource) return missing('invalid_evidence', { type: 'search', invalidSource });
  return pass('search', evidence);
}

function verifyCode(run, evidence) {
  const hasChange = hasValue(evidence.gitDiff) || hasValue(evidence.commitHash);
  const missingFields = [];
  if (!hasChange) missingFields.push('gitDiff_or_commitHash');
  if (!hasValue(evidence.testResult)) missingFields.push('testResult');
  if (missingFields.length) return missing('missing_evidence', { type: 'code', missingFields });
  if (evidence.testResult?.ok === false || evidence.testResult?.exitCode > 0) {
    return missing('execution_failed', { type: 'code', testResult: evidence.testResult });
  }
  return pass('code', evidence);
}

function verifyGeneric(run, evidence) {
  if (!hasValue(evidence)) return missing('missing_evidence', { type: 'generic', missingFields: ['evidence'] });
  return pass('generic', evidence);
}

export function verifyRun(run) {
  const evidence = getEvidence(run);
  const type = detectVerificationType(run);
  if (!hasValue(evidence)) {
    return {
      ...missing('missing_evidence', { type, missingFields: ['evidence'] }),
      checkedAt: new Date().toISOString(),
      ruleType: type
    };
  }
  const result = (() => {
    if (type === 'hermes') return verifyHermes(run, evidence);
    if (type === 'file') return verifyFile(run, evidence);
    if (type === 'search') return verifySearch(run, evidence);
    if (type === 'code') return verifyCode(run, evidence);
    return verifyGeneric(run, evidence);
  })();
  return {
    ...result,
    checkedAt: new Date().toISOString(),
    ruleType: type
  };
}
