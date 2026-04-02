#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_CHUNKS_DIR = path.resolve(process.cwd(), "corpus", "chunks");
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_DIMENSION = 768;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeMethodology(value) {
  const normalized = value?.trim().toLowerCase() || "all";
  const allowed = new Set(["gentle", "balanced", "fast-track", "all"]);
  if (!allowed.has(normalized)) {
    throw new Error(
      `Invalid methodology "${value}". Expected one of: gentle, balanced, fast-track, all`
    );
  }
  return normalized;
}

function normalizeConfidence(value) {
  const normalized = value?.trim().toLowerCase() || "medium";
  const allowed = new Set(["high", "medium", "low"]);
  if (!allowed.has(normalized)) {
    throw new Error(
      `Invalid confidence "${value}". Expected one of: high, medium, low`
    );
  }
  return normalized;
}

function parseFrontmatter(markdown, filePath) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`Missing valid frontmatter block in ${filePath}`);
  }

  const frontmatterText = match[1];
  const body = match[2].trim();
  if (!body) {
    throw new Error(`Missing markdown body content in ${filePath}`);
  }

  const lines = frontmatterText.split(/\r?\n/);
  let topic = "";
  let ageBand = null;
  let methodology = "all";
  let confidence = "medium";
  const sources = [];

  let inSources = false;
  let currentSource = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("topic:")) {
      topic = stripWrappingQuotes(line.slice("topic:".length));
      inSources = false;
      continue;
    }

    if (line.startsWith("age_band:")) {
      const value = stripWrappingQuotes(line.slice("age_band:".length));
      ageBand = value || null;
      inSources = false;
      continue;
    }

    if (line.startsWith("methodology:")) {
      methodology = normalizeMethodology(
        stripWrappingQuotes(line.slice("methodology:".length))
      );
      inSources = false;
      continue;
    }

    if (line.startsWith("confidence:")) {
      confidence = normalizeConfidence(
        stripWrappingQuotes(line.slice("confidence:".length))
      );
      inSources = false;
      continue;
    }

    if (line === "sources:") {
      inSources = true;
      continue;
    }

    if (!inSources) {
      continue;
    }

    if (line.startsWith("- name:")) {
      if (currentSource?.name && currentSource?.url) {
        sources.push(currentSource);
      }
      currentSource = {
        name: stripWrappingQuotes(line.slice("- name:".length)),
        url: "",
      };
      continue;
    }

    if (line.startsWith("url:") && currentSource) {
      currentSource.url = stripWrappingQuotes(line.slice("url:".length));
      continue;
    }
  }

  if (currentSource?.name && currentSource?.url) {
    sources.push(currentSource);
  }

  if (!topic) {
    throw new Error(`Missing "topic" in frontmatter: ${filePath}`);
  }

  if (sources.length === 0) {
    throw new Error(`Missing "sources" entries in frontmatter: ${filePath}`);
  }

  return {
    topic,
    ageBand,
    methodology,
    confidence,
    sources,
    content: body,
  };
}

function toStableChunkId(fileName) {
  const withoutExtension = fileName.replace(/\.md$/i, "");
  return withoutExtension
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function toPgVectorLiteral(values) {
  return `[${values.join(",")}]`;
}

async function embedText(content, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text: content }],
      },
      outputDimensionality: EMBEDDING_DIMENSION,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini embedding request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Gemini embedding response was missing embedding values");
  }
  if (values.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Embedding dimension mismatch. Expected ${EMBEDDING_DIMENSION}, got ${values.length}`
    );
  }

  return values;
}

async function main() {
  const chunksDirArg = process.argv[2];
  const chunksDir = chunksDirArg
    ? path.resolve(process.cwd(), chunksDirArg)
    : DEFAULT_CHUNKS_DIR;

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const geminiApiKey = requireEnv("GEMINI_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const files = (await readdir(chunksDir))
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No markdown chunks found in: ${chunksDir}`);
  }

  const seenChunkIds = new Set();
  console.log(`Found ${files.length} chunk files in ${chunksDir}`);

  let processed = 0;
  for (const fileName of files) {
    const fullPath = path.join(chunksDir, fileName);
    const markdown = await readFile(fullPath, "utf8");
    const parsed = parseFrontmatter(markdown, fullPath);
    const chunkId = toStableChunkId(fileName);

    if (seenChunkIds.has(chunkId)) {
      throw new Error(`Duplicate chunk_id generated: ${chunkId}`);
    }
    seenChunkIds.add(chunkId);

    const embeddingValues = await embedText(parsed.content, geminiApiKey);
    const embedding = toPgVectorLiteral(embeddingValues);

    const { error } = await supabase.from("corpus_chunks").upsert(
      {
        chunk_id: chunkId,
        topic: parsed.topic,
        age_band: parsed.ageBand,
        methodology: parsed.methodology,
        content: parsed.content,
        sources: parsed.sources,
        confidence: parsed.confidence,
        embedding,
      },
      {
        onConflict: "chunk_id",
        ignoreDuplicates: false,
      }
    );

    if (error) {
      throw new Error(`Supabase upsert failed for ${fileName}: ${error.message}`);
    }

    processed += 1;
    console.log(`[${processed}/${files.length}] Upserted ${chunkId}`);
  }

  const { count, error: countError } = await supabase
    .from("corpus_chunks")
    .select("*", { head: true, count: "exact" });

  if (countError) {
    throw new Error(`Failed to verify corpus_chunks count: ${countError.message}`);
  }

  console.log(`Done. Uploaded/updated ${processed} chunks.`);
  if (typeof count === "number") {
    console.log(`corpus_chunks row count is now ${count}.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
