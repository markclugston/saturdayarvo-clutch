# SEC-001 — PCI DSS and Application Security

**Applies when:** A change affects security controls, authentication, authorization, untrusted
input, dependencies, or PCI DSS scope.

**Owner:** Repository maintainers

## PCI DSS scope

The project is in PCI DSS 4.1 Level 1 scope. Changes affecting payment systems, cardholder data,
or PCI DSS controls MUST identify the affected scope and applicable controls, and MUST be reviewed
for their impact on the project's PCI DSS obligations. Contributors MUST identify where the
applicable control implementation and evidence are recorded; if no approved location is known,
they MUST flag that gap rather than presume compliance. This standard does not reproduce the PCI
DSS publication.

## Application security

- Changed code MUST receive an independent review focused on the OWASP Top 10 before the task is
  declared complete.
- Every vulnerability found MUST be addressed and verified. Unresolved security findings block
  completion.
- Sensitive personal data MUST NOT be embedded in client-side bundles.
- Dependencies MUST be checked for known vulnerabilities, and findings MUST be remediated in a
  timely manner.
- Web applications MUST use secure cookies, transport security, and browser security headers.
  Cookie-based state-changing requests MUST have appropriate CSRF protections.
