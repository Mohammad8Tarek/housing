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
