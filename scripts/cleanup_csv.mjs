import fs from 'node:fs'

const path = 'c:/AI Projects/01_Apps/Somni/docs/somni_rag_evaluation.csv'
const content = fs.readFileSync(path, 'utf8')

// I want to only keep lines that either start with a number followed by a comma (id), or start with "id,"
// And that do not contain "ERROR HTTP" or "ERROR:"

const lines = content.split('\n')
const fixedLines = []

for (const line of lines) {
  if (!line.trim()) continue

  if (line.match(/^(\d+|id),/)) {
    if (line.includes("ERROR HTTP") || line.includes("ERROR:") || line.includes("Gemini stream failed")) {
      console.log('Found error line, dropping it...')
      continue
    }
    fixedLines.push(line)
  }
}

fs.writeFileSync(path, `${fixedLines.join('\n')}\n`, 'utf8')
console.log(`Cleanup complete. Kept ${fixedLines.length} lines.`)
