# Original User Request

## 2026-09-07T15:47:01Z

Requested team: Full team

Redesign and elevate the Add/Edit User dialog and the Permission Matrix Center in the Sunrise Housing Management System with a modern, elegant, and intuitive UX inspired by modern generative design, fully integrated with the system's bilingual (Arabic/English) conventions and dual-layer RBAC architecture.

Working directory: e:/lab/Sunrise-Housing-FULL/final_project
Integrity mode: development

## Requirements

### R1. Modern Add & Edit User Dialog Experience
- Redesign the user creation and editing modals (`artifacts/housing/src/pages/users/components/CreateUserDialog.tsx` and `artifacts/housing/src/pages/users/components/EditUserDialog.tsx`) following the project's existing design language (TailwindCSS, Shadcn/Radix UI, Lucide icons, Dark/Light theme).
- Organize form fields into clear visual sections: Account Credentials (username, password, contact info), Hotel/Property Multi-Select Assignment, Role Selector with informative badges, and Account Status.
- Provide real-time form validation with bilingual (AR/EN) error guidance and visual password security indicators matching system password policy.

### R2. Interactive Permission Matrix & Center Redesign
- Revamp the Permission Matrix dialog and center (`artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx` and `artifacts/housing/src/pages/users/components/PermissionMatrixCenter.tsx`) to provide a frictionless, visually rich permission management experience.
- Group permissions logically by module (Housing, Housekeeping, Profiles, Accommodation, Reservations, Maintenance, Reports, Settings, Users, Activity Log, Documents, etc.).
- Add one-click bulk toggle actions per module ("Select All", "Deselect All") and role-based baseline presets.
- Include a quick real-time search bar to filter permissions by action or module keyword in both Arabic and English.
- Visually distinguish between baseline role permissions and explicitly granted custom permissions with clear badges and tooltips.

### R3. Bilingual RTL/LTR Consistency & Strict Quality Standards
- Ensure 100% responsive, overflow-free modal and drawer layouts with perfect typography for Arabic (RTL) and English (LTR).
- Maintain dual-layer permission enforcement: save permissions in the exact format expected by the API (`module.action` / `module:action`).
- Provide smooth micro-interactions (transitions, toggle animations) without layout jitter or performance lag.

## Acceptance Criteria

### UI & UX Quality
- [ ] The Add/Edit User modal presents a clean, modern, multi-section interface that matches the application's design language.
- [ ] The Permission Matrix displays grouped modules with real-time search filtering and bulk toggle controls.
- [ ] Role-based presets allow loading standard role permissions into the matrix with a single click.
- [ ] Arabic (RTL) and English (LTR) modes render with balanced layout, proper alignment, and no text overflow.

### Integration & Reliability
- [ ] User creation, editing, and custom permission assignment save successfully via the API with immediate query invalidation and success toasts.
- [ ] Protected endpoints and actions respect the assigned permissions in both frontend (`<PermissionGate>`) and backend API routes.
- [ ] Frontend production build (`cd artifacts/housing && npm run build`) executes cleanly with exit code 0.

## 2026-09-08T13:32:04Z

Comprehensive end-to-end automated testing of every interactive element, button, modal dialog, permission check, and business workflow across the entire Sunrise Staff Housing Management system and the Employee Portal.

Working directory: e:\lab\Sunrise-Housing-FULL\final_project

## Requirements

### R1. Housing Core UI & Button Interaction Suite
Automated execution and validation of every interactive button, dropdown, tab, search bar, filter, and pagination control across Dashboard, Housing (Buildings/Floors/Rooms/Housekeeping), Profiles, Accommodation (In-House, Reservations, Room Assignment, History, Guest Hosting), Maintenance, Users & Permissions, Settings, and Activity Log.

### R2. Dual-Layer RBAC & Permission Matrix Verification
Systematic verification that all UI buttons and backend API endpoints enforce dual-layer role-based access control (`PermissionGate` on frontend and `requirePermission` on backend) across standard roles, custom role matrices, and single/multi-property user accounts.

### R3. Employee Portal Comprehensive Flow Testing
Full automated testing of the Employee Portal (`artifacts/employee-portal`) covering login, biometric fallback, dashboard requests, request detail view, image zoom modal, back navigation, and password update workflows.

### R4. Zero-Data-Loss & Negative Boundary Assertions
Execution of negative edge cases, concurrent operations, and input boundary validations ensuring zero unhandled exceptions, zero data loss, and graceful error boundaries.

## Acceptance Criteria

### Automated Button & UI Coverage
- [ ] Every button, action menu item, modal trigger, and tab in the Housing frontend is visited and clicked with zero uncaught runtime exceptions in the browser console.
- [ ] Every form submission validates required inputs and produces proper bilingual feedback toasts.
- [ ] All table pagination, page size selectors, and debounced search inputs return valid records without resets or UI freezes.

### Dual-Layer RBAC Enforcement
- [ ] Users without specific permissions have corresponding action buttons hidden or disabled by `<PermissionGate>`.
- [ ] Direct API requests without adequate permissions return HTTP 403 Forbidden.
- [ ] Single-property users are restricted strictly to their assigned property schema without data leaks.

### Employee Portal Verification
- [ ] Authentication guards properly redirect unauthenticated users to `/login`.
- [ ] Request details view correctly displays matching request by ID, allows zooming image, and returns via back button.
- [ ] Portal console remains at 0 uncaught errors during complete user session.

### Full System Health Report
- [ ] Automated execution report generated detailing pass/fail status, response times, and DOM coverage percentage.

