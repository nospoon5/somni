'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sanitizeInviteRedirect } from '@/lib/auth/redirect'

export type AuthActionState = {
  error?: string
  success?: string
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getString(formData, 'email')
  const password = getString(formData, 'password')
  const redirectTo = sanitizeInviteRedirect(getString(formData, 'redirectTo'))

  if (!email || !password) {
    return { error: 'Please enter both your email and password.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return { error: 'We could not sign you in with those details.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', data.user.id)
    .maybeSingle()

  if (redirectTo) {
    redirect(redirectTo)
  }

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  redirect('/dashboard')
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = getString(formData, 'fullName')
  const email = getString(formData, 'email')
  const password = getString(formData, 'password')
  const redirectTo = sanitizeInviteRedirect(getString(formData, 'redirectTo'))

  if (!fullName || !email || !password) {
    return { error: 'Please complete every field before continuing.' }
  }

  if (password.length < 8) {
    return { error: 'Use a password with at least 8 characters.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: redirectTo
        ? `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${redirectTo}`
        : undefined,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.session) {
    return {
      success:
        'Your account has been created. Check your email if confirmation is required before signing in.',
    }
  }

  redirect(redirectTo ?? '/onboarding')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
