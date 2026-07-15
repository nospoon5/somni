import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type AdminSession = {
  userId: string
}

/**
 * Verifies the current request against Supabase Auth and the profiles table.
 * Call this again inside every admin Server Action or Route Handler; a layout
 * guard alone must not authorize a mutation.
 */
export const requireAdmin = cache(async (): Promise<AdminSession> => {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/dashboard')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || profile?.is_admin !== true) {
    redirect('/dashboard')
  }

  return { userId: user.id }
})

