# DEKU DISTRIBUTOR PORTAL — IMPLEMENTATION & RUNTIME GUIDE
## Interface 2: Development, Components & Containerization

---

## 1. Directory Structure

```
apps/distributor/
├── docs/
│   ├── ARCHITECTURE.md          <-- Two-condition protocol, territory isolation, and scopes
│   └── IMPLEMENTATION.md        <-- This implementation guide
├── public/                      <-- Static assets
├── src/
│   ├── app/
│   │   ├── api/distributor/
│   │   │   └── route.ts         <-- Distributor API handler (GET data, POST license requests)
│   │   ├── globals.css          <-- Tailwind CSS v4 & Deku Design Tokens
│   │   ├── layout.tsx           <-- Next.js 16 root layout with partner title metadata
│   │   └── page.tsx             <-- 3-Column Bento Grid Distributor Workspace UI
│   └── lib/
│       └── store.ts             <-- Ecosystem in-memory/Postgres persistence layer
├── Dockerfile                   <-- Standalone multistage production container definition
├── next.config.ts               <-- Next.js 16 standalone build configuration
├── package.json                 <-- Minimal dependencies (next, react, lucide-react)
└── tsconfig.json                <-- Strict TypeScript configuration
```

---

## 2. API Endpoints (`/api/distributor`)

The Distributor frontend communicates with its isolated backend via `/api/distributor`:

### `GET /api/distributor?distributorId=dist-mh-01`
Fetches partner credentials, active leads, historical requests, and active client licenses:
- **Response Shape**:
  ```json
  {
    "success": true,
    "distributor": {
      "id": "dist-mh-01",
      "distributorCode": "DIST-MH-01",
      "companyName": "Maharashtra Tech Enterprise Solutions",
      "allocatedSeatQuota": 50,
      "availableServiceCredits": 100
    },
    "leads": [...],
    "requests": [...],
    "clientLicenses": [...]
  }
  ```

### `POST /api/distributor`
Processes commercial partner operations:
- `action: "submit_license_request"` — Enforces Condition 1 (client details) and Condition 2 (invoice/proof document attachment) before queuing for Admin review.
- `action: "provision_seats"` — Decrements partner's seat bank to immediately allocate extra seats to an active client.
- `action: "provision_service"` — Deducts service credits to allocate CA onboarding hours.
- `action: "update_lead_status"` — Updates lead pipeline (`contacted`, `in_setup`, `converted`).

---

## 3. Containerization & Dockerfile

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

Run the Distributor Portal locally outside Docker:
```bash
cd apps/distributor
npm install
npm run dev
```
Open [`http://localhost:3002`](http://localhost:3002) in your browser.

