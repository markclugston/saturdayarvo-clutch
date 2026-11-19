# ENG-001 Testing Instructions

- Behaviour changes require test coverage.
- Use xUnit for .NET tests.
- Use NSubstitute for suitable boundary isolation.
- Do not substitute domain behaviour.
- WebApplicationFactory should be used when appropriate.
- Browser, accessibility, integration and automated validation may replace manual verification.
- Critical user journeys require executable testing.
- Quality gates must be rerun after fixes.
- Do not claim checks passed when they failed or could not run.
- Participant usability studies are not acceptance criteria.
