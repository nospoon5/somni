'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function markAllNotificationsReadAction(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Please sign in again to update notifications.' }

  const { error } = await supabase
    .from('notification_logs')
    .update({ is_read: true })
    .eq('profile_id', user.id)
    .eq('is_read', false)

  if (error) {
    console.error('[dashboard] failed to mark notifications as read', error)
    return { error: 'Could not mark notifications as read. Please try again.' }
  }

  revalidatePath('/dashboard')
  return {}
}
