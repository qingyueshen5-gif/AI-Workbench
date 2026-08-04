export {
  RUN_TRUST_FIELD_POLICY,
  RUN_OPAQUE_BOUNDARIES,
  RUN_FORBIDDEN_PATHS as ALL_SERVER_OWNED_RUN_PATHS
} from '../../shared/run-trust-field-policy.mjs';

export { RUN_FORBIDDEN_PATHS as SERVER_OWNED_RUN_TRUST_PATHS } from '../../shared/run-trust-field-policy.mjs';
export const SERVER_OWNED_RUN_AUTHORITY_PATHS = Object.freeze(['trustedTask']);
