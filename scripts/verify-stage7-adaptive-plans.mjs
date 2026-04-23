#!/usr/bin/env node

import { spawn } from 'node:child_process'
import process from 'node:process'

const TEST_FILES = [
  'src/lib/sleep-plan-profile-init.test.ts',
  'src/lib/daily-plan-derivation.test.ts',
  'src/lib/sleep-plan-chat-updates.test.ts',
  'src/lib/sleep-plan-log-adaptation.test.ts',
]

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
    })

    child.on('close', (code) => {
      resolve(code ?? 1)
    })
    child.on('error', () => {
      resolve(1)
    })
  })
}

async function main() {
  const startedAt = Date.now()
  console.log('Stage 7 adaptive-plan verification')
  console.log('Running focused regression tests for onboarding, derivation, chat, and adaptation...')

  const code =
    process.platform === 'win32'
      ? await runCommand('cmd.exe', [
          '/d',
          '/s',
          '/c',
          `npm test -- --run ${TEST_FILES.join(' ')}`,
        ])
      : await runCommand('npm', ['test', '--', '--run', ...TEST_FILES])
  if (code !== 0) {
    process.exit(code)
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`Stage 7 adaptive-plan verification passed in ${elapsedSeconds}s.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
