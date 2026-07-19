'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { exportUserDataAction, deleteBabyProfileAndDataAction, deleteUserAccountAction } from '@/app/profile/actions'
import styles from './DataPrivacyControls.module.css'
import { clearSomniBrowserStorage } from '@/lib/privacy/browser-storage'

type DataPrivacyControlsProps = {
  babyId?: string
}

function useDialogFocusTrap(
  isOpen: boolean,
  isBusy: boolean,
  onClose: () => void,
) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement
    const dialog = dialogRef.current
    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    const focusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])

    focusable()[0]?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0]
      const last = elements.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [isBusy, isOpen, onClose])

  return dialogRef
}

export function DataPrivacyControls({ babyId }: DataPrivacyControlsProps) {
  const router = useRouter()
  const [isExportPending, startExportTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [isDeleteAccountPending, startDeleteAccountTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [confirmName, setConfirmName] = useState('')

  const closeBabyDialog = useCallback(() => {
    setShowDeleteConfirm(false)
    setConfirmName('')
    setError(null)
  }, [])
  const closeAccountDialog = useCallback(() => {
    setShowDeleteAccountConfirm(false)
    setConfirmName('')
    setError(null)
  }, [])
  const babyDialogRef = useDialogFocusTrap(
    showDeleteConfirm,
    isDeletePending,
    closeBabyDialog,
  )
  const accountDialogRef = useDialogFocusTrap(
    showDeleteAccountConfirm,
    isDeleteAccountPending,
    closeAccountDialog,
  )

  async function handleExport() {
    setError(null)
    setSuccess(null)
    startExportTransition(async () => {
      try {
        const res = await exportUserDataAction()
        if (res.error) {
          setError(res.error)
        } else if (res.data) {
          const exportBlob = new Blob([JSON.stringify(res.data, null, 2)], {
            type: 'application/json;charset=utf-8',
          })
          const exportUrl = URL.createObjectURL(exportBlob)
          const downloadAnchor = document.createElement('a')
          downloadAnchor.setAttribute('href', exportUrl)
          downloadAnchor.setAttribute('download', `somni-data-export-${new Date().toISOString().split('T')[0]}.json`)
          document.body.appendChild(downloadAnchor)
          downloadAnchor.click()
          downloadAnchor.remove()
          URL.revokeObjectURL(exportUrl)
          setSuccess('Your complete Somni data export has been compiled and downloaded.')
        }
      } catch {
        setError('Failed to compile your data. Please try again.')
      }
    })
  }

  async function handleDelete() {
    if (!babyId) return
    setError(null)
    setSuccess(null)

    if (confirmName.trim().toLowerCase() !== 'delete') {
      setError('Please type DELETE to confirm.')
      return
    }

    startDeleteTransition(async () => {
      try {
        const res = await deleteBabyProfileAndDataAction(babyId)
        if (res.error) {
          setError(res.error)
        } else {
          setSuccess('Your profile and all associated data have been permanently deleted.')
          setShowDeleteConfirm(false)
          setTimeout(() => {
            router.push('/onboarding')
            router.refresh()
          }, 1500)
        }
      } catch {
        setError('Failed to delete data. Please try again.')
      }
    })
  }

  async function handleDeleteAccount() {
    setError(null)
    setSuccess(null)

    if (confirmName.trim().toLowerCase() !== 'delete account') {
      setError('Please type DELETE ACCOUNT to confirm.')
      return
    }

    startDeleteAccountTransition(async () => {
      try {
        const res = await deleteUserAccountAction(confirmName)
        if (res.error) {
          setError(res.error)
        } else {
          clearSomniBrowserStorage()
          setSuccess('Your account has been permanently deleted.')
          setShowDeleteAccountConfirm(false)
          setTimeout(() => {
            router.push('/')
            router.refresh()
          }, 1500)
        }
      } catch {
        setError('Failed to delete account. Please try again.')
      }
    })
  }

  return (
    <article className={`${styles.section} card`}>
      <h2 className={`${styles.sectionTitle} text-display`}>Data Controls &amp; Privacy</h2>
      <p className={styles.subtitle}>
        Export a copy of your Somni account data, or permanently delete your records.
      </p>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {success && <p className={styles.success} role="status">{success}</p>}

      <div className={styles.actions}>
        <button
          className="btn-secondary"
          onClick={handleExport}
          disabled={isExportPending || isDeletePending || isDeleteAccountPending}
          type="button"
        >
          {isExportPending ? 'Compiling export...' : 'Export My Data (JSON)'}
        </button>

        {babyId && (
          <button
            className={styles.deleteBtn}
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isExportPending || isDeletePending || isDeleteAccountPending}
            type="button"
          >
            Delete Baby Profile
          </button>
        )}
        
        <button
          className={styles.deleteBtn}
          onClick={() => setShowDeleteAccountConfirm(true)}
          disabled={isExportPending || isDeletePending || isDeleteAccountPending}
          type="button"
        >
          Delete Account
        </button>
      </div>

      {showDeleteConfirm && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description">
          <div ref={babyDialogRef} className={`${styles.modalCard} card animate-fade-up`}>
            <h3 id="delete-confirm-title" className={`${styles.modalTitle} text-display`}>
              Are you absolutely sure?
            </h3>
            <p id="delete-confirm-description" className="text-body">
              This action is permanent. All sleep logs, baseline configurations, daily plans,
              and caregiver invitations associated with this profile will be permanently erased.
            </p>
            <p className="text-body">
              Type <strong>DELETE</strong> in the box below to confirm:
            </p>
            <label className="text-body" htmlFor="delete-baby-confirmation">
              Confirmation phrase
            </label>
            <input
              id="delete-baby-confirmation"
              type="text"
              className={styles.confirmInput}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Type DELETE to confirm"
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalDeleteBtn}
                onClick={handleDelete}
                disabled={isDeletePending}
              >
                {isDeletePending ? 'Deleting...' : 'Permanently Delete'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={closeBabyDialog}
                disabled={isDeletePending}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountConfirm && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description">
          <div ref={accountDialogRef} className={`${styles.modalCard} card animate-fade-up`}>
            <h3 id="delete-account-title" className={`${styles.modalTitle} text-display`}>
              Delete Account?
            </h3>
            <p id="delete-account-description" className="text-body">
              This action is permanent. Your active subscription will be cancelled, your
              Stripe customer will be deleted, and your Somni account, profiles, baby data,
              and sleep logs will be erased. Stripe may retain financial records where the
              law requires it.
            </p>
            <p className="text-body">
              Type <strong>DELETE ACCOUNT</strong> below to confirm:
            </p>
            <label className="text-body" htmlFor="delete-account-confirmation">
              Confirmation phrase
            </label>
            <input
              id="delete-account-confirmation"
              type="text"
              className={styles.confirmInput}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Type DELETE ACCOUNT"
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalDeleteBtn}
                onClick={handleDeleteAccount}
                disabled={isDeleteAccountPending}
              >
                {isDeleteAccountPending ? 'Deleting...' : 'Delete Account'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={closeAccountDialog}
                disabled={isDeleteAccountPending}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
