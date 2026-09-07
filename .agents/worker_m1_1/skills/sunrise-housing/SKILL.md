# Sunrise Staff Housing Management - Official Skill & Runbook

## 1. Project Context & Stack
- **Application Name:** Sunrise Staff Housing Management System
- **Frontend (`artifacts/housing`):** React 18, Vite, TypeScript, TailwindCSS, Shadcn UI, TanStack Query v5, Lucide React, Sonner.
- **Backend (`artifacts/api-server`):** Node.js (ESM), Express, Drizzle ORM, `pg-pool`, WebSocket server, BullMQ/Queue workers.
- **Database:** PostgreSQL 18 with Multi-Tenant Schema Isolation (`public` for global tables, `taal_housing`, `el_waha_new`, `elwaha_old` for hotel properties).
- **Mobile/Portal (`artifacts/employee-portal`):** Capacitor Android & Web Portal.
- **Lock Management:** Hotek PMS Lock TCP Socket Bridge (Port 10006).

## 2. Core Architectural Invariants (Must Never Be Broken)
### Rule 1: Zero Data Loss Database Migrations
### Rule 2: Dual-Layer Role & Permission Enforcement (RBAC)
### Rule 3: Server-Side Pagination & Debounced Search
### Rule 4: Bilingual (Arabic RTL / English LTR) & No Overflow Tables
### Rule 5: State Synchronization & Room Lifecycle
