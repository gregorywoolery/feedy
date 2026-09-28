# Security

Feedy currently has no authentication or per-user authorization. It is designed for a trusted local workspace. Anyone who can reach the application can read and modify its feedback. Keep the default loopback Docker bindings. Add authentication and authorization before offering shared or public hosting.

Report a suspected vulnerability privately through the repository's Security tab when private vulnerability reporting is available. Otherwise, contact the maintainer privately before disclosing details. Do not include credentials, real feedback, or customer photos in public issues.

Include affected versions, prerequisites, a minimal reproduction using synthetic data, expected behavior and observed behavior. The current default branch is the supported development version.

Security-relevant boundaries include request size/origin validation, image decoding, storage-key containment, database TLS verification, safe deployment defaults, and bounded PDF export work. The documented absence of authentication is a product limitation, not a claim that network exposure is safe.
