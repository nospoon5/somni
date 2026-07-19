import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const MARKDOWN_ROOTS = ['README.md', 'AGENTS.md', 'docs', 'somni_eval/README.md']

function collectMarkdownFiles(entry) {
  const absolute = path.join(ROOT, entry)
  if (!fs.existsSync(absolute)) return []
  const stats = fs.statSync(absolute)
  if (stats.isFile()) return absolute.endsWith('.md') ? [absolute] : []
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((child) => {
    const relative = path.join(entry, child.name)
    return child.isDirectory() ? collectMarkdownFiles(relative) : relative.endsWith('.md') ? [path.join(ROOT, relative)] : []
  })
}

function localTarget(rawTarget, sourceFile) {
  const target = rawTarget.trim().replace(/^<|>$/g, '')
  if (!target || target.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(target)) return null
  const withoutFragment = decodeURIComponent(target.split('#')[0].split('?')[0])
  if (!withoutFragment) return null
  return path.resolve(path.dirname(sourceFile), withoutFragment)
}

const files = [...new Set(MARKDOWN_ROOTS.flatMap(collectMarkdownFiles))]
const failures = []
let checked = 0

for (const sourceFile of files) {
  const source = fs.readFileSync(sourceFile, 'utf8')
  const targets = [
    ...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g),
    ...source.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm),
  ].map((match) => match[1])

  for (const rawTarget of targets) {
    const target = localTarget(rawTarget, sourceFile)
    if (!target) continue
    checked += 1
    if (!fs.existsSync(target)) {
      failures.push(`${path.relative(ROOT, sourceFile)} -> ${rawTarget}`)
    }
  }
}

if (failures.length > 0) {
  console.error(`Broken local documentation links (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Documentation link check passed: ${checked} local links across ${files.length} Markdown files.`)
}
