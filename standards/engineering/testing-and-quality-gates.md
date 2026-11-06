# ENG-001 — Testing and Quality Gates

**Applies when:** A change adds or modifies behavior, tests, or delivery quality gates.

**Owner:** Repository maintainers

## Test requirements

- Every behavior-bearing project MUST have appropriate automated tests.
- Tests MUST cover behavior added or changed by a task.
- Each .NET project with meaningful behavior MUST have an appropriate test project.
- .NET test projects MUST use xUnit and NSubstitute.
- Tests MUST use substitutes for boundary dependencies where isolation is useful and MUST NOT
  substitute domain entities or internal state logic.
- API integration tests SHOULD use `WebApplicationFactory` when appropriate.
- A task MUST NOT be declared complete until its relevant tests and checks pass.

## Completion and review

- Review findings MUST be addressed, and relevant tests and checks MUST be rerun before completion.
- Reviewers MUST report material unresolved risks. A task MUST NOT pass its quality gates while a
  blocking issue remains unresolved.
