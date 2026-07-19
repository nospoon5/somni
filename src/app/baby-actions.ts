'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isBabyId, setActiveBabyId } from '@/lib/babies/active-baby'
import { createClient } from '@/lib/supabase/server'

const SAFE_RETURN_PATHS = new Set(['/dashboard', '/sleep', '/chat', '/profile'])

export async function selectActiveBabyAction(formData: FormData) {
  const babyId = formData.get('babyId')
  const requestedReturnPath = formData.get('returnTo')
  const returnTo =
    typeof requestedReturnPath === 'string' && SAFE_RETURN_PATHS.has(requestedReturnPath)
      ? requestedReturnPath
      : '/dashboard'

  if (!isBabyId(babyId)) {
    throw new Error('Invalid baby selection')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: baby, error } = await supabase
    .from('babies')
    .select('id')
    .eq('id', babyId)
    .maybeSingle()
  if (error || !baby) {
    throw new Error('You do not have access to that baby')
  }

  await setActiveBabyId(baby.id)
  revalidatePath('/dashboard')
  revalidatePath('/sleep')
  revalidatePath('/chat')
  revalidatePath('/profile')
  redirect(returnTo)
}
