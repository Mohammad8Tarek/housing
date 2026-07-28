# Sunrise Housing - HR Sync Interface

A standalone Windows application (`.exe`) that synchronizes employee data from your HR system into the Sunrise Housing management platform.

## Features

- **3 adapter modes:** REST API, SQL Server, CSV/Excel file
- **Scheduled sync:** Runs automatically every N minutes
- **Batch processing:** Sends employees in batches to avoid overloading
- **Dry run mode:** Test without sending data to Housing
- **Folder watching:** Automatically detects new CSV/Excel exports
- **Webhook notifications:** Get alerts on Teams/Slack on sync completion
- **Detailed logging:** File + console logging with configurable levels

---

## Quick Start

### 1. Copy and configure

```bash
copy config.example.json config.json
```

Open `config.json` and fill in:

- `housing_api.url` → URL of your Sunrise Housing server (e.g. `http://192.168.1.10:4000`)
- `housing_api.api_key` → Your Housing API key (from Housing Settings → Integrations)
- `housing_api.property_id` → Your property ID
- `sync.mode` → Choose: `rest_api`, `sql_server`, or `csv_excel`
- Fill in the relevant section based on your mode

### 2. Test connection

```bash
HRSyncInterface.exe --test
```

This will connect to your HR system and show a sample employee record **without** sending anything to Housing.

### 3. Run once (manual sync)

```bash
HRSyncInterface.exe --once
```

### 4. Run as scheduled service

```bash
HRSyncInterface.exe
```

This starts the scheduler (runs every `interval_minutes` as configured).

---

## Running as a Windows Service

To run it silently in the background, use **NSSM (Non-Sucking Service Manager)**:

```bash
nssm install HRSyncInterface "C:\Path\To\HRSyncInterface.exe"
nssm set HRSyncInterface AppDirectory "C:\Path\To\"
nssm start HRSyncInterface
```

Or use **Task Scheduler** to run it at startup.

---

## Build from Source

```bash
npm install
npm run dev          # Run in dev mode
npm run pkg:win      # Build HRSyncInterface.exe
```

---

## Field Mapping

In your `config.json`, the `field_map` section maps Housing field names → your HR system's field names.

**Housing fields (left side):**
| Field | Description |
|---|---|
| `employeeId` | Unique employee ID **(required)** |
| `firstName` | First name **(required)** |
| `lastName` | Last name **(required)** |
| `email` | Email address |
| `phone` | Phone/mobile number |
| `department` | Department name |
| `jobTitle` | Job title |
| `nationality` | Nationality |
| `nationalId` | National ID number |
| `gender` | `male` or `female` |
| `status` | `active` or `inactive` |
| `hireDate` | Hire date (ISO format) |

---

## Troubleshooting

- **`config.json not found`** → Make sure `config.json` is in the same folder as the `.exe`
- **`Housing API error: 401`** → Check your `api_key` in config
- **`Housing API error: 404`** → Check your `url` — should point to the Housing server
- **SQL Server connection failed** → Check firewall, credentials, and `trust_server_certificate: true`
- **CSV: columns not matching** → Check `field_map` — the right side must match your actual column headers
