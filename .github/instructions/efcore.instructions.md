---
applyTo: "src/Clutch.API/Infrastructure/Persistence/**,src/Clutch.API/Domain/Audit/**,tests/Clutch.API.Tests/Integration/Persistence/**"
---
# DOT-002 / AUD-001 Data access

Load the `clutch-data-access` skill before writing or reviewing this code. Audit rows are append-only: never update or delete them. Every database change needs the independent query review, and every migration needs the migration review.
