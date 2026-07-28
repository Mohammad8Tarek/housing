# HR System Integration — API Documentation

## Overview

The Sunrise Housing system can **push** and **pull** employee data from an external HR system. It also supports **departure notifications** — when an employee leaves or is terminated in the HR system, the housing system can auto-checkout the employee.

Integration is configured per-property via the Settings → HR Sync page.

## Authentication

### Pull (Housing → HR)

Configured in Settings → HR Sync:

- **API URL** — the HR system's employee list endpoint (e.g. `https://hr.company.com/api/employees`)
- **API Key** — sent as `Authorization: Bearer <api_key>` header

### Push (HR → Housing)

External HR system pushes employee data to:

```
POST /api/hr-sync/receive
POST /api/hr-sync/notify-departure
```

**Header:** `x-api-key: <HR_SYNC_API_KEY>`

The API key is compared against the `HR_SYNC_API_KEY` environment variable set on the server. If the env var is not set, the endpoint accepts requests without authentication (not recommended for production).

---

## Endpoints

### `GET /api/hr-sync/employees/:employeeId`

Returns comprehensive employee data including current active assignment, room, and building.

#### Response

```json
{
  "success": true,
  "employee": {
    "id": 1,
    "employeeId": "EMP001",
    "firstName": "Mohamed",
    "lastName": "Ali",
    "nationalId": "1234567890",
    "nationality": "Egyptian",
    "department": "IT",
    "jobTitle": "Software Developer",
    "phone": "0501234567",
    "status": "active",
    "gender": "male",
    "level": "senior",
    "hireDate": "2024-01-15",
    "photoUrl": "...",
    "idImage": "...",
    "createdAt": "2024-01-15T00:00:00.000Z"
  },
  "currentAssignment": {
    "id": 5,
    "bedNumber": 2,
    "checkInDate": "2024-01-15",
    "expectedCheckOutDate": "2024-12-31",
    "checkOutDate": null,
    "notes": "",
    "status": "ACTIVE",
    "roomNumber": "101",
    "roomType": "shared",
    "capacity": 4,
    "buildingName": "Building A"
  }
}
```

`currentAssignment` is `null` if the employee has no active assignment.

---

### `POST /api/hr-sync/receive`

Push employee data from HR to housing system. Creates new employees or updates existing ones by `employeeId`.

#### Request Body

```json
{
  "propertyId": 1,
  "employees": [
    {
      "employeeId": "EMP001",
      "firstName": "Mohamed",
      "lastName": "Ali",
      "nationalId": "1234567890",
      "nationality": "Egyptian",
      "department": "IT",
      "jobTitle": "Software Developer",
      "phone": "0501234567",
      "email": "m.ali@example.com",
      "address": "123 Main St",
      "status": "active",
      "gender": "male",
      "level": "senior",
      "hireDate": "2024-01-15"
    }
  ]
}
```

All fields except `employeeId` are optional. Missing fields preserve existing values on updates.

#### Response

```json
{
  "success": true,
  "stats": {
    "received": 10,
    "created": 8,
    "updated": 2,
    "errors": 0
  }
}
```

---

### `POST /api/hr-sync/notify-departure`

Notify the housing system that an employee has been terminated or has left the organization. The system will:

1. Mark the employee status as `departed`
2. Find any active room assignment
3. Auto-checkout the employee (set assignment to `CHECKED_OUT`, decrement room occupancy)
4. Broadcast live updates to connected clients

#### Request Body

```json
{
  "propertyId": 1,
  "employeeId": "EMP001",
  "departureDate": "2024-06-15",
  "reason": "Resigned"
}
```

- `employeeId` (required) — the employee code in the HR system
- `departureDate` (optional) — date of departure, defaults to today
- `reason` (optional) — reason for termination/leave, appended to assignment notes

#### Response

```json
{
  "success": true,
  "message": "Employee marked as departed and checked out",
  "employee": {
    "id": 1,
    "employeeId": "EMP001",
    "status": "departed"
  },
  "autoCheckout": {
    "assignmentId": 5,
    "checkOutDate": "2024-06-15",
    "roomId": 10
  }
}
```

`autoCheckout` is `null` if the employee had no active assignment at the time.

---

### `POST /api/hr-sync/sync`

Initiated from the Settings → HR Sync → "Sync Now" button. Requires `settings.edit` permission.

Fetches employees from the configured HR API URL, applies field mapping if configured, then processes them identically to the push endpoint.

---

## Field Mapping

The Field Mapping setting (JSON object) maps external HR field names to internal field names. Example:

```json
{
  "firstName": "name_first",
  "lastName": "name_last",
  "employeeId": "emp_code",
  "department": "dept_name",
  "jobTitle": "position"
}
```

Key = internal field name, Value = external field name. If mapping is empty, external field names are used as-is.

---

## Sync Logs

All sync operations (push, pull, and departure) are logged to `public.hr_sync_log`. View recent logs via:

> **GET** `/api/hr-sync/logs?limit=20`

Requires `settings.view` permission.

---

## Configuration Table

Settings are stored in the `public.hr_sync_config` table:

| Column        | Type      | Description                      |
| ------------- | --------- | -------------------------------- |
| property_id   | integer   | FK to properties table           |
| api_url       | text      | HR system API endpoint URL       |
| api_key       | text      | Bearer token for pull auth       |
| field_mapping | jsonb     | Field name mapping (key → value) |
| is_active     | boolean   | Enable/disable sync              |
| last_sync_at  | timestamp | Most recent sync completion      |

## Environment Variables

```
HR_SYNC_API_KEY=your-secret-key-here
```
