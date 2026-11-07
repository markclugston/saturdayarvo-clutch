# PCI Scope Review: Import Bank Transactions

**Status**: Preliminary design assessment; implementation and deployment verification pending  
**Feature**: `001-import-bank-transactions`  
**Evidence location**: `compliance/pci/`  
**Review owner**: Project owner - Mark Clugston  
**Review date**: 2026-11-07

## Assessment inputs and boundaries

- The project is subject to the PCI scope stated in
  [SEC-001](../../standards/security/pci-dss-controls.md). This review assesses the feature's
  potential impact within that existing context; it does not change the project's classification.
- The owner plans to host production in Azure behind Cloudflare. Specific services, regions,
  configuration, logging, caching, and network boundaries are not yet established by this review.
- Users must sign up to access their data. This feature supports one owner-only Family per user;
  its owner has access to every account in that Family. Invitations and per-account member grants
  are out of scope and require a future review when designed.
- There is currently no intention to connect to, share infrastructure with, or administer another
  card-payment processing system. This is an intention, not a verified deployment inventory.
- The owner states that cardholder data has no intended use in the system and that validation is
  intended to block it. The concern is that users control the submitted content and could ignore
  guidance or enter data in a form that avoids warnings and pattern detection; it is not an
  assertion that bank exports normally contain cardholder data. An untrusted upload could still
  contain such data in any column, and validation of mapped descriptions does **not** prevent it
  from reaching the browser, edge, network, or API upload path. Pattern detection cannot guarantee
  that every identifier is recognized.

## Planned data flow and potential exposure

| Stage | Planned behavior | Potential exposure or evidence needed |
|---|---|---|
| Browser | User selects a local CSV and maps columns; the design calls for header-only browser inspection. | The original local file may contain cardholder data in any column, including headers. Verify browser handling and ensure sensitive headers are not displayed, persisted, or logged. |
| Cloudflare and network | Request passes through Cloudflare to the Azure-hosted API. | Confirm TLS on both legs, request-body inspection, buffering, caching, error reporting, retention, access, and applicable Cloudflare responsibility and scope evidence. |
| Azure ingress and API | API receives and parses the upload, selects mapped fields, and validates before review or persistence. | Raw request content can arrive before validation, including unmapped fields. Verify ingress/request-body logging, buffering, temporary files, process diagnostics, exception handling, and cleanup. |
| Review and database | Only validated mapped values are intended to be staged temporarily; confirmed transactions are persisted. | Verify rejection, authorization, expiry and cleanup, SQL/database logging, and handling of identifiers that patterns may miss. |
| Operations and backups | Azure and supporting services operate and back up the application. | Inventory database backups, traces, logs, crash dumps, support tools, retention, access, and secure deletion; identify any copies containing raw or staged content. |

The upload itself is untrusted and may contain cardholder data before validation. Rejection at the
import boundary does not by itself establish that the earlier processing path is out of PCI scope.
The feature is not intended to retain cardholder data, but the specified pattern-based validation
cannot prove that none will be persisted.

## Preliminary scope conclusion

**Decision**: The upload path and systems that can receive, process, transmit, store, secure, or
access the uploaded data require a PCI scope impact assessment. Treat the browser-to-Cloudflare
path, Cloudflare configuration, Azure ingress/API, temporary processing, persistence, and
associated operational systems as **potentially affected** until the deployed data flows and
controls are verified. This is a conservative planning assessment, not a final component-level
scope determination or an assertion of compliance.

The final boundary, applicable PCI DSS requirements, Cloudflare/Azure shared responsibilities,
and any required assessor involvement remain undetermined. The project owner must confirm these
against the actual deployment and applicable PCI obligations; consult a PCI assessor when needed.
Record the final rationale and any affected components below before implementation acceptance.

## Planned controls and verification evidence

These are design requirements, not verified controls. Map them to applicable PCI DSS requirements
as part of the final assessment; this document does not substitute for the PCI DSS publication.
Record links to implementation and test evidence once available. Restricted evidence must remain
in approved access-controlled storage; do not copy it, cardholder data, or secrets here.

| Control area | Planned control | Verification evidence / status |
|---|---|---|
| Data minimization | Reject specified identifier patterns, do not retain uploaded source files or unmapped fields, and expire temporary reviews. | Server parser and validation are implemented; the full SQL Server integration suite passes (37 tests), including malformed uploads, review expiry, stale-review replacement, and lease release. Request buffering, temporary storage, and backup handling remain unverified in the deployment. |
| Transmission and infrastructure | Protect data in transit and verify Cloudflare-to-Azure configuration. | Pending deployment inventory, TLS configuration, and provider responsibility evidence. |
| Authentication and authorization | Require authentication and enforce Family-owner authorization server-side; protect administrator settings. | Server-side owner and administrator authorization are implemented and covered by the passing SQL Server integration suite. Deployment configuration remains unverified. |
| Diagnostics and audit | Omit sensitive data, descriptions, transaction values, and raw uploads from import audit events and diagnostics. | Pending log, trace, error, and crash-dump configuration review and tests. |
| Storage and recovery | Secure persisted and temporary data, including copies, and define cleanup/retention. | Pending database, backup, access, retention, and recovery evidence. |
| Independent security review | Review changed code for the OWASP Top 10 and check dependencies for known vulnerabilities. | Independent feature review found no security findings. `npm audit --audit-level=low` and `dotnet list ... package --vulnerable --include-transitive` reported zero vulnerable packages. Deployment-specific controls remain unverified. |

## Open actions before implementation acceptance

1. Verify that owner-only Family and account access are enforced at every relevant boundary.
2. Inventory the actual Azure and Cloudflare services and data flows, including raw request
   buffering, logs, backups, diagnostics, support access, and retention.
3. Determine component-level PCI scope, applicable controls, provider responsibilities, and
   whether assessor review is required. Record the decision, rationale, and reviewer approval.
4. Implement and verify the planned controls, including tests using synthetic data, and attach
   safe links to the resulting evidence. Investigate any location where unrecognized cardholder
   data could be retained.
5. Independent source and dependency reviews found no findings. Complete deployment-specific
   control verification and update this record with the final scope decision and sign-off.

## Review history

| Date | Reviewer | Decision or change |
|---|---|---|
| 2026-11-07 | Project owner - Mark Clugston | Supplied intended deployment and access model; clarified that cardholder data has no intended use but user-controlled input could evade warnings or validation. Preliminary assessment documented; final scope and control verification remain pending. |
| 2026-11-07 | Independent security review | Reviewed feature code and dependency manifests; no security findings, and both npm and .NET vulnerability checks reported zero vulnerable packages. This does not verify the deployed infrastructure or determine final PCI scope. |
| 2026-11-07 | Implementation verification | SQL Server integration suite passed (37 tests); `npm audit --audit-level=low` and the .NET transitive vulnerability check reported no vulnerable packages. Deployment-specific controls and final scope remain pending. |
