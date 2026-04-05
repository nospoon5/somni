'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import type { AuthActionState } from '@/app/auth-actions'
import styles from './AuthForm.module.css'

type AuthFormProps = {
  action: (
    state: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>
  title: string
  subtitle: string
  submitLabel: string
  mode: 'login' | 'signup'
}

const initialState: AuthActionState = {}

export function AuthForm({
  action,
  title,
  subtitle,
  submitLabel,
  mode,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form className={`${styles.form} card`} action={formAction}>
      <div className={styles.header}>
        <Image
          src="/somni_logo.png"
          alt="Somni"
          width={120}
          height={32}
          className={styles.logo}
          priority
        />
        <h1 className={`${styles.title} text-display`}>{title}</h1>
        <p className={`${styles.subtitle} text-body`}>{subtitle}</p>
      </div>

      <div className={styles.fields}>
        {mode === 'signup' ? (
          <label className={styles.field}>
            <span>Full name</span>
            <input
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              required
            />
          </label>
        ) : null}

        <label className={styles.field}>
          <span>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
            required
          />
        </label>
      </div>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.success ? <p className={styles.success}>{state.success}</p> : null}

      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? 'Just a moment...' : submitLabel}
      </button>
    </form>
  )
}