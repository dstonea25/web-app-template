# Authentication Setup

This dashboard uses **Supabase Authentication** for secure user login.

## How It Works

Authentication is handled by Supabase Auth:
- User credentials are stored securely in Supabase
- Login creates a JWT session token
- Row Level Security (RLS) protects all database tables
- Only authenticated users can access data

## Environment Variables

The following Supabase environment variables are required:

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key

### .env File Example

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Managing Users

### Creating a New User

Users are created in the Supabase Dashboard:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication** → **Users**
3. Click **Add User** → **Create new user**
4. Enter email and password
5. The user can now log in to the dashboard

### Resetting a Password

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Find the user and click the three-dot menu
3. Select **Send password recovery**

Or use the Supabase client:
```javascript
await supabase.auth.resetPasswordForEmail('user@example.com')
```

## Security Features

- ✅ **Supabase Auth** - Industry-standard authentication
- ✅ **Row Level Security (RLS)** - Database-level protection
- ✅ **JWT tokens** - Secure session management
- ✅ **Session persistence** - Stays logged in across browser sessions
- ✅ **Auto token refresh** - Sessions don't expire unexpectedly

## Row Level Security

All tables have RLS enabled with policies that only allow authenticated users:

```sql
-- Example policy on all tables
CREATE POLICY "authenticated_all" ON public.your_table
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

This means:
- Anonymous users (not logged in) cannot access any data
- Authenticated users have full access to all data
- Backend services using the Service Role key bypass RLS

## Development

For local development:

1. Ensure your `.env` file has the Supabase credentials
2. Run `npm run dev`
3. Log in with your Supabase user credentials

## Troubleshooting

### "Invalid login credentials"
- Verify the email/password in Supabase Dashboard
- Check that the user's email is confirmed

### "Database error querying schema"
- This usually means the user record is incomplete
- Try creating a fresh user in the Supabase Dashboard

### Data not loading after login
- Check that RLS policies exist on your tables
- Verify the user has the `authenticated` role
