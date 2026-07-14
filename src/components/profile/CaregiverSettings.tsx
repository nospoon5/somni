'use client'

import { useActionState } from 'react'
import { inviteCaregiverAction, revokeCaregiverAction } from '@/app/profile/actions'
import styles from './CaregiverSettings.module.css'

export type BabyShare = {
  id: string
  email: string
  access_role: 'admin' | 'caregiver'
  status: 'pending' | 'accepted'
  profile_id: string | null
  fullName?: string | null
}

type CaregiverSettingsProps = {
  babyId: string
  babyName: string
  shares: BabyShare[]
  appUrl: string
}

export function CaregiverSettings({
  babyId,
  babyName,
  shares,
  appUrl,
}: CaregiverSettingsProps) {
  const [inviteState, inviteFormAction, invitePending] = useActionState(
    inviteCaregiverAction,
    {}
  )
  const [revokeState, revokeFormAction, revokePending] = useActionState(
    revokeCaregiverAction,
    {}
  )

  const pendingShares = shares.filter((share) => share.status === 'pending')
  const acceptedShares = shares.filter((share) => share.status === 'accepted')

  function handleCopyInviteLink(shareId: string) {
    const inviteUrl = `${appUrl}/invite/accept?id=${shareId}`
    navigator.clipboard.writeText(inviteUrl)
    alert('Invitation link copied! Send this link to your caregiver so they can accept.')
  }

  return (
    <section className={`${styles.section} card`}>
      <h2 className={`${styles.sectionTitle} text-display`}>Caregivers ({babyName})</h2>
      <p className="text-body">
        Add co-parents or nannies so they can view and update sleep plans, daily scorecards, and logs in real-time.
      </p>

      {acceptedShares.length > 0 ? (
        <div className={styles.shareList}>
          <p className={`${styles.listHeader} text-label`}>Active Caregivers</p>
          {acceptedShares.map((share) => (
            <div className={styles.shareItem} key={share.id}>
              <div className={styles.shareMeta}>
                <strong>{share.fullName || 'Caregiver'}</strong>
                <span className="text-body">{share.email}</span>
                <span className={styles.roleBadge}>{share.access_role}</span>
              </div>
              <form action={revokeFormAction}>
                <input type="hidden" name="babyId" value={babyId} />
                <input type="hidden" name="shareId" value={share.id} />
                <button
                  className={`${styles.revokeBtn} btn-secondary`}
                  type="submit"
                  disabled={revokePending}
                >
                  Remove access
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      {pendingShares.length > 0 ? (
        <div className={styles.shareList}>
          <p className={`${styles.listHeader} text-label`}>Pending Invitations</p>
          {pendingShares.map((share) => (
            <div className={styles.shareItem} key={share.id}>
              <div className={styles.shareMeta}>
                <strong>{share.email}</strong>
                <span className={styles.pendingBadge}>Waiting for accept</span>
              </div>
              <div className={styles.inviteActions}>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => handleCopyInviteLink(share.id)}
                >
                  Copy invite link
                </button>
                <form action={revokeFormAction}>
                  <input type="hidden" name="babyId" value={babyId} />
                  <input type="hidden" name="shareId" value={share.id} />
                  <button
                    className={styles.revokeBtn}
                    type="submit"
                    disabled={revokePending}
                  >
                    Revoke
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.inviteFormBlock}>
        <p className={`${styles.listHeader} text-label`}>Invite Caregiver</p>
        <form className={styles.inviteForm} action={inviteFormAction}>
          <input type="hidden" name="babyId" value={babyId} />
          
          <div className={styles.inputGroup}>
            <input
              type="email"
              name="email"
              placeholder="caregiver@email.com"
              required
              disabled={invitePending}
            />
            <select name="accessRole" defaultValue="caregiver" disabled={invitePending}>
              <option value="caregiver">Caregiver (Editor)</option>
              <option value="admin">Admin (Full access)</option>
            </select>
          </div>

          <button className="btn-primary" type="submit" disabled={invitePending}>
            {invitePending ? 'Sending invite...' : 'Send invitation'}
          </button>
        </form>

        {inviteState.error ? <p className={styles.error}>{inviteState.error}</p> : null}
        {inviteState.success ? <p className={styles.success}>{inviteState.success}</p> : null}
        {revokeState.error ? <p className={styles.error}>{revokeState.error}</p> : null}
        {revokeState.success ? <p className={styles.success}>{revokeState.success}</p> : null}
      </div>
    </section>
  )
}
