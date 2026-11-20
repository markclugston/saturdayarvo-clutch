---
name: "clutch-dotnet-service"
description: "Clutch .NET service rules (DOT-001, OPS-001, ENG-001 for .NET): project settings, async/cancellation/timeouts/retries, disposal, ProblemDetails and Result-pattern errors, structured logging, health checks, OpenTelemetry, and .NET testing with xUnit, NSubstitute and WebApplicationFactory. Use when planning, writing, testing or reviewing C# services or projects."
metadata:
  author: "saturdayarvo-clutch"
  governs: "DOT-001, OPS-001, ENG-001 (.NET)"
---

# Clutch .NET Services

For database work also load `clutch-data-access`. For endpoints, auth, input handling or logging
of user data also load `clutch-security-review`.

## Project settings

- Target .NET 10 or newer. Use the stable C# version selected by the SDK.
- Enable nullable reference types and implicit usings.
- Treat warnings as errors.
- Enable build-time code style enforcement.
- Modern C# features may be used when they improve clarity.

## Code rules

- Use async APIs for I/O. Async methods use the `Async` suffix unless the framework constrains the name.
- Dispose resources deterministically. Await async disposal.
- Support cancellation (`CancellationToken` flows through I/O paths).
- Apply appropriate I/O timeouts.
- Retries must be bounded and safe (idempotent operations only, with backoff).
- Avoid exceptions for expected control flow. Use the Result pattern or typed validation failures where applicable.
- ASP.NET Core applications return RFC 9457 ProblemDetails responses. Error responses must not disclose sensitive information.
- Domain logic stays independent of HTTP, persistence and providers (ARC-001).

## Operations (OPS-001)

- Structured logging with message templates. Never log credentials, tokens or sensitive data; redact or omit.
- Appropriate health checks (liveness, plus readiness for dependencies the service needs).
- OpenTelemetry metrics for the new or changed behaviour.

## Testing (ENG-001)

- Behaviour changes require automated tests.
- Use xUnit.
- Use NSubstitute to isolate boundaries (external services, clocks, providers) where suitable. Do not substitute domain behaviour.
- Use `WebApplicationFactory` for HTTP-level tests when appropriate.
- Critical database behaviour uses provider-backed integration tests (see `clutch-data-access`).

## Test cadence

Run from the repository root against the solution and test project (`docs/code-map.md`).
Integration tests that use the Docker SQL Server fixture are slow, so keep them out of per-task
runs. They are marked with a `Trait`; read it from the integration tests rather than assuming it.

| When | Run |
|---|---|
| After each task | Affected tests only, excluding the Docker trait: `dotnet test <test project> -v q --filter "<Trait>!=<value>&FullyQualifiedName~<Class>"` |
| After a task that changes persistence | Only the affected Docker-backed tests: `--filter "<Trait>=<value>&FullyQualifiedName~<Class>"` |
| End of each phase | Build, then every test except the Docker trait, once |
| Completion | All quality gates below, once |

- Don't rerun a gate unless code it covers changed since it last passed.
- The full Docker-backed suite and the dependency scan run at completion, not per task.

## Quality gates (completion)

Use quiet output and report failures only:

1. `dotnet build <solution> -v q -clp:ErrorsOnly`
2. `dotnet test <test project> --no-build -v q --logger "console;verbosity=minimal"` (all tests)
3. `dotnet list <solution> package --vulnerable --include-transitive`

Never paste passing test lists or full logs into the chat. After a fix, rerun only the gates whose
covered code changed, then report every result. Never report a gate as passed when it failed or
could not run.
