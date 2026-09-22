# Sunrise Housing — HR System Integration & Multi-Source Synchronization Runbook
# دليل الربط والتكامل الشامل مع أنظمة الموارد البشرية (HR Sync API)

## 1. Overview (نظرة عامة)

The Sunrise Staff Housing Management System provides an enterprise-grade integration bridge with external HR systems (e.g. Oracle HRMS, SAP SuccessFactors, MenaITech, or custom HR Solutions). It supports both **Pull (استيراد دوري)** and **Push Webhooks (إرسال فوري)**.

### Key Capabilities (المزايا الرئيسية):
1. **Multi-Database & Multi-Hotel Connections (ربط عدة قواعد بيانات وفنادق):**
   - Connect multiple HR APIs simultaneously (e.g. Al-Taj Hotel, White Hills Hotel, and Al-Marafe Hotel, all housing staff at the same location or distributed across properties).
2. **Selective Operations (مزامنة مخصصة بدون موظفين):**
   - **`movements_only` (إجازات وتصفيات فقط):** Sync leaves, returns, and departure checkouts without creating or touching employee profile records.
   - **`lookups_only` (مسميات وأقسام فقط):** Automatically parse incoming departments, job titles, levels, and companies and register them in `lookup_values`.
   - **`full` (مزامنة شاملة):** Full synchronization of profiles, lookups, and movements.
3. **Casual-to-Permanent Transition (`Casual -> Permanent` ترقية العمالة المؤقتة):**
   - When a temporary/casual employee (e.g. ID `CAS-1042`) is officially hired with a permanent ID (e.g. `EMP-8802`), the system matches them automatically by **National ID (الرقم القومي)**.
   - Upgrades `profileId` to the new ID, records `previousProfileId`, switches employment type to `INTERNAL`, and **preserves the active room and bed assignment 100% intact without any eviction or checkout!**
4. **Executive / Job Level & Department Filters (فلاتر سكن القيادات):**
   - Restrict imported profiles for specific executive housing properties (e.g. allow only Level 0 Management, Level 1 Dept Heads, and Level 2 Supervisors, while skipping lower levels).
   - Filter by specific departments or require `housingEligible: true`.
5. **Vacation & Departure Automation:**
   - Real-time room status transitions: `occupied_vacation` on leave, automatic checkout and `dirty` room status on departure/clearance with instant WebSocket broadcast alarms.

---

## 2. Authentication (المصادقة والتأمين)

### Webhook & Push Security (HR → Housing)
Requests sent from the external HR system to Housing Webhooks must include the `x-api-key` header:
```http
x-api-key: sunrise-hr-secret-2026
```
*(Configurable via `HR_SYNC_API_KEY` in `artifacts/api-server/.env`).*

### Pull Security (Housing → HR)
When Housing pulls data from external HR endpoints, it attaches the configured Bearer token:
```http
Authorization: Bearer <CONFIGURED_API_KEY>
```

---

## 3. Webhook Endpoints Reference (نقاط الاتصال)

### 1. `POST /api/hr-sync/receive`
Pushes employee profiles from HR into Housing. Supports filtering options and automatic Casual upgrade.

#### Headers
```http
Content-Type: application/json
x-api-key: sunrise-hr-secret-2026
```

#### Request Body
```json
{
  "propertyId": 1,
  "syncProfiles": true,
  "allowedLevels": ["0", "1", "2"],
  "profiles": [
    {
      "profileId": "EMP-5001",
      "nationalId": "29604101402233",
      "firstName": "محمود",
      "lastName": "فتحي",
      "department": "الأغذية والمشروبات",
      "jobTitle": "مضيف أغذية ومشروبات دائم",
      "level": "2",
      "employmentType": "INTERNAL",
      "companyName": "فندق التاج",
      "status": "ACTIVE",
      "gender": "M",
      "phone": "01044445555",
      "housingEligible": true
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "stats": {
    "received": 1,
    "created": 0,
    "updated": 1,
    "casualUpgrades": 1,
    "departedAutoCheckouts": 0,
    "lookupsAdded": 1,
    "errors": 0
  }
}
```

---

### 2. `POST /api/hr-sync/notify-vacation`
Notifies that an employee has departed on leave or returned from leave.

#### Body (Vacation Start)
```json
{
  "propertyId": 1,
  "profileId": "EMP-5001",
  "type": "START",
  "startDate": "2026-09-25",
  "endDate": "2026-10-05",
  "notes": "إجازة سنوية اعتيادية"
}
```

#### Body (Vacation Return)
```json
{
  "propertyId": 1,
  "profileId": "EMP-5001",
  "type": "RETURN"
}
```

---

### 3. `POST /api/hr-sync/notify-departure`
Notifies of employee resignation, termination, or clearance (تصفية).

#### Body
```json
{
  "propertyId": 1,
  "profileId": "MAR-410",
  "departureDate": "2026-09-22",
  "reason": "إنهاء تعاقد وتصفية مستحقات"
}
```

#### Automatic Actions:
1. Profile marked as `DEPARTED`.
2. Locates active room assignment and bed.
3. Completes checkout, decrements occupancy, and transitions room status to `dirty`.
4. Emits high-priority live broadcast notification to Housing Operations.

---

### 4. `POST /api/hr-sync/test-connection`
Tests latency and parses sample records from any target HR API URL.

#### Body
```json
{
  "apiUrl": "https://hr-system.com/api/employees",
  "apiKey": "optional_token"
}
```

---

### 5. `GET /api/hr-sync/mock-feed`
Built-in sandbox feed returning realistic demo employee records for all 3 hotels (Al-Taj, White Hills, Al-Marafe).

- `GET /api/hr-sync/mock-feed?hotel=al_taj` — Al-Taj Hotel executives & casual worker.
- `GET /api/hr-sync/mock-feed?hotel=al_taj&test_casual_upgrade=true` — Upgraded permanent employee matching the casual worker's National ID!
- `GET /api/hr-sync/mock-feed?hotel=white_hills` — White Hills employees with active vacation.
- `GET /api/hr-sync/mock-feed?hotel=al_marafe` — Al-Marafe employees with departed employee.

---

## 4. Architectural Rules & Compliance
- **Rule 1 (Zero Data Loss):** Idempotent migrations with `ADD COLUMN IF NOT EXISTS`.
- **Rule 2 (Dual-Layer RBAC):** Endpoints guarded with `requireAnyPermission(["hr_sync", "edit"], ["settings", "edit"])`.
- **Rule 5 (Room Lifecycle):** Automatic synchronization between HR status, profile state, and room cleanliness state.
