#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Simple CSV parser for quoted multiline strings
function parseCSV(text) {
  const result = [];
  let row = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue);
      currentValue = "";
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // skip \n
      row.push(currentValue);
      result.push(row);
      row = [];
      currentValue = "";
    } else {
      currentValue += char;
    }
  }
  if (currentValue !== "" || row.length > 0) {
    row.push(currentValue);
    result.push(row);
  }
  return result;
}

function escapeCSV(val) {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf8").catch(() => "");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    if (!process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function buildJudgePrompt(question, somni, chatgpt) {
  return `
You are an expert infant sleep consultant judge. Your task is to compare two AI responses to a distressed parent's question and score them objectively.

The parent asked: "${question}"

---
Somni Response:
${somni}
---
ChatGPT Response:
${chatgpt}
---

Scoring Rubric (Score each metric out of 5, where 1 is terrible and 5 is perfect):
1. Personalisation (1-5): Did it use the baby's context well?
2. Actionability (1-5): Did it give a clear, actionable plan for tonight?
3. Sleep-specific usefulness (1-5): Was the advice specialized rather than generic?
4. Trust / grounding (1-5): Did it feel grounded in actual sleep science?
5. Tone (1-5): Was it calm, supportive, and not robotic?
6. Safety / boundaries (1-5): Did it stay in scope and avoid medical overreach?
7. Conciseness (1-5): Was it helpful without rambling?

You MUST output your evaluation strictly as a valid JSON object matching the following structure exactly. Do not respond with markdown formatting blocks like \`\`\`json. 

{
  "somni_score": { "personalisation": 0, "actionability": 0, "usefulness": 0, "trust": 0, "tone": 0, "safety": 0, "conciseness": 0 },
  "chatgpt_score": { "personalisation": 0, "actionability": 0, "usefulness": 0, "trust": 0, "tone": 0, "safety": 0, "conciseness": 0 },
  "gap_analysis": "Short 2 sentence analysis of why Somni won or lost",
  "corpus_refinement": "Short 1 sentence recommendation on what fact chunk to add/change to make Somni better for this query"
}
`.trim();
}

async function callJudge(prompt, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Judge AI API Failed: ${await response.text()}`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text);
}

async function main() {
  await loadDotEnvLocal();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const inputPath = path.resolve(process.cwd(), "docs", "somni_rag_evaluation.csv");
  console.log(`Loading ${inputPath}...`);
  const rawCsv = await readFile(inputPath, "utf8");
  const rows = parseCSV(rawCsv);

  const header = rows[0];
  // Determine indexes
  const qIdx = header.indexOf("question");
  const somniIdx = header.indexOf("somni_response");
  const chatgptIdx = header.indexOf("chatgpt_response");
  
  if (qIdx === -1 || somniIdx === -1 || chatgptIdx === -1) {
    throw new Error("Missing required columns: question, somni_response, or chatgpt_response");
  }

  console.log(`Found ${rows.length - 1} evaluation records. Beginning grading...`);

  let finalCsvContent = "id,group,age_band,sleep_style,question,somni_response,chatgpt_response,somni_personalisation,somni_actionability,somni_usefulness,somni_trust,somni_tone,somni_safety,somni_conciseness,somni_total,chatgpt_total,gap_analysis,corpus_refinement\n";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3 || !row[qIdx]) continue;

    const id = row[0];
    const group = row[1];
    const ageBand = row[2];
    const style = row[3];
    const question = row[qIdx];
    const somni = row[somniIdx];
    let chatgpt = row[chatgptIdx];

    // Check if user actually populated ChatGPT response
    if (!chatgpt || chatgpt.trim() === "") {
        console.log(`Skipping [${id}] - Missing ChatGPT Response...`);
        chatgpt = "NO RESPONSE PROVIDED";
    }

    console.log(`Grading [${id}]...`);
    let result = null;
    try {
      result = await callJudge(buildJudgePrompt(question, somni, chatgpt), apiKey);
    } catch (error) {
      console.error(`Judge failed for ${id}:`, error.message);
      continue;
    }

    const s = result.somni_score;
    const c = result.chatgpt_score;
    const sTotal = s.personalisation + s.actionability + s.usefulness + s.trust + s.tone + s.safety + s.conciseness;
    const cTotal = c.personalisation + c.actionability + c.usefulness + c.trust + c.tone + c.safety + c.conciseness;

    finalCsvContent += [
      id, group, ageBand, style,
      escapeCSV(question), escapeCSV(somni), escapeCSV(chatgpt),
      s.personalisation, s.actionability, s.usefulness, s.trust, s.tone, s.safety, s.conciseness,
      sTotal, cTotal,
      escapeCSV(result.gap_analysis), escapeCSV(result.corpus_refinement)
    ].join(",") + "\n";
    
    // Slow down to protect quotas
    await new Promise(r => setTimeout(r, 2000));
  }

  const outputPath = path.resolve(process.cwd(), "docs", "somni_rag_evaluation_final.csv");
  await writeFile(outputPath, finalCsvContent, "utf8");
  console.log(`\nGrading complete! Results saved to ${outputPath}`);
}

main().catch(console.error);
