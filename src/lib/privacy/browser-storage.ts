const SOMNI_STORAGE_PREFIX = 'somni:'

export function isSomniStorageKey(key: string | null): key is string {
  return Boolean(key?.startsWith(SOMNI_STORAGE_PREFIX))
}

function clearSomniKeys(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index)
    if (isSomniStorageKey(key)) storage.removeItem(key)
  }
}

export function clearSomniBrowserStorage() {
  clearSomniKeys(window.localStorage)
  clearSomniKeys(window.sessionStorage)
}
