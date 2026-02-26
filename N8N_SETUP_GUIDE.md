# 🚀 RMS n8n Automation Setup Guide

This guide explains how to set up the n8n automation layer for the Request Management System (RMS) from absolute scratch.

---

## 1. Prerequisites
- Docker & Docker Compose installed.
- RMS Backend and Frontend running locally.
- A valid SMTP account (Gmail, Outlook, or SMTP service) for reminders.

---

## 2. Docker Infrastructure Setup

### Step 1: Environment Variables
Create or update your `.env` file in the root directory:
```env
# n8n Database Credentials
N8N_DB_PASSWORD=1234
N8N_USER=admin
N8N_PASSWORD=admin

# Internal API Security
INTERNAL_API_KEY=your_secret_key_here
```

### Step 2: Initialize n8n Containers
Run the following commands to ensure a clean database initialization:
```bash
# Stop and remove existing containers/volumes
docker-compose stop n8n n8n_db
docker-compose rm -f -v n8n n8n_db

# Start fresh
docker-compose up -d n8n n8n_db
```
> [!IMPORTANT]
> If you encounter "Authentication failed" in Docker logs, it usually means the Postgres volume is stale. Always remove the volume (`-v`) when resetting.

---

## 3. n8n Authentication Setup

1. Open n8n: [http://localhost:5678](http://localhost:5678)
2. Go to **Credentials** -> **Add Credential**.
3. Select **Header Auth**.
4. Configure as follows:
   - **Name**: `x-api-key`
   - **Value**: (Match your `INTERNAL_API_KEY` from `.env`)

---

## 4. Workflow 1: Due Date Reminders

### Import
Import `due-date-reminder-workflow.json` from the `server/n8n-workflows/` folder.

### Node Configuration
1. **Schedule Trigger**: Set to 8:00 AM daily.
2. **Fetch Pending Reminders** (HTTP Request):
   - **URL**: `http://host.docker.internal:5000/api/v1/internal/pending-reminders`
   - **Authentication**: Select the `x-api-key` credential.
3. **Send Reminder Email** (SMTP):
   - **Subject (Expression Mode)**:
     ```javascript
     {{ $json.daysOverdue > 0 ? '[RMS] OVERDUE: ' + $json.title : '[RMS] Reminder: ' + $json.title }}
     ```
   - **HTML (Expression Mode)**: Paste the provided professional HTML template.

---

## 5. Workflow 2: Report Generation

### Import
Import `report-generation-workflow.json`.

### Node Configuration
1. **Webhook Trigger**:
   - **Path**: `report.requested`
   - **Test URL**: Used for `curl` testing (`/webhook-test/...`).
   - **Production URL**: Automatically active when workflow is "Active".
2. **Fetch Report Data**:
   - **URL (Expression Mode)**: 
     `http://host.docker.internal:5000/api/v1/internal/report-data?reportId={{ $json.data.reportId }}&type={{ $json.data.type }}`
3. **Complete Report**:
   - **Method**: `POST`
   - **URL**: `http://host.docker.internal:5000/api/v1/internal/report-complete`
   - **Body (JSON)**:
     ```json
     {
       "reportId": "{{ $json.reportId }}",
       "result": {{ JSON.stringify($json.result) }}
     }
     ```

---

## 6. Going Live
1. **Test Each Node**: Click "Execute Node" on each step to see green checkmarks.
2. **Activate**: Toggle the **Active** switch (top right) for both workflows.
3. **App Verification**: Trigger a report from the RMS Dashboard UI to see n8n pick it up in "Executions".

---

## 7. Troubleshooting
- **DNS Error?** Use `host.docker.internal` instead of `localhost` inside n8n nodes.
- **Raw Code in Email?** Ensure the `HTML` and `Subject` fields are in **Expression** mode (not Fixed).
- **401 Unauthorized?** Verify the `x-api-key` in n8n matches the `INTERNAL_API_KEY` in the server's `.env`.
