import { selectActiveBabyAction } from '@/app/baby-actions'
import styles from './BabySwitcher.module.css'

type BabyOption = {
  id: string
  name: string
}

type BabySwitcherProps = {
  babies: BabyOption[]
  activeBabyId: string | null
  returnTo: '/dashboard' | '/sleep' | '/chat' | '/profile'
}

export function BabySwitcher({ babies, activeBabyId, returnTo }: BabySwitcherProps) {
  if (babies.length < 2 || !activeBabyId) return null

  return (
    <form action={selectActiveBabyAction} className={styles.form}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className={styles.label} htmlFor={`active-baby-${returnTo.slice(1)}`}>
        Active baby
      </label>
      <div className={styles.controls}>
        <select
          className={styles.select}
          defaultValue={activeBabyId}
          id={`active-baby-${returnTo.slice(1)}`}
          name="babyId"
        >
          {babies.map((baby) => (
            <option key={baby.id} value={baby.id}>
              {baby.name}
            </option>
          ))}
        </select>
        <button className="btn-secondary" type="submit">
          Switch baby
        </button>
      </div>
    </form>
  )
}
