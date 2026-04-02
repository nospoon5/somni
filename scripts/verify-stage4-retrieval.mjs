#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_DIMENSION = 768;

async function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseVector(value) {
  if (typeof value !== "string" || !value.startsWith("[") || !value.endsWith("]")) {
    return [];
  }
  return value
    .slice(1, -1)
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isFinite(num));
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function cosine(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  const denom = Math.sqrt(dot(a, a) * dot(b, b));
  if (!denom) return 0;
  return dot(a, b) / denom;
}

function scoreChunk(baseSimilarity, row, ageBand, methodology) {
  const ageBoost =
    ageBand && row.age_band && row.age_band.toLowerCase() === ageBand.toLowerCase() ? 0.08 : 0;
  const methodologyBoost =
    methodology && row.methodology.toLowerCase() === methodology
      ? 0.06
      : methodology && row.methodology.toLowerCase() === "all"
        ? 0.03
        : 0;
  const topic = row.topic.toLowerCase();
  const safetyBoost =
    topic.includes("safe sleep") || topic.includes("safe sleeping") ? 0.05 : 0;
  return baseSimilarity + ageBoost + methodologyBoost + safetyBoost;
}

async function embedQuery(query, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: query }] },
        outputDimensionality: EMBEDDING_DIMENSION,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding call failed (${response.status}): ${await response.text()}`);
  }

  const payload = await response.json();
  const values = payload?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
    throw new Error("Embedding output had unexpected dimensions");
  }
  return values;
}

async function main() {
  await loadDotEnvLocal();
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
  const apiKey = requireEnv("GEMINI_API_KEY");

  const scenarios = [
    {
      label: "Frequent 4-6m night waking",
      query: "My 5 month old wakes every 2 hours overnight, what can we try tonight?",
      ageBand: "4-6 months",
      methodology: "balanced",
    },
    {
      label: "Safe sleeping concern",
      query: "Can my baby sleep on their side if they roll?",
      ageBand: "0-6 months",
      methodology: "all",
    },
    {
      label: "Early morning waking",
      query: "My 10 month old keeps waking at 5am, how do we shift that?",
      ageBand: "7-12 months",
      methodology: "gentle",
    },
  ];

  for (const scenario of scenarios) {
    const queryEmbedding = await embedQuery(scenario.query, apiKey);

    const { data: rpcRows, error: rpcError } = await supabase.rpc("match_corpus_chunks", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_count: 5,
      preferred_age_band: scenario.ageBand,
      preferred_methodology: scenario.methodology,
    });

    let rows = rpcRows ?? [];
    let mode = "rpc";

    const rpcMissing =
      rpcError &&
      rpcError.message.includes("match_corpus_chunks") &&
      (rpcError.message.includes("does not exist") || rpcError.message.includes("Could not find"));

    if (rpcMissing) {
      mode = "fallback";
      const { data: allRows, error: allError } = await supabase
        .from("corpus_chunks")
        .select("chunk_id, topic, age_band, methodology, embedding");

      if (allError) {
        throw new Error(allError.message);
      }

      rows = (allRows ?? [])
        .map((row) => {
          const similarity = scoreChunk(
            cosine(queryEmbedding, parseVector(row.embedding)),
            row,
            scenario.ageBand,
            scenario.methodology
          );
          return { ...row, similarity };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);
    } else if (rpcError) {
      throw new Error(rpcError.message);
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`No retrieval rows returned for: ${scenario.label}`);
    }

    console.log(`\n=== ${scenario.label} (${mode}) ===`);
    rows.slice(0, 3).forEach((row, index) => {
      console.log(
        `${index + 1}. ${row.chunk_id} | ${row.topic} | score=${Number(row.similarity ?? 0).toFixed(4)}`
      );
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
