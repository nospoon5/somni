import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export type SupportTicketRow = Database['public']['Tables']['support_tickets']['Row']
export type SupportTicketInsert = Database['public']['Tables']['support_tickets']['Insert']
export type SupportTicketUpdate = Database['public']['Tables']['support_tickets']['Update']

export async function createSupportTicket(
  supabase: SupabaseClient,
  ticket: SupportTicketInsert
) {
  return await supabase.from('support_tickets').insert(ticket)
}

export async function getAllSupportTickets(
  supabase: SupabaseClient
): Promise<{ data: SupportTicketRow[] | null; error: any }> {
  return await supabase
    .from('support_tickets')
    .select('id, profile_id, email, category, message, origin_page, status, created_at')
    .order('created_at', { ascending: false })
}

export async function getOpenSupportTickets(
  supabase: SupabaseClient
) {
  return await supabase
    .from('support_tickets')
    .select('id, profile_id, category, message, status, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
}

export async function updateSupportTicketStatus(
  supabase: SupabaseClient,
  ticketId: string,
  status: string
) {
  return await supabase
    .from('support_tickets')
    .update({ status })
    .eq('id', ticketId)
}

export async function getRecentTicketCount(
  supabase: SupabaseClient,
  profileId: string,
  hours: number
) {
  const timestamp = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  return await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .gte('created_at', timestamp)
}
