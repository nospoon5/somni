# Somni Eval Runner

This folder contains a reusable evaluation runner for Somni.

What it does:
- Reads the comparable 110-question core benchmark from the 117-row master CSV.
- Sends each question to Somni using the matching persona.
- Captures the full raw reply.
- Writes one CSV row per question using the exact schema from `docs/run_results_template.csv`.
- Saves progress after every question so you can stop and resume safely.

Why it is structured this way:
- The runner, logging, and CSV logic are separate from the Somni transport code.
- That means we can keep the same pipeline later even if Somni is reached through a browser instead of the API.

## Folder layout

```text
somni_eval/
  run_eval.py
  configuration.py
  csv_schema.py
  adapters.py
  logging_utils.py
  config.json
  config.example.json
  requirements.txt
  output/
    results/
    logs/
    state/
```

## Important assumption in v1

The current default adapter uses Somni's existing `/api/chat` endpoint and routes each question through the matching test account:
- `gentle` -> `gentletester@test.com`
- `balanced` -> `balancedtester@test.com`
- `fast-track` -> `fasttester@test.com`

This is the cleanest reliable persona switch visible in the repo right now.

The runner is intentionally read-only. It never changes a baby profile, creates an
account, consumes chat quota, or persists benchmark messages. Somni reads an explicit
age from each question and uses that age for retrieval and response safety.

## Before you run it

1. Make sure the Somni app is running locally.
   What this means: the website should open in your browser at `http://127.0.0.1:3000` unless you changed the port.

2. Make sure Python is installed.
   You can check by running:

   ```powershell
   python --version
   ```

3. Install the small Python dependency for HTTP requests:

   ```powershell
   python -m pip install -r somni_eval/requirements.txt
   ```

4. Open `somni_eval/config.json` and check these values:
   - `transport.base_url`
   - `metadata.app_version`
   - `metadata.prompt_version`
   - `metadata.corpus_version`
   - `metadata.rag_version`

Notes:
- `transport.supabase_url` and `transport.supabase_anon_key` can stay blank if they already exist in the repo `.env.local`.
- The default delay is already `60` seconds between questions.
- Set `SOMNI_EVAL_SECRET` (at least 32 characters) in the shell that starts both the
  app and the real evaluation run. This authenticates read-only evaluation mode; do
  not put the secret in a tracked JSON file.

## Smoke test first

Run a short 5-question dry run:

```powershell
python somni_eval/run_eval.py --dry-run --max-questions 5
```

What to expect:
- A new results CSV in `somni_eval/output/results`
- A run log in `somni_eval/output/logs`
- A state file in `somni_eval/output/state`

This does not hit the real app. It only checks that the runner, CSV schema, and file writing are working.

## Real smoke test

Run a real 5-question check against Somni:

```powershell
python somni_eval/run_eval.py --max-questions 5 --delay-seconds 5
```

Why this is useful:
- It confirms login works.
- It confirms Somni returns real answers.
- It confirms partial progress is saved correctly.

## Full run

When the smoke test looks good, run the full benchmark:

```powershell
python somni_eval/run_eval.py
```

What happens:
- The runner creates a fresh `run_id`.
- It writes to `somni_eval/output/results/run_results_<run_id>.csv`.
- It waits `60` seconds between questions.
- It keeps going even if one question fails.

## Multi-turn and adversarial extensions

The master CSV also contains seven Stage 7 extensions: two linked follow-up questions and five
adversarial safety prompts. They are kept separate so historical 110-question comparisons remain
fair. Run them with:

```powershell
python somni_eval/run_eval.py --question-set extensions --delay-seconds 1
```

Use `--question-set all` only when you deliberately want one combined 117-row run.

## Resume a stopped run

If a run stops halfway through, find the `run_id` in the results filename, then resume it:

```powershell
python somni_eval/run_eval.py --resume --run-id 2026_04_25_220000_v1
```

How resume works:
- The runner reads the existing results CSV first.
- Any `question_id` already written there is skipped.
- This prevents duplicate rows if the run stopped after writing some results.

## Output files

### Results CSV

Location:

```text
somni_eval/output/results/run_results_<run_id>.csv
```

This is the file you review later.

### Run log

Location:

```text
somni_eval/output/logs/<run_id>.log
```

This contains normal progress messages.

### Error log

Location:

```text
somni_eval/output/logs/<run_id>.errors.log
```

This contains error-level failures for easier debugging.

### State file

Location:

```text
somni_eval/output/state/run_state_<run_id>.json
```

This stores progress and summary information for resume and troubleshooting.

## Common problems

### Problem: "Could not reach Somni"

Meaning:
- The app is not running, or the URL in config is wrong.

Fix:
- Start Somni locally.
- Check `transport.base_url` in `somni_eval/config.json`.

### Problem: login fails

Meaning:
- The test account password is wrong, or Supabase settings were not loaded.

Fix:
- Check `docs/TEST_ACCOUNTS.md`.
- Make sure `.env.local` has the current Supabase URL, anon key, and service role key.

### Problem: resume says the file does not exist

Meaning:
- The `run_id` does not match the existing results filename.

Fix:
- Copy the exact `run_id` from the results CSV filename and try again.

## Design choices

Why Python instead of Node:
- The handoff explicitly prefers Python.
- It keeps this eval harness separate from the Next.js app itself.

Why write after every question:
- It protects partial progress if the run crashes.

Why results CSV is the main source of truth for resume:
- If the runner crashes after writing a row but before updating the state file, the CSV still proves the row is done.

Why there is a dry-run mode:
- It lets you test the pipeline without touching the real app.

Why there is a `--delay-seconds` option:
- It makes smoke tests faster while keeping the full-run default safe.

Why the runner does not rewrite the test baby profile:
- The chat pipeline already gives an explicitly stated age priority for retrieval and safety.
- Keeping test fixtures unchanged makes interrupted and resumed runs safe.
