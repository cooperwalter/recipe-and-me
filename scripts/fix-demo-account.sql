-- SQL script to fix demo account in Supabase
-- Run this in your Supabase SQL Editor

-- First, check if the demo user exists
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'demo@recipeandme.app';

-- If the user exists but password needs to be reset:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Find demo@recipeandme.app
-- 3. Click the three dots menu and select "Send password reset"
-- 4. Or use "Update password" to set it directly to: DemoRecipes2024!

-- If the user exists but email is not confirmed, run this:
UPDATE auth.users 
SET email_confirmed_at = now(),
    updated_at = now()
WHERE email = 'demo@recipeandme.app' 
  AND email_confirmed_at IS NULL;

-- If the user doesn't exist at all, you'll need to:
-- 1. Create it through the sign-up flow, OR
-- 2. Use Supabase Dashboard > Authentication > Users > Create User
-- 3. Set email: demo@recipeandme.app
-- 4. Set password: DemoRecipes2024!
-- 5. Check "Auto Confirm Email"

-- After fixing, verify the user can login:
SELECT id, email, email_confirmed_at, last_sign_in_at
FROM auth.users 
WHERE email = 'demo@recipeandme.app';