# Legacy Workbench Run API Historical Assertions

HISTORICAL  
NON_AUTHORITATIVE  
NOT_EXECUTABLE_AS_CURRENT_CONTRACT

## S6-MEM-A001

### Historical Contract Identity
Client-supplied `verified=true` and `verificationResult.ok=true` were treated as part of a successful Run creation contract.

### Why It Is Historical
Client input is not trusted server evidence.

### Original Source Location
`scripts/verify-memories.mjs` at baseline `9830a8efb1f66b6acd019296c4c699057f0de242`.

### Original Assertion Summary
The old test expected HTTP 201 after supplying trust fields.

### Replacement Current Contract
The endpoint rejects those fields with `CLIENT_SUPPLIED_TRUST_FIELD_FORBIDDEN`; a legal Run remains business `verified=false`.

### Security Reason
Trust fields are server-owned.

### Non-Restoration Rule
No test or documentation may restore client-claimed business trust promotion.

## S6-VL-A001

### Historical Contract Identity
Successful isolated verification was expected to set business `verified=true`.

### Why It Is Historical
Isolated evidence validation is not business trust authority.

### Original Source Location
`scripts/verify-verification-layer.mjs` at baseline `9830a8efb1f66b6acd019296c4c699057f0de242`.

### Original Assertion Summary
The old test asserted `afterVerify.verified === true`.

### Replacement Current Contract
`verification.ok=true` and `runEvidenceValidated=true` may coexist with `businessVerified=false` and `run.verified=false`.

### Security Reason
Evidence validation must not silently promote business trust.

### Non-Restoration Rule
No test or documentation may restore isolated-verification-driven business trust promotion.
