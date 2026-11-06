# ARC-001 — Architecture Boundaries

**Applies when:** A change alters project boundaries, dependency registration, or application
architecture, or uses modern C# language features.

**Owner:** Repository maintainers

## Requirements

- Dependencies MUST be registered through .NET dependency injection, with lifetimes appropriate
  to their use.
- Modern language features, including primary constructors, pattern matching, collection
  expressions, and immutable record types, SHOULD be used when they improve clarity, correctness,
  or maintainability. They MUST NOT be applied mechanically.
