'use client'

import { useActionState } from 'react'
import { inviteCaregiverAction, revokeCaregiverAction, rotateInviteTokenAction } from '@/app/profile/actions'
import styles from './CaregiverSettings.module.css'

export type BabyShare = {
  id: string
  email: string
  access_role: 'caregiver'
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
  const [rotateState, rotateFormAction, rotatePending] = useActionState(
    rotateInviteTokenAction,
    {}
  )

  const pendingShares = shares.filter((share) => share.status === 'pending')
  const acceptedShares = shares.filter((share) => share.status === 'accepted')

  function handleCopyInviteLink(linkPath: string) {
    const inviteUrl = `${appUrl}${linkPath}`
    navigator.clipboard.writeText(inviteUrl)
    alert('Invitation link copied! Send this link to your caregiver so they can accept. This link will not be shown again.')
  }

  return (
    <section className={`${styles.section} card`}>
      <h2 className={`${styles.sectionTitle} text-display`}>Caregivers ({babyName})</h2>
      <p className="text-body">
        Add co-parents or nannies so they can view and update sleep plans, daily scorecards, and logs in real-time.
        Note: The creator of the baby profile is the permanent owner. Ownership transfer is not currently supported.
      </p>

      {acceptedShares.length > 0 ? (
        <div className={styles.shareList}>
          <p className={`${styles.listHeader} text-label`}>Active Caregivers</p>
          {acceptedShares.map((share) => (
            <div className={styles.shareItem} key={share.id}>
              <div className={styles.shareMeta}>
                <strong>{share.fullName || 'Caregiver'}</strong>
                <span className="text-body">{share.email}</span>
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
                <form action={rotateFormAction}>
                  <input type="hidden" name="babyId" value={babyId} />
                  <input type="hidden" name="shareId" value={share.id} />
                  <button
                    className="btn-secondary"
                    type="submit"
                    disabled={rotatePending}
                  >
                    Generate new link
                  </button>
                </form>
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
          </div>

          <button className="btn-primary" type="submit" disabled={invitePending}>
            {invitePending ? 'Sending invite...' : 'Send invitation'}
          </button>
        </form>

        {inviteState.error ? <p className={styles.error}>{inviteState.error}</p> : null}
        {inviteState.success && !inviteState.inviteLink ? <p className={styles.success}>{inviteState.success}</p> : null}
        {inviteState.inviteLink ? (
          <div className={styles.success} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p><strong>Invitation link generated:</strong></p>
            <p className="text-body" style={{ wordBreak: 'break-all', padding: '8px', background: 'var(--color-surface-sunken)', borderRadius: '4px' }}>{appUrl}{inviteState.inviteLink}</p>
            <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => handleCopyInviteLink(inviteState.inviteLink!)}>Copy Link</button>
            <p className="text-body" style={{ fontSize: '0.875rem' }}>Make sure to copy this now, it won&apos;t be shown again.</p>
          </div>
        ) : null}

        {rotateState.error ? <p className={styles.error}>{rotateState.error}</p> : null}
        {rotateState.success && !rotateState.inviteLink ? <p className={styles.success}>{rotateState.success}</p> : null}
        {rotateState.inviteLink ? (
          <div className={styles.success} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p><strong>New invitation link generated:</strong></p>
            <p className="text-body" style={{ wordBreak: 'break-all', padding: '8px', background: 'var(--color-surface-sunken)', borderRadius: '4px' }}>{appUrl}{rotateState.inviteLink}</p>
            <button type="button" className="btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => handleCopyInviteLink(rotateState.inviteLink!)}>Copy Link</button>
            <p className="text-body" style={{ fontSize: '0.875rem' }}>Make sure to copy this now, it won&apos;t be shown again.</p>
          </div>
        ) : null}

        {revokeState.error ? <p className={styles.error}>{revokeState.error}</p> : null}
        {revokeState.success ? <p className={styles.success}>{revokeState.success}</p> : null}
      </div>
    </section>
  )
}
