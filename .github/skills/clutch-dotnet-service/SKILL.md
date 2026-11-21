---
name: "clutch-dotnet-service"
description: "Clutch .NET service rules, operations, tests and quality gates (DOT-001, OPS-001, ENG-001). Use when planning, writing, testing or reviewing C# code."
metadata:
  author: "saturdayarvo-clutch"
  governs: "DOT-001, OPS-001, ENG-001 (.NET)"
---

# Clutch .NET Services

For database work also load `clutch-data-access`. For endpoints, auth, input handling or logging
of user data also load `clutch-security-review`.

## Source of truth

The code defines the service conventions. Read it rather than restating it here; locations are in
`docs/code-map.md`.

| Concern | Authoritative implementation |
|---|---|
| Target framework, nullable, implicit usings, warnings as errors, code-style enforcement | `src/Clutch.API/Clutch.API.csproj`, `tests/Clutch.API.Tests/Clutch.API.Tests.csproj` |
| Service registration, middleware, health checks, OpenTelemetry meters | `src/Clutch.API/Program.cs` |
| Error responses (RFC 9457 ProblemDetails) | `src/Clutch.API/Api/ProblemDetails/` |
| Endpoint, use-case, domain and metrics patterns | sibling files in `Api/Endpoints/`, `Application/<Area>/`, `Domain/<Area>/` |
| Test frameworks and patterns (unit, HTTP-level, Docker SQL Server) | the test `.csproj` and a sibling test in `tests/Clutch.API.Tests/` |

Follow the nearest sibling's pattern. Do not change project settings without an approved plan. If
the code and this skill disagree, raise it; do not pick a side.

## Rules no tool enforces (review)

There is no `.editorconfig` with project naming or analyzer rules, so review these:

- Use async APIs for I/O. Async methods use the `Async` suffix unless the framework constrains the name.
- Dispose resources deterministically. Await async disposal.
- `CancellationToken` flows through I/O paths. Apply appropriate I/O timeouts.
- Retries are bounded and safe (idempotent operations only, with backoff).
- Avoid exceptions for expected control flow. Use the Result pattern or typed validation failures as the existing use cases do.
- Error responses use the established ProblemDetails handling and never disclose sensitive information.
- Domain logic stays independent of HTTP, persistence and providers (ARC-001).

## Operations (OPS-001)

- Structured logging with message templates. Never log credentials, tokens or sensitive data; redact or omit.
- New or changed behaviour registers health checks and OpenTelemetry metrics the way existing areas do.

## Testing (ENG-001)

- Behaviour changes require automated tests, following the existing test patterns.
- Substitute only boundaries (external services, clocks, providers), never domain behaviour.
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
