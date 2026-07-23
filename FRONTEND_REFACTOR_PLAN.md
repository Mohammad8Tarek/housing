# Frontend Refactoring Plan — Sunrise Housing

> **Goal:** Break down oversized React components into maintainable, testable pieces.  
> **Scope:** `artifacts/housing` (Admin Dashboard) + `artifacts/employee-portal` (Mobile Portal)

---

## 1. The Problem

| File | Size | Estimated Lines | Components Inside |
|------|------|-----------------|-------------------|
| `reports.tsx` | ~97 KB | ~2,500 | Multiple report types, charts, filters, export logic |
| `housing.tsx` | ~84 KB | ~2,200 | Room assignment, status badges, bulk actions, filters |
| `portal.tsx` | ~68 KB | ~1,700 | Chat, food/transport, notifications, contacts, schedule |
| `users.tsx` | ~62 KB | ~1,600 | CRUD table, modals, forms, permission editor |
| `settings.tsx` | ~43 KB | ~1,100 | Tabs, forms, lookups, system config |

**Why this is bad:**
- Impossible to review in PRs.
- Re-renders affect everything (no memoization boundaries).
- Business logic mixed with UI logic.
- Hard to test (would need to mount the entire app to test one feature).
- Build times and HMR are slow.

---

## 2. Target Architecture (Per Page)

```
📁 pages/reports/
├── index.tsx                    # Page shell (layout + route-level logic)
├── ReportsContainer.tsx         # State container (data fetching, actions)
├── components/
│   ├── ReportFilters.tsx        # Filter bar (date range, type, export)
│   ├── ReportTable.tsx          # Data table wrapper
│   ├── ReportChart.tsx          # Recharts wrapper
│   ├── ExportModal.tsx          # PDF/Excel export UI
│   └── ReportCards.tsx          # Summary cards (KPIs)
├── hooks/
│   ├── useReports.ts            # React Query hook for fetching
│   ├── useReportExport.ts       # Export logic (html2canvas, jspdf, xlsx)
│   └── useReportFilters.ts      # Filter state management
├── types.ts                     # Page-specific types
└── utils.ts                     # Pure helpers (formatting, calculations)
```

**Rule of Thumb:**
- No component file > 300 lines.
- No component > 10 KB.
- No `useEffect` > 5 lines (extract to custom hook).
- No inline JSX inside `map()` (extract to sub-component).

---

## 3. File-by-File Refactor Plan

### 3.1 `reports.tsx` (~97 KB)

**Current Structure:** Single file with:
- Report type selector (tabs)
- Multiple chart types (bar, line, pie)
- Data table with pagination
- Export to PDF/Excel
- Filter sidebar
- KPI summary cards

**Refactor Plan:**

```
📁 pages/reports/
├── index.tsx
├── ReportsContainer.tsx
├── components/
│   ├── ReportLayout.tsx
│   ├── ReportTypeTabs.tsx          # Tab switcher
│   ├── ReportFilters.tsx           # Date, property, employee filters
│   ├── KpiCards.tsx                # Summary cards row
│   ├── ReportChart.tsx             # Dynamic chart based on type
│   ├── ReportDataTable.tsx         # Paginated table
│   └── ExportToolbar.tsx           # PDF / Excel / Print buttons
├── hooks/
│   ├── useReportData.ts            # Main query hook
│   ├── useReportExport.ts          # Export orchestration
│   └── useReportFilters.ts         # URL-synced filter state
├── constants.ts                    # Report types, chart configs
└── types.ts
```

**Estimated Time:** 3–4 days  
**Priority:** 🔴 Critical (largest file, most complex)

---

### 3.2 `housing.tsx` (~84 KB)

**Current Structure:** Single file with:
- Room grid / list view toggle
- Status badges (occupied, vacant, maintenance)
- Room assignment modal
- Guest hosting modal
- Bulk actions (check-in, check-out)
- Filter bar (floor, building, status)
- Search

**Refactor Plan:**

```
📁 pages/housing/
├── index.tsx
├── HousingContainer.tsx
├── components/
│   ├── ViewToggle.tsx              # Grid / List switch
│   ├── RoomGrid.tsx                # Grid of RoomCard
│   ├── RoomList.tsx                # Table view of rooms
│   ├── RoomCard.tsx                # Individual room card
│   ├── RoomFilters.tsx             # Building, floor, status filters
│   ├── RoomSearch.tsx              # Search input
│   ├── AssignmentModal.tsx         # Assign employee to room
│   ├── GuestHostingModal.tsx       # Guest/companion flow
│   ├── BulkActionsBar.tsx          # Check-in / Check-out / Move
│   └── RoomStatusBadge.tsx         # Color-coded status
├── hooks/
│   ├── useRooms.ts                 # Room data query
│   ├── useRoomAssignment.ts        # Mutation for assignment
│   ├── useGuestHosting.ts          # Guest hosting mutation
│   └── useRoomFilters.ts           # Filter state
├── constants.ts                    # Status enums, colors
└── types.ts
```

**Estimated Time:** 3 days  
**Priority:** 🔴 Critical (core business logic)

---

### 3.3 `portal.tsx` (~68 KB) — Employee Portal

**Current Structure:** Single file with:
- Chat interface
- Food/transport requests
- Notifications
- Contacts list
- Schedule/calendar

**Refactor Plan:**

```
📁 pages/portal/
├── index.tsx
├── PortalContainer.tsx
├── components/
│   ├── PortalHeader.tsx            # Employee info + logout
│   ├── ChatWidget.tsx              # Chat UI (already has portal_chat.ts backend)
│   ├── FoodRequestForm.tsx         # Food request creation
│   ├── TransportRequestForm.tsx    # Transport request creation
│   ├── RequestList.tsx             # My requests list
│   ├── NotificationBell.tsx        # Notification dropdown
│   ├── ContactList.tsx             # Property contacts
│   └── ScheduleView.tsx            # Calendar / schedule
├── hooks/
│   ├── usePortalData.ts            # General portal data
│   ├── useChat.ts                  # Chat WebSocket hook
│   ├── useRequests.ts              # Food/transport CRUD
│   └── useNotifications.ts         # Push + in-app notifications
├── constants.ts
└── types.ts
```

**Estimated Time:** 2–3 days  
**Priority:** 🟠 High

---

### 3.4 `users.tsx` (~62 KB)

**Current Structure:** Single file with:
- User CRUD table
- Create/Edit modal with forms
- Permission matrix editor
- Role assignment
- Search & filters
- Bulk actions

**Refactor Plan:**

```
📁 pages/users/
├── index.tsx
├── UsersContainer.tsx
├── components/
│   ├── UserTable.tsx               # Data table
│   ├── UserFilters.tsx             # Role, status, property filters
│   ├── UserSearch.tsx              # Search input
│   ├── UserModal.tsx               # Create/Edit wrapper
│   ├── UserForm.tsx                # Form fields (name, email, role, etc.)
│   ├── PermissionMatrix.tsx        # Grid of checkboxes per module
│   ├── RoleSelector.tsx            # Role dropdown + description
│   └── BulkActions.tsx             # Activate / Deactivate / Delete
├── hooks/
│   ├── useUsers.ts                 # Users query + CRUD mutations
│   ├── usePermissions.ts           # Permission fetching
│   └── useUserFilters.ts           # Filter state
├── constants.ts
└── types.ts
```

**Estimated Time:** 2 days  
**Priority:** 🟠 High

---

### 3.5 `settings.tsx` (~43 KB)

**Current Structure:** Single file with:
- Tabbed interface (General, Properties, Lookups, System)
- Multiple forms
- Lookup value management
- System configuration

**Refactor Plan:**

```
📁 pages/settings/
├── index.tsx
├── SettingsContainer.tsx
├── components/
│   ├── SettingsTabs.tsx            # Tab navigation
│   ├── GeneralSettings.tsx         # System name, logo, etc.
│   ├── PropertySettings.tsx        # Property CRUD
│   ├── LookupManager.tsx           # Dynamic lookup tables
│   ├── SystemConfig.tsx            # Advanced settings
│   └── SettingsForm.tsx            # Reusable form wrapper
├── hooks/
│   ├── useSettings.ts              # Settings query + mutations
│   └── useLookups.ts               # Lookup values CRUD
├── constants.ts
└── types.ts
```

**Estimated Time:** 1–2 days  
**Priority:** 🟡 Medium

---

## 4. Reusable Component Extraction

During the refactor, extract these common components to `components/ui/` or `components/shared/`:

| Component | Used In | Action |
|-----------|---------|--------|
| `DataTable` | reports, users, housing, maintenance | Already exists? Check if radix-table can be extracted |
| `FilterBar` | reports, housing, users, maintenance | Extract generic filter container |
| `ExportButton` | reports, users | Wrap html2canvas + jspdf + xlsx logic |
| `ConfirmModal` | housing, users, settings | Generic confirmation dialog |
| `StatusBadge` | housing, maintenance, users | Color + label based on status enum |
| `SearchInput` | housing, users, maintenance | Debounced search with clear button |
| `FormModal` | users, settings, housing | Reusable modal with form + submit/cancel |
| `DateRangePicker` | reports, activity-log | Reusable date range selection |
| `KpiCard` | reports, dashboard | Metric card with icon + trend |

---

## 5. State Management Strategy

### Current State
- React Query for server state
- React `useState` for local UI state
- Context for auth, language, property

### Recommended Improvements
1. **Move filter state to URL query params:**
   ```tsx
   // Use wouter's useLocation + URLSearchParams
   // OR use a custom hook:
   const [filters, setFilters] = useUrlFilters({ page: 1, status: "" });
   ```
   Benefit: Shareable URLs, back button works, no state lost on refresh.

2. **Extract data fetching into dedicated hooks:**
   ```tsx
   // hooks/useReports.ts
   export function useReports(filters: ReportFilters) {
     return useQuery({
       queryKey: ["reports", filters],
       queryFn: () => api.reports.getAll(filters),
       staleTime: 60_000,
     });
   }
   ```

3. **Use `useMutation` + `queryClient.invalidateQueries` for all writes:**
   Ensure cache is invalidated after create/update/delete.

---

## 6. Performance Optimizations During Refactor

| Technique | Where | Benefit |
|-----------|-------|---------|
| `React.lazy()` + `Suspense` | `App.tsx` route components | Smaller initial bundle |
| `React.memo()` | RoomCard, ReportRow, UserRow | Prevent re-renders when parent changes |
| `useMemo()` | Expensive calculations (KPIs, chart data) | Avoid re-computation |
| `useCallback()` | Event handlers passed to children | Stable references for memo |
| Virtual scrolling | Large tables (>100 rows) | Smooth rendering |
| Debounced search | Search inputs | Fewer API calls |

---

## 7. Testing Plan for Refactored Components

After each file is refactored, write tests:

```tsx
// components/__tests__/ReportFilters.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ReportFilters } from "../ReportFilters";

describe("ReportFilters", () => {
  it("calls onChange when date range is selected", () => {
    const onChange = vi.fn();
    render(<ReportFilters filters={{}} onChange={onChange} />);
    // Test interaction
  });
});
```

**Test priorities:**
1. Filter components (most user interaction)
2. Modal components (complex state)
3. Data tables (rendering + pagination)
4. Export functionality (edge cases)

---

## 8. Step-by-Step Execution Order

### Phase 1: Foundation (2 days)
1. Set up folder structure template in `pages/_template/`
2. Create shared components: `FilterBar`, `ConfirmModal`, `StatusBadge`, `SearchInput`
3. Add `useUrlFilters` hook utility
4. Configure Vitest + React Testing Library

### Phase 2: `settings.tsx` (Pilot) (1 day)
- Smallest file → good for testing the pattern
- Extract tabs, forms, lookup manager
- Verify bundle size reduction
- Write tests for extracted components

### Phase 3: `users.tsx` (2 days)
- Extract table, filters, modals, permission matrix
- Add tests for CRUD operations

### Phase 4: `portal.tsx` (2 days)
- Extract chat, requests, notifications, contacts, schedule
- Mobile-first testing (Capacitor)

### Phase 5: `housing.tsx` (3 days)
- Core business logic → be careful
- Extract room views, assignment flow, guest hosting
- Test bulk actions thoroughly

### Phase 6: `reports.tsx` (3–4 days)
- Largest file → most complex
- Extract charts, tables, export logic, filters
- Test export functionality with large datasets

### Phase 7: `App.tsx` Cleanup (1 day)
- Remove `@ts-nocheck`
- Add `React.lazy()` for all routes
- Add `<Suspense>` boundaries
- Final TypeScript check

**Total Estimated Time:** 2–3 weeks (1 developer, full-time)

---

## 9. Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Largest file size | ~97 KB | <20 KB |
| Lines per file (max) | ~2,500 | <300 |
| Files in `pages/` | 5 massive files | 20+ focused files |
| Test coverage (pages) | 0% | >50% |
| Build time (housing) | ~X s | ~30% faster (lazy loading) |
| HMR speed | Slow | Fast (smaller modules) |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Refactor one file at a time, test before moving to next |
| Time overrun | Start with smallest file (`settings.tsx`) as pilot |
| Lost git history | Use `git mv` for file moves, preserve blame |
| Merge conflicts | Do refactor in a dedicated branch, merge frequently from main |
| Mobile portal regression | Test on Capacitor after each portal refactor |

---

*End of Plan*
