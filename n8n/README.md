# n8n Workflow Templates for RMS

Workflow templates for the Request Management System (RMS) that handle email notification dispatch and scheduled reminder checks. These workflows run in n8n and integrate with the Express backend via webhook events and internal API callbacks.

## Prerequisites

Before importing these workflows, ensure:

1. **n8n is running** -- via `docker compose up n8n` or the full stack
2. **SMTP credentials configured in n8n** -- Go to n8n UI > Settings > Credentials > Add "SMTP Account" with your email provider settings
3. **INTERNAL_API_KEY set** -- The same key used in the Express `.env` file must be configured as an n8n environment variable
4. **N8N_WEBHOOK_SECRET set** -- Must match the value in the Express `.env` file for webhook authentication

## Importing Workflows

### Email Notification Workflow

1. Open the n8n UI at `http://localhost:5678`
2. Go to **Workflows** in the left sidebar
3. Click **Add Workflow** (top right)
4. Click the **...** menu (top right) > **Import from File**
5. Select `n8n/workflows/email-notification.json`
6. In the imported workflow, click each **Email Send** node and select your configured SMTP credentials
7. Verify the webhook path is `/webhook/rms-events`
8. Click **Save** then **Activate** (toggle in top right) when ready

### Scheduled Reminder Workflow

1. Follow steps 1-5 above, selecting `n8n/workflows/scheduled-reminder.json`
2. Click the **Send Reminder Email** node and select your configured SMTP credentials
3. Optionally adjust the schedule in the **Schedule Trigger** node (default: daily at 09:00 UTC)
4. Click **Save** then **Activate** when ready

## Environment Variables

These environment variables must be configured in both Express and n8n:

| Variable | Where | Description |
|----------|-------|-------------|
| `N8N_WEBHOOK_BASE_URL` | Express `.env` | Base URL for n8n webhook endpoints (e.g., `http://n8n:5678/webhook`). The outbox processor appends the webhook path. |
| `N8N_WEBHOOK_SECRET` | Express `.env` | Shared secret sent as `x-webhook-secret` header with outbox dispatches. The webhook trigger validates this. |
| `INTERNAL_API_KEY` | Express `.env` + n8n env | Shared secret for n8n to authenticate with the Express internal API (`x-api-key` header). |
| `SMTP_FROM_EMAIL` | n8n env (optional) | Sender email address for outgoing emails. Defaults to `noreply@rms.local`. |
| `CLIENT_URL` | n8n env (optional) | Base URL for the client app, used in email "View Request" links. Defaults to `http://localhost`. |

### Setting n8n Environment Variables

In `docker-compose.yml`, add environment variables to the n8n service:

```yaml
n8n:
  environment:
    # ... existing vars ...
    INTERNAL_API_KEY: ${INTERNAL_API_KEY}
    SMTP_FROM_EMAIL: noreply@yourdomain.com
    CLIENT_URL: http://localhost
```

Or set them in the n8n UI: Settings > Variables.

## Workflow Descriptions

### Email Notification Dispatch (`email-notification.json`)

Receives webhook events from the Express outbox processor and dispatches email notifications for key events:

- **Status Changed** -- Notifies the assignee (or creator) when a request status changes
- **Assignment** -- Notifies the assignee when they are assigned to a request
- **Comment Added** -- Notifies the assignee (or creator) when a new comment is added

After sending each email, the workflow calls back to the Express internal API (`POST /api/v1/internal/notifications`) to create a corresponding in-app notification, so the user sees both an email and a bell notification.

**Flow:** Webhook Trigger -> Switch (by event type) -> Send Email -> Create In-App Notification -> Respond to Webhook

### Scheduled Reminder Check (`scheduled-reminder.json`)

Runs daily (default: 09:00 UTC) to check for stale requests and send reminder emails:

1. Calls `GET /api/v1/internal/pending-reminders` to fetch requests stuck in `submitted` or `in_review` status for 48+ hours
2. If there are stale requests, splits them into individual items
3. Sends a reminder email to each request's assignee (or creator if unassigned)
4. Creates an in-app "reminder" notification for each via the internal API

**Flow:** Schedule Trigger -> Fetch Pending Reminders -> Check Count -> Split -> Send Email -> Create Notification

## Customization

### Modifying Email Templates

Each Email Send node contains an HTML template in its `html` parameter. To customize:

1. Open the workflow in the n8n editor
2. Click the Email Send node you want to modify
3. Edit the HTML template in the "HTML" field
4. Available template variables: `{{ $json.data.* }}`, `{{ $json.performedBy.name }}`, `{{ $json.requestId }}`, `{{ $json.programId }}`, `{{ $json.timestamp }}`

### Changing the Reminder Schedule

1. Open the Scheduled Reminder workflow
2. Click the **Schedule Trigger** node
3. Modify the cron expression (default: `0 9 * * *` = daily at 09:00 UTC)
4. Common alternatives:
   - `0 9,17 * * 1-5` -- Twice daily on weekdays (9am and 5pm UTC)
   - `0 */6 * * *` -- Every 6 hours
   - `0 9 * * 1` -- Weekly on Mondays at 9am UTC

### Adding New Event Types

To handle additional webhook events (e.g., `attachment.uploaded`):

1. Open the Email Notification workflow
2. Click the **Route by Event Type** (Switch) node
3. Add a new rule matching the event type string
4. Connect a new Email Send node to the new output
5. Connect a new HTTP Request node after the email to create an in-app notification
6. Connect the HTTP Request node to the **Respond to Webhook** node
