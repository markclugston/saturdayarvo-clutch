# SEC-002 — Secrets and Keys

**Applies when:** A change handles secrets, credentials, keys, certificates, or cryptographic
material.

**Owner:** Repository maintainers

## Requirements

- Secrets MUST NOT be committed to source control.
- Secrets MUST use approved secure storage and MUST be rotated according to applicable operational
  policy.
- Credentials, tokens, and cryptographic secrets MUST NOT be embedded in client-side bundles.
- Authentication secrets MUST NOT be stored in browser local or session storage.
- Secret material MUST NOT be written to logs; logging and payment-data handling MUST also comply
  with SEC-003.
