'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/guard'
import { createClient } from '@/lib/supabase/server'
import { updateSupportTicketStatus } from '@/lib/repositories/support'

export type ActionState = {
  error?: string
  success?: string
}

export async function updateTicketStatusAction(
  formData: FormData
): Promise<void> {
  try {
    // 1. Authorize the user is an admin
    await requireAdmin()
    
    const ticketId = formData.get('ticketId') as string
    const newStatus = formData.get('status') as string
    
    if (!ticketId || !newStatus) {
      throw new Error('Missing parameters.')
    }
    
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed']
    if (!validStatuses.includes(newStatus)) {
      throw new Error('Invalid status value.')
    }
    
    const supabase = await createClient()
    const { error } = await updateSupportTicketStatus(supabase, ticketId, newStatus)
      
    if (error) {
      console.error('[admin] failed to update ticket status', error)
      throw new Error('Failed to update status in database.')
    }
    
    revalidatePath('/admin/support')
  } catch (err) {
    console.error('[admin] action error', err)
    throw err
  }
}
