# XLink Service (Xbox + Minecraft REST API)

[![License](https://img.shields.io/github/license/Daniel-Ric/XLink-Service)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/Daniel-Ric/XLink-Service?style=social)](https://github.com/Daniel-Ric/XLink-Service)
[![GitHub Issues](https://img.shields.io/github/issues/Daniel-Ric/XLink-Service)](https://github.com/Daniel-Ric/XLink-Service/issues)

> A standalone Node.js/Express service for Microsoft/Xbox Live auth, Xbox Profile/Presence/Captures/Stats, PlayFab client read APIs, and Minecraft (multiplayer token + entitlements) — protected by JWT and shipped with Swagger/OpenAPI docs.

---

## 📚 Table of Contents

* [✨ Highlights](#-highlights)
* [🚀 Quick Start](#-quick-start)
* [🔧 Configuration](#-configuration)
* [📂 Project Structure](#-project-structure)
* [💻 Usage Examples](#-usage-examples)
* [📖 API Reference](#-api-reference)
* [⛔ Rate Limiting](#-rate-limiting)
* [📊 Logging & Docs](#-logging--docs)
* [🛡 Middleware Stack](#-middleware-stack)
* [🐳 Docker Support](#-docker-support)
* [🧪 Scripts](#-scripts)
* [🤝 Contributing](#-contributing)
* [❓ FAQ](#-faq)
* [📄 License](#-license)

---

## ✨ Highlights

* **Microsoft/Xbox Auth Flow**: Device Code → Tokens (XBL, XSTS for multiple relying parties) → PlayFab login → Minecraft multiplayer token.
* **Comprehensive Xbox Endpoints**: Profile, Titles (TitleHub), Presence (including batch), People, Captures (clips/screenshots), Stats, Achievements.
* **PlayFab Client Read**: Account, PlayerProfile, Catalog, TitleData, UserData/ReadOnlyData via SessionTicket/EntityToken.
* **Minecraft Services**: Generate MCToken from PlayFab SessionTicket and fetch entitlements/inventory (optional receipts).
* **JWT-Secured**: First-party JWTs guard the API; includes a refresh endpoint.
* **OpenAPI/Swagger**: Live docs at `/api-docs` and `GET /openapi.json`.
* **Solid Express Base**: Helmet, CORS, compression, Joi validation, centralized error handling.
* **Targeted Rate Limiting**: Auth endpoints protected out of the box.
* **Fast & Clean Logs**: Colorized request logs with badges and request IDs; Swagger/health noise muted.

---

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone https://github.com/Daniel-Ric/XLink-Service.git
   cd XLink-Service
   npm install
   ```

2. **Configure**
   Create a `.env` file with the variables below (see [🔧 Configuration](#-configuration)).

3. **Run**
   ```bash
   node src/server.js
   # Or: NODE_ENV=production PORT=3000 node src/server.js
   # Dev hot reload (if you use nodemon):
   npx nodemon src/server.js
   ```

4. **Explore**
    * Swagger UI: `http://localhost:3000/api-docs`
    * OpenAPI JSON: `http://localhost:3000/openapi.json`
    * Health: `GET /healthz`, `GET /readyz`

---

## 🔧 Configuration

Validated via Joi (`src/config/env.js`).

| Key                | Default       | Description                                                              |
|--------------------|---------------|--------------------------------------------------------------------------|
| `PORT`             | `3000`        | Service port                                                             |
| `NODE_ENV`         | `development` | `development` \| `production` \| `test`                                |
| `CORS_ORIGIN`      | `*`           | CORS origin(s), comma-separated (e.g., `http://localhost:5173`)          |
| `JWT_SECRET`       | — **required**| At least 16 chars, used to sign API JWTs                                 |
| `CLIENT_ID`        | — **required**| Microsoft App Client ID (Device Code flow)                               |
| `HTTP_TIMEOUT_MS`  | `15000`       | Timeout for outgoing HTTP calls (ms)                                     |
| `LOG_LEVEL`        | `info`        | General log level                                                        |
| `MC_GAME_VERSION`  | `1.21.62`     | Minecraft game version for token generation                              |
| `MC_PLATFORM`      | `Windows10`   | Platform identifier for Minecraft                                        |
| `PLAYFAB_TITLE_ID` | `20ca2`       | PlayFab Title ID                                                         |
| `ACCEPT_LANGUAGE`  | `en-US`       | Default `Accept-Language` for TitleHub                                   |

> **CORS**: In production, set `CORS_ORIGIN` to explicit origins (no `*`).

---

## 📂 Project Structure

```
XLink-Service/
├── src/
│   ├── app.js                 # Express app, Swagger setup, route mounting, colorful request logger
│   ├── server.js              # Bootstrap (port, startup logs, graceful shutdown)
│   ├── config/
│   │   └── env.js             # .env validation + export (Joi)
│   ├── middleware/
│   │   ├── error.js           # 404 + centralized error handler
│   │   └── rateLimit.js       # Auth-specific rate limiter
│   ├── routes/                # Feature routes (Swagger via JSDoc)
│   │   ├── auth.routes.js
│   │   ├── profile.routes.js
│   │   ├── titles.routes.js
│   │   ├── presence.routes.js
│   │   ├── people.routes.js
│   │   ├── captures.routes.js
│   │   ├── achievements.routes.js
│   │   ├── stats.routes.js
│   │   ├── inventory.routes.js
│   │   ├── playfab.routes.js
│   │   ├── minecraft.routes.js
│   │   ├── lookup.routes.js
│   │   ├── health.routes.js
│   │   └── debug.routes.js    # only mounted in non-production
│   ├── services/              # Integrations (Microsoft, Xbox, PlayFab, Minecraft)
│   │   ├── microsoft.service.js
│   │   ├── xbox.service.js    # LRU cache for hot endpoints
│   │   ├── playfab.service.js
│   │   └── minecraft.service.js
│   ├── utils/
│   │   ├── async.js           # asyncHandler
│   │   ├── http.js            # Axios instance with keep-alive agents
│   │   ├── cache.js           # LRU cache helper
│   │   ├── httpError.js       # HttpError + helpers
│   │   ├── jwt.js             # sign/verify + middleware
│   │   ├── logger.js          # tiny console logger (optional)
│   │   └── swagger.js         # OpenAPI definition (3.0.3)
│   └── ...
└── (LICENSE, README.md, package.json, etc.)
```

---

## 💻 Usage Examples

> Most endpoints require **`Authorization: Bearer <JWT>`** (from `/auth/callback`). Many Xbox calls also require **`x-xbl-token: XBL3.0 x={uhs};{xstsToken}`**. Minecraft inventory endpoints use **`x-mc-token`**.

### 1) Request device code → `/auth/device`
```bash
curl -X GET http://localhost:3000/auth/device
```

### 2) Redeem device code → receive tokens/JWT → `/auth/callback`
```bash
curl -X POST http://localhost:3000/auth/callback   -H "Content-Type: application/json"   -d '{"device_code":"<DEVICE_CODE_FROM_STEP_1>"}'
```

### 3) Who am I? → `/auth/whoami`
```bash
curl -H "Authorization: Bearer <JWT>" http://localhost:3000/auth/whoami
```

### 4) Xbox profile (settings) → `/profile/me`
```bash
curl "http://localhost:3000/profile/me?settings=GameDisplayPicRaw,Gamerscore,Gamertag"   -H "Authorization: Bearer <JWT>"   -H "x-xbl-token: XBL3.0 x=<uhs>;<xstsToken>"
```

### 5) Recently played titles → `/titles/recent`
```bash
curl "http://localhost:3000/titles/recent?limit=20"   -H "Authorization: Bearer <JWT>"   -H "x-xbl-token: XBL3.0 x=<uhs>;<xstsToken>"   -H "Accept-Language: en-US,en;q=0.9"
```

### 6) Presence batch → `/presence/batch`
```bash
curl -X POST http://localhost:3000/presence/batch   -H "Authorization: Bearer <JWT)"   -H "x-xbl-token: XBL3.0 x=<uhs>;<xstsToken>"   -H "Content-Type: application/json"   -d '{"xuids":["2533274...","2814650..."]}'
```

### 7) Minecraft entitlements → `/inventory/minecraft`
```bash
curl "http://localhost:3000/inventory/minecraft?includeReceipt=false"   -H "Authorization: Bearer <JWT>"   -H "x-mc-token: MCToken eyJ..."
```

### 8) PlayFab inventory → `/inventory/playfab`
```bash
curl -X POST http://localhost:3000/inventory/playfab   -H "Authorization: Bearer <JWT>"   -H "Content-Type: application/json"   -d '{"sessionTicket":"<PLAYFAB_SESSION_TICKET>","count":50}'
```

### 9) Captures (screenshots) → `/captures/screenshots`
```bash
curl "http://localhost:3000/captures/screenshots?max=24"   -H "Authorization: Bearer <JWT)"   -H "x-xbl-token: XBL3.0 x=<uhs>;<xstsToken>"
```

### 10) Debug: decode token → `/debug/decode-token` (non-production)
```bash
curl -X POST http://localhost:3000/debug/decode-token   -H "Authorization: Bearer <JWT>"   -H "Content-Type: application/json"   -d '{"token":"XBL3.0 x=<uhs>;<xstsToken>","type":"xsts"}'
```

> **More examples & schemas:** See Swagger UI at `http://localhost:3000/api-docs`.

---

## 📖 API Reference

### Auth
| Method | Endpoint             | Description                                      |
|-------:|----------------------|--------------------------------------------------|
| GET    | `/auth/device`       | Request Microsoft device code                    |
| POST   | `/auth/callback`     | Redeem device code → JWT, XBL/XSTS, PlayFab, MC |
| GET    | `/auth/whoami`       | Decoded JWT user info                            |
| POST   | `/auth/jwt/refresh`  | Refresh your API JWT                             |

### Lookup
| Method | Endpoint            | Description                        | Headers        |
|-------:|---------------------|------------------------------------|----------------|
| GET    | `/lookup/xuid`      | Resolve XUID from Gamertag         | `x-xbl-token`  |
| GET    | `/lookup/gamertag`  | Resolve Gamertag from XUID         | `x-xbl-token`  |

### Profile & Titles
| Method | Endpoint           | Description                                | Headers       |
|-------:|--------------------|--------------------------------------------|---------------|
| GET    | `/profile/me`      | Profile settings (selectable fields)       | `x-xbl-token` |
| GET    | `/profile/titles`  | User's TitleHub list                       | `x-xbl-token` |
| GET    | `/titles/recent`   | Recently played (sorted)                   | `x-xbl-token` |

### Presence & People
| Method | Endpoint                   | Description                         | Headers       |
|-------:|----------------------------|-------------------------------------|---------------|
| GET    | `/presence/me`             | Presence for the authenticated user | `x-xbl-token` |
| POST   | `/presence/batch`          | Presence for multiple XUIDs         | `x-xbl-token` |
| GET    | `/people/friends`          | Mutual friends                      | `x-xbl-token` |
| GET    | `/people/followers`        | Followers                           | `x-xbl-token` |
| GET    | `/people/friends/presence` | Presence for first N friends        | `x-xbl-token` |

### Captures
| Method | Endpoint                | Description            | Headers       |
|-------:|-------------------------|------------------------|---------------|
| GET    | `/captures/clips`       | User's game clips      | `x-xbl-token` |
| GET    | `/captures/screenshots` | User's screenshots     | `x-xbl-token` |

### Achievements & Stats
| Method | Endpoint                 | Description                                   | Headers       |
|-------:|--------------------------|-----------------------------------------------|---------------|
| GET    | `/achievements/me`       | Achievements (optional `titleId`)             | `x-xbl-token` |
| GET    | `/achievements/summary`  | Aggregated earned/total for a title           | `x-xbl-token` |
| GET    | `/stats/xbox/me`         | Xbox stats (Minecraft SCIDs) + aggregates     | `x-xbl-token` |

### Inventory & Minecraft
| Method | Endpoint                           | Description                                           | Headers      |
|-------:|------------------------------------|-------------------------------------------------------|--------------|
| POST   | `/inventory/playfab`               | PlayFab inventory via SessionTicket/EntityToken       | —            |
| GET    | `/inventory/minecraft`             | Minecraft entitlements (optional `includeReceipt`)    | `x-mc-token` |
| GET    | `/inventory/minecraft/creators/top`| Top creators from entitlements (by item count)        | `x-mc-token` |
| GET    | `/inventory/minecraft/search`      | Search entitlements (`productId`, `q`, `limit`)       | `x-mc-token` |
| POST   | `/minecraft/token`                 | Create Minecraft multiplayer token from SessionTicket | —            |

### Debug & Health
| Method | Endpoint              | Description                          |
|-------:|-----------------------|--------------------------------------|
| POST   | `/debug/decode-token` | Decode JWT/XSTS/MC token (no verify) |
| GET    | `/healthz`            | Liveness                             |
| GET    | `/readyz`             | Readiness                            |

> **Security & Headers**: Global `BearerAuth` (JWT) via Swagger; individual endpoints may require Xbox or MC headers as `apiKey` schemes.

---

## ⛔ Rate Limiting

* **`/auth/*`**: 30 requests/minute/IP (see `src/middleware/rateLimit.js`).
* Other endpoints: no limiter configured by default (easy to add).

---

## 📊 Logging & Docs

* **Request logging**: Custom colorful logger (badges: OK/WARN/ERR), request duration, status code, method, URL, request ID. Swagger assets and health probes are muted to avoid log spam.
* **Errors**: Consistent JSON format; stack traces only in non-production.
* **Swagger/OpenAPI**: Generated from route JSDoc in `src/utils/swagger.js`.
    * UI: `GET /api-docs`
    * JSON: `GET /openapi.json`

---

## 🛡 Middleware Stack

1. `helmet` (security headers)
2. `cors` (configurable via `CORS_ORIGIN`)
3. `express.json({ limit: "1mb" })`
4. `compression` (gzip)
5. **Custom logger** (color badges, muted noise)
6. **Route-specific**:
    * `jwtMiddleware` (JWT validation)
    * `authLimiter` (only for `/auth/*`)
7. `notFoundHandler` → `errorHandler` (uniform JSON errors)

---

## 🐳 Docker Support

> Example Dockerfile to containerize quickly:

```Dockerfile
# Dockerfile (example)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]
```

**Build & Run**
```bash
docker build -t xlink-service .
docker run -d --name xlink -p 3000:3000   -e PORT=3000   -e JWT_SECRET="change-me-please-change-me"   -e CLIENT_ID="<MS_APP_CLIENT_ID>"   -e PLAYFAB_TITLE_ID="20ca2"   xlink-service
```

---

## 🧪 Scripts

Add or adapt in your `package.json`:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "lint": "eslint .",
    "test": "jest"
  }
}
```

---

## 🤝 Contributing

1. Fork the repo 🔀
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request 📝

Please follow the code style and provide clear descriptions to ease reviews.

---

## ❓ FAQ

* **Why am I getting 401/403?**  
  Ensure `Authorization: Bearer <JWT>` is present and, for Xbox calls, also `x-xbl-token`.

* **How do I obtain `x-xbl-token`?**  
  From `/auth/callback` — it returns JWT, XBL/XSTS, PlayFab, and MC tokens.

* **Missing `x-mc-token`?**  
  Either get it from `/auth/callback` or create one via `/minecraft/token` using a PlayFab SessionTicket.

* **Title localization & images?**  
  Send `Accept-Language` (e.g., `en-US,en;q=0.9`) with TitleHub endpoints.

* **Upstream timeouts**  
  Tune `HTTP_TIMEOUT_MS` (default 15000 ms).

* **Rate limits**  
  `/auth/*` is limited to 30 req/min; add additional limiters as needed.

---

## 📄 License

This project uses the license in **LICENSE**. See [LICENSE](LICENSE) for details.
