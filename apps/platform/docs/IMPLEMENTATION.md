# DEKU PLATFORM ERP — IMPLEMENTATION & RUNTIME GUIDE
## Interface 3: Development, Components & Containerization

---

## 1. Directory Structure

```
apps/platform/
├── docs/
│   ├── ARCHITECTURE.md          <-- Core/Kernel/Shell, ALERX rules, and dual modes
│   └── IMPLEMENTATION.md        <-- This implementation guide
├── public/                      <-- Static assets, branding, and icons
├── src/
│   ├── app/
│   │   ├── (auth)/              <-- Login, Signup, Reset Password
│   │   ├── api/                 <-- Auth, Demo, Backend proxy, Learn
│   │   ├── approvals/           <-- Maker-Checker Approvals Queue
│   │   ├── audit/               <-- Immutable Audit Trail Register
│   │   ├── banking/             <-- Banking accounts & Reconciliation
│   │   ├── builder/             <-- WYSIWYG Document & Quote Studio
│   │   ├── day-book/            <-- Chronological Day Book Register
│   │   ├── departments-members/ <-- Personnel, Roles, and Payroll
│   │   ├── features/            <-- Dedicated Platform Features Hub
│   │   ├── gateway/             <-- Desktop Gateway OS Hub (Alt+G)
│   │   ├── gst-compliance/      <-- Statutory Tax & GSP Roadmap Hub
│   │   ├── learn/               <-- Public Learn Hub & Interactive Tours
│   │   ├── masters/             <-- COA, Parties, Catalogue
│   │   ├── reports/             <-- TB, P&L, BS, Cash Flow (WCM)
│   │   ├── settings/            <-- Fiscal periods, Operating mode, UPI
│   │   ├── vouchers/            <-- Voucher Workspace (F4 to F9)
│   │   ├── globals.css          <-- Tailwind v4 & Design Tokens
│   │   ├── layout.tsx           <-- Next.js 16 Root Layout
│   │   ├── page.tsx             <-- Main Landing Page (Hero, Features, FAQ)
│   │   └── proxy.ts             <-- Next.js 16 Edge Session Proxy
│   ├── components/              <-- UI Primitives, Table, Dialog, Navbars
│   ├── context/                 <-- AuthContext, OrganisationContext
│   ├── layouts/                 <-- AppShell, WorkspaceLayout
│   ├── lib/                     <-- ALERX calculations, tutorials, auth
│   └── modules/                 <-- Domain views (Gateway, Vouchers, Reports)
├── Dockerfile                   <-- Multi-stage standalone production build
├── next.config.ts               <-- Next.js 16 standalone config
├── package.json                 <-- Platform ERP dependencies
└── tsconfig.json                <-- Strict TypeScript configuration
```

---

## 2. Containerization & Dockerfile

The Platform ERP builds into an optimized standalone Node.js server container running on port `3000`:

```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

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

## 3. Local Development

Run the Platform ERP locally:
```bash
cd apps/platform
npm install
npm run dev
```
Open [`http://localhost:3000`](http://localhost:3000) in your browser.

