# PCI Control Evidence

This repository path, `compliance/pci/`, is the location for non-sensitive PCI scope decisions
and control-review evidence, as directed for this project. Keep evidence limited to information
approved for source control. Never commit cardholder data, credentials, secrets, or unredacted
security artifacts here.

Feature-specific scope reviews belong in a file named
`<feature-branch>-scope.md`. Each review must record the assessed data flows, PCI scope impact,
applicable controls, review date and owner, and links to any separately stored restricted
evidence. Follow [SEC-001](../../standards/security/pci-dss-controls.md) and
[SEC-003](../../standards/security/logging-and-pan-handling.md).

The current transaction-import feature assessment is tracked in
[001-import-bank-transactions-scope.md](./001-import-bank-transactions-scope.md).
