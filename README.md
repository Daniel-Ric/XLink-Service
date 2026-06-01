# XLink Service (Xbox + Minecraft REST API)

[![License](https://img.shields.io/github/license/Daniel-Ric/XLink-Service)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/Daniel-Ric/XLink-Service?style=social)](https://github.com/Daniel-Ric/XLink-Service)
[![GitHub Issues](https://img.shields.io/github/issues/Daniel-Ric/XLink-Service)](https://github.com/Daniel-Ric/XLink-Service/issues)

> A standalone Node.js/Express service for Microsoft/Xbox Live auth, Xbox Profile/Presence/Captures/Stats, PlayFab client read APIs, and Minecraft (multiplayer token + entitlements) — protected by JWT and shipped with Swagger/OpenAPI docs.

> [!IMPORTANT]
> **Project Disclaimer**  
> XLink Service" by SpindexGFX is an independent project. It is not affiliated with, endorsed by, sponsored by, or otherwise connected to Mojang AB, Microsoft Corporation, or any of their subsidiaries or affiliates. No partnership, approval, or official relationship with Mojang AB or Microsoft is implied.  
> All names, logos, brands, trademarks, service marks, and registered trademarks are the property of their respective owners and are used strictly for identification and reference purposes only. This project does not claim ownership of third-party intellectual property and does not grant any license to use it.

---

## 📚 Table of Contents

* [✨ Highlights](#-highlights)
* [🚀 Quick Start](#-quick-start)
* [🔧 Configuration](#-configuration)
  * [Microsoft/Xbox Client IDs](#microsoftxbox-client-ids)
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
* **Minecraft Services**: Generate MCToken, fetch entitlements/balances, and access Marketplace wishlist + inbox messaging.
* **Redeem Flow Support**: Prepare/redeem Microsoft Store codes using RedeemNow-compatible calls.
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
| `JWT_EXPIRES_IN`   | `1h`          | JWT expiry (e.g., `1h`, `30m`, `2d`)                                      |
| `CLIENT_ID`        | — **required**| Microsoft/Xbox OAuth client ID used by the Device Code flow. See [Microsoft/Xbox client IDs](#microsoftxbox-client-ids). |
| `HTTP_TIMEOUT_MS`  | `15000`       | Timeout for outgoing HTTP calls (ms)                                     |
| `LOG_LEVEL`        | `info`        | General log level                                                        |
| `LOG_PRETTY`       | `true` (dev)  | Pretty logs (`true`/`false`), defaults to `false` in production           |
| `MC_GAME_VERSION`  | `1.21.62`     | Minecraft game version for token generation                              |
| `MC_PLATFORM`      | `Windows10`   | Platform identifier for Minecraft                                        |
| `PLAYFAB_TITLE_ID` | `20ca2`       | PlayFab Title ID                                                         |
| `ACCEPT_LANGUAGE`  | `en-US`       | Default `Accept-Language` for TitleHub                                   |
| `REDEEM_FLIGHTS_JSON` | —          | Optional JSON array overriding Microsoft Redeem flight flags              |
| `REDEEM_USER_AGENT` | —            | Optional browser User-Agent override for Redeem calls                     |
| `REDEEM_SEC_CH_UA` | —             | Optional `sec-ch-ua` override for Redeem calls                            |
| `REDEEM_CV_BASE`   | —            | Optional `MS-CV` base override for Redeem calls                           |
| `REDEEM_CLIENT_TYPE` | `MinecraftNet` | Redeem client type sent to Microsoft                                  |
| `REDEEM_DEVICE_FAMILY` | `Web`     | Redeem device family sent to Microsoft                                    |
| `SWAGGER_ENABLED`  | `true`        | Enable Swagger UI and OpenAPI endpoints                                  |
| `SWAGGER_SERVER_URL` | —           | Override OpenAPI server URL (defaults to `http://localhost:${PORT}`)      |
| `TRUST_PROXY`      | `loopback`    | Express `trust proxy` setting (`false`, `loopback`, subnet, or hop count like `1`) |

> **CORS**: In production, set `CORS_ORIGIN` to explicit origins (no `*`).

### Microsoft/Xbox Client IDs

`CLIENT_ID` controls which Microsoft/Xbox OAuth application is shown in the device-code consent screen and which title identity is used when Microsoft tokens are exchanged for Xbox Live/XSTS tokens.

For this service, the most practical default is the Minecraft: Bedrock Android client ID because it is commonly used with the Xbox Live SISU/device-code flow and is also used by `go-xsapi`'s `MinecraftAndroid` example configuration.

| Target client | Client ID | Notes |
|---------------|-----------|-------|
| Minecraft: Java / Win32 | `00000000402b5328` | Java Edition title client ID. |
| Minecraft: Bedrock Windows / Win32 | `0000000040159362` | Bedrock Windows title client ID. |
| Minecraft: Bedrock Android | `0000000048183522` | Recommended default for this service. Used by the current `.env` and by `go-xsapi`'s Minecraft Android SISU example. |
| Minecraft: Bedrock iOS | `000000004c17c01a` | Bedrock iOS title client ID. |
| Minecraft: Bedrock Nintendo | `00000000441cc96b` | Bedrock Nintendo title client ID. |
| Minecraft: Bedrock PlayStation | `000000004827c78e` | Bedrock PlayStation title client ID. |
| Minecraft Education | `b36b1432-1a1c-4c82-9b76-24de1cab42f2` | Minecraft Education client ID. |

Example:

```env
CLIENT_ID=0000000048183522
```

Changing `CLIENT_ID` invalidates assumptions made by previously issued Microsoft refresh tokens. After changing it, start a new `/auth/device` login instead of reusing old `msRefreshToken` values.

The source project does not own or verify these Microsoft/Mojang/Xbox identifiers. They are listed as interoperability references for users who already understand the target title and platform they want to authenticate as.

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
│   │   ├── redeem.routes.js
│   │   ├── wishlist.routes.js
│   │   ├── messaging.routes.js
│   │   ├── health.routes.js
│   │   └── debug.routes.js    # only mounted in non-production
│   ├── services/              # Integrations (Microsoft, Xbox, PlayFab, Minecraft)
│   │   ├── microsoft.service.js
│   │   ├── xbox.service.js    # LRU cache for hot endpoints
│   │   ├── playfab.service.js
│   │   ├── minecraft.service.js
│   │   └── redeem.service.js
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
curl -X POST http://localhost:3000/presence/batch   -H "Authorization: Bearer <JWT>"   -H "x-xbl-token: XBL3.0 x=<uhs>;<xstsToken>"   -H "Content-Type: application/json"   -d '{"xuids":["2533274...","2814650..."]}'
```

### 7) Minecraft entitlements → `/inventory/minecraft`
```bash
curl "http://localhost:3000/inventory/minecraft?includeReceipt=false"   -H "Authorization: Bearer <JWT>"   -H "x-mc-token: MCToken eyJ..."
```

### 8) PlayFab inventory → `/inventory/playfab`
```bash
curl -X POST http://localhost:3000/inventory/playfab   -H "Authorization: Bearer <JWT>"   -H "Content-Type: application/json"   -d '{"sessionTicket":"<PLAYFAB_SESSION_TICKET>","count":50}'
```

### 9) PlayFab inventory test (title id e9d1) → `/inventory/playfab/test`
```bash
curl -X POST http://localhost:3000/inventory/playfab/test   -H "Authorization: Bearer <JWT>"   -H "Content-Type: application/json"   -d '{"playfabToken":"XBL3.0 x=<uhs>;<xstsToken>","entityType":"title_player_account","count":50}'
```
* `playfabToken` comes from `POST /auth/callback` in this API (response field `playfabToken`).
* Use `entityType=master_player_account` to target the master entity. If you want a specific entity id, pass `entityId`. Otherwise the service uses the PlayFabId returned by LoginWithXbox.

### 10) Captures (screenshots) → `/captures/screenshots`
```bash
curl "http://localhost:3000/captures/screenshots?max=24"   -H "Authorization: Bearer <JWT>"   -H "x-xbl-token: XBL3.0 x=<uhs>;<xstsToken>"
```

### 11) Debug: decode token → `/debug/decode-token` (non-production)
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
| POST   | `/auth/refresh`      | Refresh tokens via Microsoft refresh_token       |
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
| POST   | `/profile/overview`| Combined profile, stats, optional inventory| `x-xbl-token` |
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
| POST   | `/inventory/playfab/test`          | PlayFab inventory test via XSTS (title id e9d1)       | —            |
| GET    | `/inventory/minecraft`             | Minecraft entitlements (optional `includeReceipt`)    | `x-mc-token` |
| GET    | `/inventory/minecraft/balances`    | Minecraft Marketplace currency balances               | `x-mc-token` |
| POST   | `/inventory/minecraft/capes`       | Minecraft Dressing Room capes layout page (body optional) | `x-mc-token` |
| GET    | `/inventory/minecraft/creators/top`| Top creators from entitlements (by item count)        | `x-mc-token` |
| GET    | `/inventory/minecraft/search`      | Search entitlements (`productId`, `q`, `limit`)       | `x-mc-token` |
| POST   | `/wishlist/list`                   | Marketplace wishlist page                             | `x-mc-token` |
| POST   | `/wishlist/item`                   | Add/remove Marketplace wishlist item                  | `x-mc-token` |
| POST   | `/messaging/inbox/start`           | Marketplace inbox session (start/resume)              | `x-mc-token` |
| POST   | `/messaging/session/start`         | Alias of inbox start                                  | `x-mc-token` |
| POST   | `/messaging/inbox/event`           | Mark seen/delete message events                       | `x-mc-token` |
| POST   | `/minecraft/token`                 | Create Minecraft multiplayer token from SessionTicket | —            |
| POST   | `/minecraft/token/refresh`         | Refresh PlayFab SessionTicket + Minecraft token       | —            |

### PlayFab
| Method | Endpoint                    | Description                                      |
|-------:|-----------------------------|--------------------------------------------------|
| POST   | `/playfab/account`          | PlayFab account info via SessionTicket           |
| POST   | `/playfab/profile`          | Player profile via SessionTicket/PlayFabId       |
| POST   | `/playfab/catalog`          | Catalog items (optional catalog version)         |
| POST   | `/playfab/titledata`        | TitleData values (optional keys)                 |
| POST   | `/playfab/userdata`         | UserData (optional keys or PlayFabId)            |
| POST   | `/playfab/userdata/readonly`| UserReadOnlyData (optional keys or PlayFabId)    |

### Redeem
| Method | Endpoint           | Description                                      | Headers          |
|-------:|--------------------|--------------------------------------------------|------------------|
| POST   | `/redeem/lookup`   | PrepareRedeem lookup for a code                  | `x-redeem-token` |
| POST   | `/redeem/redeem`   | PrepareRedeem + RedeemToken flow                 | `x-redeem-token` |

### Debug & Health
| Method | Endpoint              | Description                          |
|-------:|-----------------------|--------------------------------------|
| POST   | `/debug/decode-token` | Decode JWT, XSTS (XBL3.0), MCToken, and PlayFab sessionTicket token (no verify) |
| POST   | `/debug/decode-callback` | Extract + decode tokens from /auth/callback payload |
| GET    | `/healthz`            | Liveness                             |
| GET    | `/readyz`             | Readiness                            |

> **Security & Headers**: Global `BearerAuth` (JWT) via Swagger; individual endpoints may require Xbox or MC headers as `apiKey` schemes.

---

## ⛔ Rate Limiting

* **Global limiter**: 600 requests/minute/IP (all routes).
* **`/auth/*`**: 30 requests/minute/IP (see `src/middleware/rateLimit.js`).

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
5. **Global rate limiter** (600 req/min)
6. **Custom logger** (color badges, muted noise)
7. **Route-specific**:
    * `jwtMiddleware` (JWT validation)
    * `authLimiter` (only for `/auth/*`)
8. `notFoundHandler` → `errorHandler` (uniform JSON errors)

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
  Global limit is 600 req/min/IP; `/auth/*` is limited to 30 req/min/IP.

---

## 📄 License

This project uses the license in **LICENSE**. See [LICENSE](LICENSE) for details.
