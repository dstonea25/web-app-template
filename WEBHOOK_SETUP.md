# Webhook Setup Instructions

## Environment Configuration

The allocations tab now uses webhooks instead of stub data. You need to set up the webhook token:

### 1. Create Environment File

Create a `.env` file in the project root with:

```bash
# N8N Webhook Configuration
VITE_N8N_WEBHOOK_TOKEN=your_actual_webhook_token_here
```

### 2. Get Your Webhook Token

You need to get the webhook token from your n8n instance. This should be the same token used for the other tabs (todos, ideas, time).

### 3. Restart Development Server

After setting the environment variable, restart your development server:

```bash
npm run dev
```

## Webhook Endpoints

The allocations tab now uses these webhook endpoints:

- **Get Allotments**: `GET https://geronimo.askdavidstone.com/webhook/allotments`
- **Save Allotments**: `POST https://geronimo.askdavidstone.com/webhook/save-allotments`
- **Get Ledger**: `GET https://geronimo.askdavidstone.com/webhook/allotments-save-ledger`
- **Save Ledger**: `POST https://geronimo.askdavidstone.com/webhook/allotments-save-ledger`

## Error Messages

If you see "Failed to Load Allocations", check:

1. Is `VITE_N8N_WEBHOOK_TOKEN` set in your environment?
2. Is the token correct and valid?
3. Are the webhook endpoints configured in your n8n instance?

The error messages now provide more specific information about what went wrong.
