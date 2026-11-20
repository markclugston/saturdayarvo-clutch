---
name: "clutch-security-review"
description: "Clutch security rules and independent OWASP review (SEC-001..003). Use for auth, input, secrets or sensitive-data changes, and every completion review."
metadata:
  author: "saturdayarvo-clutch"
  governs: "SEC-001, SEC-002, SEC-003"
---

# Clutch Security

Security findings block completion until they are remediated and verified.

## Rules

**Boundaries and access (SEC-001)**
- Enforce security at system boundaries.
- Authorization is required for protected operations. Review authentication and authorization on every changed endpoint.
- Validate all untrusted input. Client-side validation never replaces server-side validation.
- Secure cookies, transport security (HTTPS/HSTS) and browser security headers are required.
- CSRF protection is required for cookie-based state changes.
- Authentication secrets must not be stored in `localStorage` or `sessionStorage`.

**Secrets (SEC-002)**
- No secrets in source control. Use the approved secret store.
- Rotate secrets per operational policy.

**Sensitive data (SEC-003)**
- No credentials, tokens or sensitive data in logs. Use redaction or omission.
- Exception handling and error responses must not disclose sensitive data. ASP.NET Core applications use RFC 9457 ProblemDetails.
- Avoid exceptions for expected control flow. Use the Result pattern or typed validation failures where applicable.
- Payment and financial information requires approved handling controls.

## Independent review procedure

Run as a separate pass over the full diff after implementation, not while writing the code.
Record a finding (severity, location, remediation) for each failure.

1. **OWASP Top 10** for changed code: broken access control, cryptographic failures, injection,
   insecure design, security misconfiguration, vulnerable components, authentication failures,
   integrity failures, logging and monitoring failures, SSRF.
2. **Authentication and authorization** on every new or changed endpoint and operation.
3. **Input validation** on every new trust boundary, server-side.
4. **Secrets**: none added to source, configuration or tests.
5. **Sensitive data**: logs, exceptions and error responses checked for leakage. Payment data handling controls confirmed.
6. **Dependencies**: vulnerability scan for .NET and npm packages added or updated.
7. **Third-party UI code** (registries other than shadcn/ui, copied components): reviewed for script injection, unsafe HTML, network calls and licensing before acceptance.

After remediation, rerun the affected checks and verify each finding is closed. Report any check
that failed or could not run.
