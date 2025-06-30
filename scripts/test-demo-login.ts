#!/usr/bin/env tsx
// Simple script to test demo login
// Run with: pnpm tsx scripts/test-demo-login.ts

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const DEMO_EMAIL = 'demo@recipeandme.app'
const DEMO_PASSWORD = 'DemoRecipes2024!'

async function testDemoLogin() {
  console.log('🧪 Testing demo account login...\n')
  console.log('📧 Email:', DEMO_EMAIL)
  console.log('🔑 Password:', DEMO_PASSWORD)
  console.log('\n')

  try {
    // Try to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD
    })
    
    if (error) {
      console.error('❌ Login failed:', error.message)
      
      if (error.message.includes('Invalid login credentials')) {
        console.log('\n📝 Possible solutions:')
        console.log('1. The password might be different. Check with your team.')
        console.log('2. The account might not exist. Try signing up first.')
        console.log('3. Use the Supabase dashboard to reset the password.')
      } else if (error.message.includes('Email not confirmed')) {
        console.log('\n📝 Email needs confirmation:')
        console.log('1. Check your email for confirmation link')
        console.log('2. Or run the SQL script in scripts/fix-demo-account.sql')
        console.log('3. Or disable email confirmation in Supabase settings (dev only)')
      }
      
      return
    }
    
    console.log('✅ Login successful!')
    console.log('\nUser details:')
    console.log('- User ID:', data.user?.id)
    console.log('- Email:', data.user?.email)
    console.log('- Confirmed:', data.user?.email_confirmed_at ? 'Yes' : 'No')
    console.log('\n✨ Demo account is working correctly!')
    
    // Sign out
    await supabase.auth.signOut()
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Try to create account first (in case it doesn't exist)
async function tryCreateAccount() {
  console.log('📝 Attempting to create demo account (will fail if it exists)...\n')
  
  const { data, error } = await supabase.auth.signUp({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    options: {
      data: {
        name: 'Demo User'
      }
    }
  })
  
  if (error) {
    console.log('ℹ️  Sign up failed (expected if account exists):', error.message)
  } else if (data.user) {
    console.log('✅ Account created! Check your email for confirmation.')
    console.log('   Or use Supabase dashboard to manually confirm.')
  }
  
  console.log('\n' + '='.repeat(50) + '\n')
}

// Run both functions
async function main() {
  await tryCreateAccount()
  await testDemoLogin()
}

main().catch(console.error)