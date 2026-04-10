// Thin wrapper that loads .env.local and then runs upload-corpus.mjs
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = await readFile(envPath, 'utf8').catch(() => '')
for (const line of content.split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const raw = trimmed.slice(eqIdx + 1).trim()
  const value = raw.replace(/^["']|["']$/g, '')
  if (!process.env[key]) process.env[key] = value
}

// Now hand off to the real script
await import('./upload-corpus.mjs')
