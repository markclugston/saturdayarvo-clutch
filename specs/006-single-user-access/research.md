# Research: Single-Person Data Access

## Decision 1: Replace the family container with direct account ownership

**Decision**: Store each account's owning individual directly on the account and use that identity for authorization.

**Rationale**: The current `Family` entity has exactly one owner, a unique owner constraint, and no membership or invitation behavior. Account, transaction, import, and import-settings access already uses that owner relationship. Direct ownership removes the misleading grouping layer while preserving the existing one-individual boundary.

**Alternatives considered**:

- Keep the family container but rename its UI and API: rejected because the extra entity has no multi-person behavior and leaves unnecessary ownership indirection.
- Add family membership or sharing controls: rejected because the feature explicitly rules out shared access.
- Limit an individual to one financial account: rejected because the specification requires multiple accounts per individual.

## Decision 2: Preserve existing account ownership and isolate unresolved records

**Decision**: Backfill account owners from their current family owner only when that owner identifier resolves to an Identity user during the schema migration. Retain accounts whose Family owner identifier does not resolve with no owner assigned, and authorize user operations only when the account owner matches the signed-in identity. Resolution is an authorized out-of-band data repair, not a user-facing workflow in this feature; after repair assigns a valid owner, ordinary owner checks allow that individual access and continue denying other users. A downgrade recreates family records for resolved owners and must refuse to proceed if unresolved ownerless accounts would otherwise be lost.

**Rationale**: The current database model requires each family to reference an Identity user, but a legacy database may contain inconsistent rows from a historical constraint violation or out-of-band data operation. The migration test will create this state in SQL Server by disabling the Family-to-Identity foreign key while inserting a Family owner identifier that has no matching user, while keeping the account-to-Family relationship valid. The backfill must match both the Family and an existing Identity user; otherwise it leaves `OwnerUserId` null. An unassigned account must not become visible to any ordinary user. Account-linked transactions and import data remain linked by account ID. Refusing an unsafe downgrade preserves unassigned data rather than fabricating an owner or deleting the account.

**Alternatives considered**:

- Delete accounts with unresolved owners: rejected because removing shared access must not delete user data.
- Assign unresolved accounts to an arbitrary or default user: rejected because it could disclose sensitive financial information.
- Keep account ownership through the family table: rejected because it retains the family abstraction the feature removes.

## Decision 3: Keep the existing stack and test boundaries

**Decision**: Use the repository's existing .NET 10, EF Core/SQL Server, Identity, TypeScript/React, xUnit/Testcontainers, Vitest, and Playwright patterns.

**Rationale**: The feature changes an existing data relationship and user flow; no new platform or dependency is required. Existing integration tests provision SQL Server and exercise authenticated user isolation.

**Alternatives considered**:

- Introduce a new persistence mechanism, authorization framework, or frontend library: rejected as unnecessary and inconsistent with repository constraints.
