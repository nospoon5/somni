import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/guard'
import { createClient } from '@/lib/supabase/server'
import { getAllSupportTickets } from '@/lib/repositories/support'
import { updateTicketStatusAction } from './actions'
import styles from './page.module.css'

type PageProps = {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminSupportPage(props: PageProps) {
  // 1. Authorize - will redirect non-admins immediately
  await requireAdmin()

  const searchParams = await props.searchParams
  const currentFilter = searchParams.status || 'all'

  const supabase = await createClient()

  // 2. Fetch all tickets for statistics and display
  const { data: allTickets, error: fetchError } = await getAllSupportTickets(supabase)

  if (fetchError) {
    console.error('[admin] failed to fetch tickets', fetchError)
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <h1 className="text-display">Failed to load support tickets</h1>
          <p className="text-body">{fetchError.message}</p>
        </div>
      </main>
    )
  }

  const tickets = allTickets || []

  // 3. Compute counts
  const totalCount = tickets.length
  const openCount = tickets.filter((t) => t.status === 'open').length
  const progressCount = tickets.filter((t) => t.status === 'in_progress').length
  const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length

  // 4. Filter list based on search param
  const filteredTickets = tickets.filter((t) => {
    if (currentFilter === 'all') return true
    if (currentFilter === 'open') return t.status === 'open'
    if (currentFilter === 'in_progress') return t.status === 'in_progress'
    if (currentFilter === 'resolved') return t.status === 'resolved' || t.status === 'closed'
    return true
  })

  // Format date helper
  function formatDate(isoString: string) {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return isoString
    }
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'open':
        return styles.statusOpen
      case 'in_progress':
        return styles.statusInProgress
      case 'resolved':
        return styles.statusResolved
      case 'closed':
        return styles.statusClosed
      default:
        return ''
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <p className="text-label">Internal Operations</p>
            <h1 className={`${styles.title} text-display`}>Support Triage</h1>
          </div>
          <Link className="btn-secondary" href="/dashboard" style={{ width: 'auto' }}>
            Back to Dashboard
          </Link>
        </header>

        {/* Stats Row */}
        <section className={styles.statsRow}>
          <div className={`${styles.statCard} card`}>
            <span className="text-label">Open Issues</span>
            <span className={styles.statNum}>{openCount}</span>
          </div>
          <div className={`${styles.statCard} card`}>
            <span className="text-label">In Progress</span>
            <span className={styles.statNum} style={{ color: 'var(--color-safety)' }}>
              {progressCount}
            </span>
          </div>
          <div className={`${styles.statCard} card`}>
            <span className="text-label">Closed & Resolved</span>
            <span className={styles.statNum} style={{ color: 'var(--color-success)' }}>
              {resolvedCount}
            </span>
          </div>
          <div className={`${styles.statCard} card`}>
            <span className="text-label">Total Tickets</span>
            <span className={styles.statNum} style={{ color: 'var(--color-text-muted)' }}>
              {totalCount}
            </span>
          </div>
        </section>

        {/* Filter Tabs */}
        <nav className={styles.tabs}>
          <Link
            className={`${styles.tabLink} ${currentFilter === 'all' ? styles.activeTab : ''}`}
            href="/admin/support?status=all"
          >
            All
          </Link>
          <Link
            className={`${styles.tabLink} ${currentFilter === 'open' ? styles.activeTab : ''}`}
            href="/admin/support?status=open"
          >
            Open ({openCount})
          </Link>
          <Link
            className={`${styles.tabLink} ${currentFilter === 'in_progress' ? styles.activeTab : ''}`}
            href="/admin/support?status=in_progress"
          >
            In Progress ({progressCount})
          </Link>
          <Link
            className={`${styles.tabLink} ${currentFilter === 'resolved' ? styles.activeTab : ''}`}
            href="/admin/support?status=resolved"
          >
            Resolved ({resolvedCount})
          </Link>
        </nav>

        {/* Tickets list */}
        <section className={styles.ticketList}>
          {filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => (
              <div className={styles.ticketCard} key={ticket.id}>
                {/* Header row */}
                <div className={styles.ticketHeader}>
                  <div className={styles.metaGroup}>
                    <span className={`${styles.badge} ${styles.categoryBadge}`}>
                      {ticket.category}
                    </span>
                    <span className={`${styles.badge} ${getStatusBadgeClass(ticket.status)}`}>
                      {ticket.status === 'closed' ? 'resolved' : ticket.status}
                    </span>
                  </div>
                  <span className={styles.date}>{formatDate(ticket.created_at)}</span>
                </div>

                {/* Message body */}
                <p className={`${styles.message} text-body`}>{ticket.message}</p>

                {/* Footer Controls */}
                <div className={styles.footer}>
                  <span className={styles.metaText}>
                    From: <a href={`mailto:${ticket.email}`}>{ticket.email}</a>
                    {ticket.origin_page ? (
                      <>
                        {' '}• On page: <code>{ticket.origin_page}</code>
                      </>
                    ) : null}
                  </span>

                  {/* Actions buttons */}
                  <div className={styles.controls}>
                    {ticket.status !== 'open' && (
                      <form action={updateTicketStatusAction}>
                        <input type="hidden" name="ticketId" value={ticket.id} />
                        <input type="hidden" name="status" value="open" />
                        <button className="btn-secondary" type="submit">
                          Reopen
                        </button>
                      </form>
                    )}
                    {ticket.status !== 'in_progress' && (
                      <form action={updateTicketStatusAction}>
                        <input type="hidden" name="ticketId" value={ticket.id} />
                        <input type="hidden" name="status" value="in_progress" />
                        <button
                          className="btn-secondary"
                          type="submit"
                          style={{ borderColor: 'var(--color-safety)' }}
                        >
                          In Progress
                        </button>
                      </form>
                    )}
                    {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                      <form action={updateTicketStatusAction}>
                        <input type="hidden" name="ticketId" value={ticket.id} />
                        <input type="hidden" name="status" value="resolved" />
                        <button
                          className="btn-primary"
                          type="submit"
                          style={{ width: 'auto', background: 'var(--color-success)', color: '#0a0c1a' }}
                        >
                          Resolve
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={`${styles.noTickets} card`}>
              <p className="text-body">No support tickets found in this category.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
