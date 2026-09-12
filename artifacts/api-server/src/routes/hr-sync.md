# HR System Integration — API Documentation

## Overview

The Sunrise Housing system can **push** and **pull** employee data from an external HR system. It supports:
1. **Full Profile Ingestion:** Importing and updating 25+ fields including Arabic names, national IDs, dates of birth, departments, job titles, contracts, photos, and emergency contacts.
2. **Vacation Automation:** Real-time synchronization of employee vacations, updating profile status to `VACATION`, recording in `profile_vacations`, and transitioning the room to `occupied_vacation` while keeping the bed reserved.
3. **Departure & Clearance Auto-Checkout with Alarms:** Automatic room checkout when an employee leaves or is terminated in HR, transitioning the room to `dirty` for cleaning and broadcasting high-priority alarms to housing staff.

Integration is configured per-property via **Settings → HR Sync**.

---

## Authentication

### Pull (Housing → HR)
Configured in Settings → HR Sync:
- **API URL** — the HR system's employee list endpoint (e.g. `https://hr.company.com/api/employees`)
- **API Key** — sent as `Authorization: Bearer <api_key>` header

### Push (HR → Housing Webhooks)
External HR system pushes data to:
```
POST /api/hr-sync/receive
POST /api/hr-sync/notify-vacation
POST /api/hr-sync/notify-departure
```
**Header:** `x-api-key: <HR_SYNC_API_KEY>`

---

## Webhook Endpoints

### 1. `POST /api/hr-sync/receive`
Pushes complete employee profiles from HR into the housing system. Creates new profiles or updates existing ones by `profileId` / `employeeId`.

#### Request Body
```json
{
  "propertyId": 1,
  "profiles": [
    {
      "profileId": "EMP1001",
      "firstName": "أحمد",
      "lastName": "السيد",
      "thirdName": "محمود",
      "fourthName": "علي",
      "nationalId": "29001011234567",
      "nationality": "Egyptian",
      "dateOfBirth": "1990-01-01",
      "gender": "male",
      "department": "Food & Beverage",
      "jobTitle": "Chef de Partie",
      "level": "Supervisor",
      "hireDate": "2022-03-01",
      "contractEndDate": "2026-12-31",
      "employmentType": "INTERNAL",
      "companyName": "Sunrise",
      "phone": "01012345678",
      "email": "ahmed.ali@sunrise-resorts.com",
      "emergencyContact": "01234567890 (Brother)",
      "address": "Cairo, Egypt",
      "status": "ACTIVE",
      "vacationStartDate": null,
      "vacationEndDate": null,
      "photoUrl": "https://...",
      "idImage": "https://..."
    }
  ]
}
```

#### Status Normalization:
- **Active:** `"ACTIVE"`, `"active"`, `"working"`, `"مباشر"`, `"على رأس العمل"`
- **Vacation:** `"VACATION"`, `"on_leave"`, `"leave"`, `"annual_leave"`, `"إجازة"`, `"اجازة"`
- **Departure:** `"DEPARTED"`, `"terminated"`, `"resigned"`, `"inactive"`, `"left"`, `"تصفية"`, `"مستقيل"`, `"مفصول"`

#### Response
```json
{
  "success": true,
  "stats": {
    "received": 1,
    "created": 0,
    "updated": 1,
    "departedAutoCheckouts": 0,
    "errors": 0
  }
}
```

---

### 2. `POST /api/hr-sync/notify-vacation`
Notifies the housing system that an employee has started or returned from vacation.

#### Request Body (Vacation Start)
```json
{
  "propertyId": 1,
  "profileId": "EMP1001",
  "type": "START",
  "startDate": "2026-09-15",
  "endDate": "2026-09-30",
  "notes": "Annual vacation"
}
```

#### Request Body (Vacation Return)
```json
{
  "propertyId": 1,
  "profileId": "EMP1001",
  "type": "RETURN"
}
```

#### Actions Triggered:
- **START:** Sets profile status to `VACATION`, creates record in `profile_vacations`, updates room to `occupied_vacation` if all occupants are on vacation, and preserves bed reservation.
- **RETURN:** Restores profile status to `ACTIVE`, marks vacation as completed, restores room status to `occupied`, and broadcasts live WebSocket event.

#### Response
```json
{
  "success": true,
  "message": "Employee vacation recorded successfully",
  "profile": {
    "profileId": "EMP1001",
    "status": "VACATION",
    "vacationStartDate": "2026-09-15",
    "vacationEndDate": "2026-09-30"
  }
}
```

---

### 3. `POST /api/hr-sync/notify-departure`
Notifies that an employee has left, resigned, or had final clearance (تصفية).

#### Request Body
```json
{
  "propertyId": 1,
  "profileId": "EMP1001",
  "departureDate": "2026-09-12",
  "reason": "Final clearance / Resignation"
}
```

#### Actions Triggered:
1. Marks profile status as `DEPARTED`.
2. Locates active room assignment.
3. Automatically completes checkout (`CHECKED_OUT`), records checkout date and reason.
4. Decrements room occupancy and transitions room status to **`dirty`** (or `occupied_dirty` if roommates remain) per architectural Rule 5.
5. Emits **High-Priority Alarm Alert** via WebSocket and records in notification bell and activity logs.

#### Response
```json
{
  "success": true,
  "message": "Profile marked as departed and automatically checked out from Room 204",
  "profile": {
    "profileId": "EMP1001",
    "status": "DEPARTED"
  },
  "autoCheckout": {
    "assignmentId": 42,
    "roomId": 15,
    "roomNumber": "204",
    "bedNumber": 1,
    "checkOutDate": "2026-09-12"
  }
}
```

---

### 4. `GET /api/hr-sync/profiles/:profileId`
Returns complete profile and current room assignment data for the HR system.

---

### 5. `POST /api/hr-sync/sync`
Triggered via UI "Sync Now" button or scheduled cron. Pulls from the configured `api_url`, applies field mapping, and runs the batch ingestion process.
