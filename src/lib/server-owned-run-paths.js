export const SERVER_OWNED_RUN_TRUST_PATHS = Object.freeze([
  'verified',
  'verification',
  'verification.passed',
  'verificationPassed',
  'verificationResult',
  'finalEvidence',
  'finalResult.verified',
  'verifierId',
  'verifiedAt',
  'runEvidenceValidated',
  'legacyVerifiedClaimObserved'
]);

export const SERVER_OWNED_RUN_AUTHORITY_PATHS = Object.freeze([
  'trustedTask'
]);

export const ALL_SERVER_OWNED_RUN_PATHS = Object.freeze([
  ...SERVER_OWNED_RUN_TRUST_PATHS,
  ...SERVER_OWNED_RUN_AUTHORITY_PATHS
]);
