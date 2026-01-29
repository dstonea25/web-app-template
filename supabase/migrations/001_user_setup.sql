-- =============================================================================
-- USER SETUP MIGRATION
-- =============================================================================
-- Run this in your Supabase SQL Editor to set up user-scoped tables with RLS.
-- This creates the foundation for per-user data.

-- 1. USER SETTINGS TABLE (optional - stores app preferences per user)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  notifications BOOLEAN DEFAULT true,
  compact_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own settings
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);


-- 2. EXAMPLE: USER-SCOPED DATA TABLE TEMPLATE
-- =============================================================================
-- Copy this pattern for any table that should be per-user:
--
-- CREATE TABLE IF NOT EXISTS your_table (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   -- your columns here --
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   updated_at TIMESTAMPTZ DEFAULT NOW()
-- );
--
-- ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Users can view own data" ON your_table
--   FOR SELECT USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can insert own data" ON your_table
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "Users can update own data" ON your_table
--   FOR UPDATE USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can delete own data" ON your_table
--   FOR DELETE USING (auth.uid() = user_id);


-- 3. AUTO-UPDATE TIMESTAMP TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to user_settings
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- CREATING YOUR FIRST USER
-- =============================================================================
-- Option 1: Use Supabase Dashboard
--   Go to Authentication > Users > Add User
--   Enter email and password
--
-- Option 2: Use SQL (less secure, password visible in logs)
--   INSERT INTO auth.users (
--     email,
--     encrypted_password,
--     email_confirmed_at,
--     raw_user_meta_data
--   ) VALUES (
--     'your@email.com',
--     crypt('your-password', gen_salt('bf')),
--     NOW(),
--     '{"display_name": "Your Name"}'::jsonb
--   );
--
-- Option 3: Sign up via the app (if you add a sign-up flow)
--
-- =============================================================================
