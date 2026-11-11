# DEKU ADMIN CONSOLE — IMPLEMENTATION & RUNTIME GUIDE
## Interface 1: Development, Components & Containerization

---

## 1. Directory Structure

```
apps/admin/
├── docs/
│   ├── ARCHITECTURE.md          <-- Security boundary, authority model, and workflows
│   └── IMPLEMENTATION.md        <-- This implementation guide
├── public/                      <-- Static assets
├── src/
│   ├── app/
│   │   ├── api/admin/
│   │   │   └── route.ts         <-- Central Admin API handler (GET metrics, POST actions)
│   │   ├── globals.css          <-- Tailwind CSS v4 & Deku Design Tokens
│   │   ├── layout.tsx           <-- Next.js 16 root layout with viewport metadata
│   │   └── page.tsx             <-- 3-Column Bento Grid Admin Console UI
│   └── lib/
│       └── store.ts             <-- Ecosystem in-memory/Postgres persistence layer
├── Dockerfile                   <-- Standalone multistage production container definition
├── next.config.ts               <-- Next.js 16 standalone build configuration
├── package.json                 <-- Minimal dependencies (next, react, lucide-react)
└── tsconfig.json                <-- Strict TypeScript configuration
```

---

## 2. API Endpoints (`/api/admin`)

The Admin frontend communicates with its isolated backend via `/api/admin`:

### `GET /api/admin`
Fetches global platform metrics and entity rosters:
- **Response Shape**:
  ```json
  {
    "success": true,
    "metrics": {
      "totalDistributors": 3,
      "activeLicenses": 14,
      "pendingVerifications": 1,
      "totalSalesVolumeINR": 145000,
      "inboundLeadsCount": 4
    },
    "admins": [...],
    "distributors": [...],
    "licenseRequests": [...],
    "licenses": [...]
  }
  ```

### `POST /api/admin`
Handles administrative operations via action-dispatched payloads:
- `action: "approve_license"` — Validates pending request and mints `DEKU-*-XXXX-XXXX` license.
- `action: "reject_license"` — Records rejection memo and notifies distributor.
- `action: "create_distributor"` — Registers new partner with assigned territories and seat quota.
- `action: "add_admin"` — Provisions sub-admin with role binding.
- `action: "toggle_admin"` — Toggles active/suspended security status.

---

## 3. Containerization & Dockerfile

The Admin Console uses a multi-stage Docker build to produce a minimal, hardened container:

```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 4. Local Development & Testing

Run the Admin Console locally outside Docker:
```bash
cd apps/admin
npm install
npm run dev
```
Open [`http://localhost:3001`](http://localhost:3001) in your browser.

