# SEC-001 SEC-002 SEC-003 Instructions

- Conduct OWASP Top 10 review for changed code.
- Review authentication and authorization.
- Validate all untrusted input.
- Client-side validation never replaces server-side validation.
- Secure cookies required.
- Transport security required.
- Browser security headers required.
- CSRF protections required for cookie-based state changes.
- No secrets in source control.
- Use approved secret stores.
- Rotate secrets per operational policy.
- No credentials, tokens or sensitive data in logs.
- Use redaction or omission.
- Exception handling must not disclose sensitive data.
- Avoid exceptions for expected control flow.
- Use Result pattern or typed validation failures where applicable.
- Use RFC 9457 ProblemDetails responses for ASP.NET Core applications.
- Authentication secrets must not be stored in localStorage or sessionStorage.
