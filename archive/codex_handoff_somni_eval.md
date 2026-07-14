# Somni eval harness handoff for Codex

## Objective
Build a reliable script that reads `somni_questions_master_110.csv`, sends each question to Somni using the correct persona, captures the full response, and writes a clean CSV output file for that run.

This is not a one-off test. It should become the base harness for repeated benchmark runs.

## Inputs already prepared
- `somni_questions_master_110.csv`
- `somni_eval_template_110_questions.csv`

## Primary output required
Create one new file per run with this naming pattern:

`run_results_<run_id>.csv`

Example:

`run_results_2026-04-22_v1.csv`

## Required output columns
```text
run_id
test_date
question_id
target_persona
question_text
app_version
model_name
model_provider
prompt_version
corpus_version
rag_version
response_latency_seconds
request_status
error_message
somni_response
```

## Required behaviour
1. Read the master CSV.
2. For each row, send `question_text` to Somni under `target_persona`.
3. Capture the full response text.
4. Measure latency.
5. Write the result row to CSV immediately after each completed request.
6. Log failures without stopping the entire run unless the environment is unusable.
7. Never overwrite an existing run file.
8. Support configurable delays, timeouts, and paths.

## Strong preferences
- Use Python.
- If Somni has an API, use it.
- If not, use Playwright rather than brittle browser automation.
- Keep config separate from code.
- Keep the code readable and easy for a non-engineer to operate.

## Minimum quality bar
- A 5-row smoke test works.
- Partial results survive a crash.
- Retry logic exists for temporary failures only.
- The final row count can be checked against the source file.
- The script prints and logs a summary:
  - total rows
  - successful rows
  - failed rows
  - average latency
  - any suspicious duplicate or empty responses

## Suggested project structure
```text
somni_eval/
  config.json
  run_eval.py
  requirements.txt
  input/
    somni_questions_master_110.csv
  output/
    run_results_<run_id>.csv
  logs/
    <run_id>.log
```

## Recommended implementation order
### Step 1
Build a minimal smoke-test version that can run 3 to 5 questions and write valid CSV output.

### Step 2
Add incremental writing, logging, and failure handling.

### Step 3
Add throttling, retries, and summary checks.

### Step 4
Document setup and usage clearly for Damien.

## Do not do these things
- Do not keep the whole run only in memory.
- Do not silently skip failed rows.
- Do not trim or paraphrase the Somni response.
- Do not hardcode paths, timeouts, or delays.
- Do not overwrite earlier run files.

## Optional extras after v1
- resume mode
- screenshot capture on browser failure
- baseline comparison mode
- HTML summary report
- duplicate-response warning
