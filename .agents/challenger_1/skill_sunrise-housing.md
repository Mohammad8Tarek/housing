# Sunrise Staff Housing Management - Official Skill & Runbook

## 1. Project Context & Stack
- Application Name: Sunrise Staff Housing Management System
- Frontend: React 18, Vite, TypeScript, TailwindCSS, Shadcn UI, TanStack Query v5, Lucide React, Sonner.
- Backend: Node.js (ESM), Express, Drizzle ORM, pg-pool, WebSocket server, BullMQ/Queue workers.
- Database: PostgreSQL 18 with Multi-Tenant Schema Isolation.

## 2. Core Architectural Invariants
- Zero Data Loss Database Migrations (idempotent, never DROP).
- Dual-Layer Role & Permission Enforcement (RBAC): Frontend <PermissionGate> + Backend requirePermission().
- Server-Side Pagination & Debounced Search.
- Bilingual (Arabic RTL / English LTR) & No Overflow Tables.
- State Synchronization & Room Lifecycle.
