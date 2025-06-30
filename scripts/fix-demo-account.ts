#!/usr/bin/env tsx
// Script to fix/create demo account
// Run with: pnpm tsx scripts/fix-demo-account.ts

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const DEMO_EMAIL = 'demo@recipeandme.app'
const DEMO_PASSWORD = 'DemoRecipes2024!'

async function fixDemoAccount() {
  console.log('🔧 Fixing demo account...\n')

  try {
    // First, check if user exists
    const { data: existingUser } = await supabase.auth.admin.getUserByEmail(DEMO_EMAIL)
    
    if (existingUser?.user) {
      console.log('✅ Demo user exists')
      console.log(`User ID: ${existingUser.user.id}`)
      
      // Update password
      console.log('\n🔑 Updating password...')
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.user.id,
        { password: DEMO_PASSWORD }
      )
      
      if (updateError) {
        console.error('❌ Failed to update password:', updateError.message)
      } else {
        console.log('✅ Password updated successfully')
      }
      
      // Ensure email is confirmed
      if (!existingUser.user.email_confirmed_at) {
        console.log('\n📧 Confirming email...')
        const { error: confirmError } = await supabase.auth.admin.updateUserById(
          existingUser.user.id,
          { email_confirmed_at: new Date().toISOString() }
        )
        
        if (confirmError) {
          console.error('❌ Failed to confirm email:', confirmError.message)
        } else {
          console.log('✅ Email confirmed')
        }
      } else {
        console.log('✅ Email already confirmed')
      }
    } else {
      // Create new user
      console.log('📝 Creating new demo user...')
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: 'Demo User'
        }
      })
      
      if (createError) {
        console.error('❌ Failed to create user:', createError.message)
        return
      }
      
      console.log('✅ Demo user created successfully')
      console.log(`User ID: ${newUser.user?.id}`)
    }
    
    // Test login
    console.log('\n🧪 Testing login...')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD
    })
    
    if (signInError) {
      console.error('❌ Login test failed:', signInError.message)
    } else {
      console.log('✅ Login test successful!')
    }
    
    console.log('\n✨ Demo account is ready!')
    console.log('📧 Email:', DEMO_EMAIL)
    console.log('🔑 Password:', DEMO_PASSWORD)
    console.log('\nYou can now login at http://localhost:3000/auth/login')
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
fixDemoAccount().catch(console.error)