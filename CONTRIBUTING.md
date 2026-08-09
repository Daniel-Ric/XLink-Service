# Contributing

Thank you for contributing to XLink-Service.

This repository contains a Node.js/Express API for Microsoft authentication, Xbox Live, PlayFab, and Minecraft services. Contributions should preserve token security, protocol compatibility, and stable API behavior.

## Before You Start

- Read [README.md](README.md) for architecture, authentication flows, configuration, and API behavior.
- Read [SECURITY.md](SECURITY.md) before reporting vulnerabilities.
- Discuss large features, new authentication flows, or breaking API changes before implementing them.

## Development Setup

Requirements:

- Node.js 18 or newer
- npm

Install dependencies:

```bash
npm ci
```

Run the service locally:

```bash
node src/server.js
```

## Repository Structure

- `src/server.js`: service bootstrap
- `src/app.js`: Express application and route mounting
- `src/routes`: Microsoft, Xbox, PlayFab, Minecraft, and utility endpoints
- `src/services`: upstream authentication and API integrations
- `src/middleware`: authentication, validation, rate limiting, and error handling
- `src/config`: environment and runtime configuration
- `src/utils`: shared HTTP, token, cache, and logging helpers

## Contribution Guidelines

- Keep pull requests focused and avoid unrelated refactors.
- Preserve current API contracts unless a change is explicitly documented.
- Update Swagger/OpenAPI documentation when routes or schemas change.
- Add focused verification for authentication, token exchange, validation, and error paths when changing them.
- Treat Microsoft, Xbox, XSTS, PlayFab, and Minecraft tokens as secrets.
- Never commit client secrets, refresh tokens, access tokens, private environment values, or captured user data.

## Coding Expectations

- Match the existing ESM style and repository organization.
- Keep OAuth state, PKCE, callback, and token logic explicit and auditable.
- Validate inputs before forwarding them to upstream services.
- Use bounded timeouts and safe error messages for external requests.
- Do not log authorization headers or token payloads.
- Document new configuration variables in `README.md` and the environment example.

## Verification Expectations

At minimum:

- start the service locally and verify `/healthz` and `/readyz`
- verify relevant documented request flows
- add regression coverage in the change when practical

Changes to authentication flows should also be tested for expired, reused, malformed, and mismatched state or token inputs.

## Commit Messages

Follow the existing repository style and keep messages concise. For release-relevant changes, clear prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `ci:`, and `chore:` are encouraged.

## Pull Requests

Describe:

- the problem and solution
- affected authentication or API flows
- configuration, security, and compatibility impact
- tests performed
- intentional follow-up work

## Security Reporting

Do not disclose vulnerability details in public issues or pull requests. Follow [SECURITY.md](SECURITY.md).

## Conduct

By participating in this project, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
