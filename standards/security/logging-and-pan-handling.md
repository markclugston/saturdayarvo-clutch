# SEC-003 — Logging and PAN Handling

**Applies when:** A change touches logging, error handling, payment data, or sensitive data in
diagnostics.

**Owner:** Repository maintainers

## Logging and payment data

- Credentials, tokens, sensitive personal data, and payment account data MUST NOT be written to
  logs or diagnostic output.
- Logging MUST use approved redaction or omission for sensitive fields; structured logging MUST
  not make sensitive values available through message templates or properties.
- Payment data MUST be handled only within approved system boundaries and in accordance with
  SEC-001 and the applicable PCI DSS controls.

## Error handling

- Exceptions MUST NOT be used for expected control flow.
- Predictable validation failures MUST use typed errors or an established Result pattern.
- ASP.NET Core applications MUST use standard exception-handling middleware or `IExceptionHandler`
  to return appropriate `ProblemDetails` responses consistent with RFC 9457.
- Error responses and diagnostics MUST NOT disclose secrets, tokens, sensitive personal data, or
  payment account data.
