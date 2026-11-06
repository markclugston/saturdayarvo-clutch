# DOT-001 — .NET Service Practices

**Applies when:** A change targets or modifies a .NET project, service, or runtime behavior.

**Owner:** Clutch.API maintainers

## Platform and project configuration

- .NET projects MUST target .NET 10 or newer.
- The C# language version MUST be the stable version selected by the target SDK. Preview language
  features require explicit approval.
- Projects claiming support for a newer target framework MUST build and pass tests for that target.
- Every `.csproj` MUST explicitly enable nullable reference types, implicit usings, code-style
  enforcement during build, and warnings as errors.

## Service implementation

- I/O-bound operations MUST use asynchronous APIs. Asynchronous methods MUST use the `Async` suffix
  unless a framework or interface contract fixes the method name.
- Resources MUST be disposed deterministically; asynchronous disposal MUST be awaited when the
  resource supports it.
- Services MUST support cancellation and timeouts for I/O.
- Retries MUST be bounded and used only when retrying is safe.
- Allocation-focused techniques such as `ReadOnlySpan<T>` and `Memory<T>` SHOULD be used when
  measurement or a clear high-throughput requirement justifies their complexity.
