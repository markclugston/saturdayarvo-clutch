---
applyTo: "tests/**,src/clutch-web/src/**/*.test.ts,src/clutch-web/src/**/*.test.tsx,src/clutch-web/e2e/**"
---
# ENG-001 Testing

Use `clutch-dotnet-service` (xUnit, NSubstitute, WebApplicationFactory) or `clutch-frontend` (component and browser tests) for test tooling. Follow the test cadence there: run only affected tests per task, and full suites at phase end and completion. Never claim a check passed when it failed or could not run.
