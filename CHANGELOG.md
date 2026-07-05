# Changelog

## 3.0.0 (2026-07-05)

### Summary

- Change type: Test coverage
- Main change: xLink - Implement XSAPI services with authentication and request handling (af5319f)
- Impact: Test coverage with a large change footprint across HTTP API routes, Xbox, Minecraft, and PlayFab integrations, repository files.
- Bump reason: large change footprint (7 files, 1001 total line changes)

### Changed Areas

- Shared utilities: 1 file: src/utils/xsapiContext.js
- Tests: 1 file: tests/xsapi.test.js
- Xbox and Minecraft API routes: 1 file: src/routes/xsapi.routes.js
- Xbox, Microsoft, and PlayFab service integrations: 4 files: src/services/xsapiAuth.service.js, src/services/xsapiCrypto.service.js, plus 2 more

### Release Metrics

- Version bump: major
- Files changed: 7
- Line changes: +1001 / -0
## 2.0.0 (2026-06-23)

### Summary

- Change type: Repository update
- Main change: xLink - Add gitignore (d05be9d)
- Impact: Repository update with a large change footprint across repository files.
- Bump reason: large change footprint (1 files, 4491 total line changes)

### Changed Areas

- Repository files: 1 file: .gitignore

### Release Metrics

- Version bump: major
- Files changed: 1
- Line changes: +4491 / -0
## 1.0.7 (2026-06-01)

### Summary

- Change type: Repository update
- Main change: xLink - Add proxy support to HTTP client configuration (61effce)
- Impact: Repository update with a small change footprint across repository files.
- Bump reason: patch-level repository update

### Changed Areas

- Shared utilities: 1 file: src/utils/http.js

### Release Metrics

- Version bump: patch
- Files changed: 1
- Line changes: +1 / -0

## 1.0.8 (2026-06-01)

### Summary

- Change type: Repository update
- Main change: Merge remote-tracking branch 'origin/master' (12e63da)
- Impact: Repository update with a small change footprint across repository files.
- Bump reason: patch-level repository update

### Changed Areas

- Changelog: 1 file: CHANGELOG.md

### Release Metrics

- Version bump: patch
- Files changed: 1
- Line changes: +38 / -0
## 1.0.4 (2026-06-01)

### Summary

- Change type: Repository update
- Main change: xLink - Refactor redeem service: centralize body validation and streamline flow initialization (8ddf53c)
- Impact: Repository update with a small change footprint across HTTP API routes.
- Bump reason: patch-level repository update

### Changed Areas

- Xbox and Minecraft API routes: 1 file: src/routes/redeem.routes.js

### Release Metrics

- Version bump: patch
- Files changed: 1
- Line changes: +36 / -16

## 1.0.5 (2026-06-01)

### Summary

- Change type: Repository update
- Main change: Merge remote-tracking branch 'origin/master' (b7494d7)
- Impact: Repository update with a small change footprint across repository files.
- Bump reason: patch-level repository update

### Changed Areas

- Changelog: 1 file: CHANGELOG.md

### Release Metrics

- Version bump: patch
- Files changed: 1
- Line changes: +19 / -0
## 1.0.2 (2026-06-01)

### Summary

- Change type: Repository update
- Main change: xLink - Enhance redeem service with input normalization (e9b657f)
- Impact: Repository update with a small change footprint across Xbox, Minecraft, and PlayFab integrations.
- Bump reason: patch-level repository update

### Changed Areas

- Xbox, Microsoft, and PlayFab service integrations: 1 file: src/services/redeem.service.js

### Release Metrics

- Version bump: patch
- Files changed: 1
- Line changes: +76 / -28
## 1.0.1 (2026-05-25)

### Summary

- Change type: CI and automation
- Main change: xLink - Add validation for Discord webhook and improve error handling (f17385c)
- Impact: CI and automation with a small change footprint across CI and release automation.
- Bump reason: patch-level repository update

### Changed Areas

- GitHub workflows: 1 file: .github/workflows/discord-notifications.yml

### Release Metrics

- Version bump: patch
- Files changed: 1
- Line changes: +9 / -1





