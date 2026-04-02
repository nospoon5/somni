# Somni – Corpus Plan

## Goal

Create a strict, trusted, Australian-aligned baby sleep knowledge base that powers Somni's RAG pipeline. Corpus quality is the product's competitive moat.

> **Key principle:** Corpus quality > model quality. A mediocre LLM with excellent corpus will always outperform a brilliant LLM with poor context.

---

## Sources (V1)

### Primary Australian Sources
- Red Nose Australia (safe sleeping)
- Tresillian (settling, routines, general guidance)
- Karitane (sleep strategies, parenting support)
- Raising Children Network (evidence-based parenting info)
- Pregnancy, Birth and Baby (Health Direct)
- RCH Melbourne (Royal Children's Hospital)

### Additional Sources
- User-provided list of 50+ specific URLs (incoming as CSV)
- These will be processed by the Content Agent

---

## Rules

- **Paraphrase everything** — never copy content verbatim
- **Cite sources naturally** — "Based on Red Nose guidelines..." not "[Source: Red Nose, 2024]"
- **Sleep-only focus** — reject content that strays from baby sleep
- **Cross-reference** — verify claims across 2+ sources where possible
- **Flag conflicts** — when sources disagree, document both positions
- **Australian-first** — prioritise AU guidelines; flag when international sources differ

---

## Embedding Strategy

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Embedding model | `gemini-embedding-001` (Gemini) | Current supported Gemini embedding model for `embedContent` |
| Chunk size | 300-500 tokens | Short enough for precise retrieval, long enough for meaningful context |
| Chunk overlap | 50 tokens | Prevents cutting mid-thought at chunk boundaries |
| Storage | pgvector (Supabase) | Native integration, no separate vector DB needed |
| Retrieval | Top-5 chunks per query | Balances context quality with token costs |
| Similarity metric | Cosine similarity | Standard, works well with Gemini embeddings |

---

## Chunk Metadata Schema

Each chunk is stored with the following metadata for filtered retrieval:

```json
{
  "chunk_id": "4-6m_night_waking_01",
  "topic": "frequent night waking",
  "age_band": "4-6 months",
  "age_band_code": "4-6m",
  "methodology": "all",
  "sources": [
    {"name": "Tresillian", "url": "https://..."},
    {"name": "Red Nose Australia", "url": "https://..."}
  ],
  "confidence": "high",
  "last_updated": "2026-04-01",
  "word_count": 280,
  "tags": ["waking", "night", "feeding", "settling"]
}
```

### Filterable Fields
- `age_band`: enables age-appropriate retrieval
- `methodology`: enables sleep-style-aligned retrieval
- `topic`: enables topic-specific retrieval
- `confidence`: allows deprioritising low-confidence chunks

---

## Folder Structure

```
/corpus
├── sources/          ← Raw source notes (per URL)
│   ├── rednose_safe_sleeping.md
│   ├── tresillian_settling_4-6m.md
│   └── ...
├── chunks/           ← Processed, embeddable chunks (per topic)
│   ├── 0-3m_safe_sleep.md
│   ├── 4-6m_night_waking.md
│   ├── all_ages_bedtime_routine.md
│   └── ...
└── metadata/
    └── source_index.md   ← Master tracking of all sources and processing status
```

---

## Chunk Format

Each chunk file follows this template:

```markdown
---
topic: "frequent night waking"
age_band: "4-6 months"
methodology: "all"
sources:
  - name: "Tresillian"
    url: "https://..."
  - name: "Red Nose Australia"
    url: "https://..."
last_updated: "2026-04-01"
confidence: "high"
---

# Frequent Night Waking (4–6 Months)

[Content in Somni's tone: calm, supportive, practical. 150-400 words.]

## Key Points
- [bullet 1]
- [bullet 2]
- [bullet 3]

## What to Try
- [actionable step 1]
- [actionable step 2]

## When to Seek Help
- [red flag — redirect to GP/health professional]
```

---

## Coverage Matrix (V1 Target)

Aim for **50+ chunks** covering this matrix. Not every cell needs a unique chunk — some topics (like bedtime routine) apply across age bands.

| Topic | 0–3m | 4–6m | 7–9m | 10–12m | All Ages |
|-------|------|------|------|--------|----------|
| Night waking | ☐ | ☐ | ☐ | ☐ | |
| Nap schedules / wake windows | ☐ | ☐ | ☐ | ☐ | |
| Bedtime routine | | | | | ☐ |
| Self-settling | | ☐ | ☐ | ☐ | |
| Sleep regression | | ☐ | ☐ | ☐ | |
| Overtiredness / undertiredness | | | | | ☐ |
| Safe sleeping | ☐ | | | | ☐ |
| Contact naps / catnapping | ☐ | ☐ | ☐ | | |
| Feeding & sleep relationship | ☐ | ☐ | ☐ | ☐ | |
| Sleep environment | | | | | ☐ |
| Settling techniques (Gentle) | | ☐ | ☐ | ☐ | |
| Settling techniques (Balanced) | | ☐ | ☐ | ☐ | |
| Settling techniques (Fast-track) | | ☐ | ☐ | ☐ | |
| Early morning waking | | | ☐ | ☐ | |
| Nap transitions | | ☐ | ☐ | ☐ | |
| Teething & sleep | | | ☐ | ☐ | |
| Illness & sleep | | | | | ☐ |

---

## Quality Checklist (per chunk)

- [ ] No verbatim copied content
- [ ] Source attribution in metadata
- [ ] Age band tagged correctly
- [ ] Methodology alignment noted
- [ ] Written in Somni's tone (calm, supportive, practical)
- [ ] 150–400 words
- [ ] Includes actionable "What to Try" section
- [ ] "When to Seek Help" section present
- [ ] Cross-referenced with 2+ sources where possible
- [ ] No medical advice — sleep coaching guidance only
- [ ] Consistent markdown formatting with YAML frontmatter

---

## Curation Workflow

1. **You provide** the source URL list (CSV)
2. **Content Agent scrapes** each URL, extracts key information
3. **Content Agent compares** information across sources for same topics
4. **Content Agent drafts** corpus chunks in Somni's tone
5. **You review** a sample of chunks for accuracy and tone
6. **Content Agent revises** based on your feedback
7. **Final chunks** saved to `/corpus/chunks/` with metadata
8. **Source tracking** updated in `/corpus/metadata/source_index.md`
