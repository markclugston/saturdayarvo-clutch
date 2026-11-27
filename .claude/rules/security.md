---
paths:
  - "**/*.cs"
  - "src/clutch-web/src/**"
  - "**/appsettings*.json"
  - "**/*.config"
---
# SEC-001 / SEC-002 / SEC-003 / SEC-004 Security

Never commit secrets. Never log credentials, tokens or sensitive data. Validate untrusted input on the server, and data entered in the UI there too. Load the `clutch-security-review` skill for endpoint, auth, input, secrets or sensitive-data changes, and for the independent review.
