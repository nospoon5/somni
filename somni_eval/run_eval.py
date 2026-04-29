from __future__ import annotations

import json
import statistics
import sys
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from adapters import AdapterError, FatalAdapterError, RetryableAdapterError, create_adapter
from configuration import (
    ConfigError,
    ensure_directories,
    error_log_path,
    load_config,
    parse_args,
    results_file_path,
    run_log_path,
    state_file_path,
)
from csv_schema import (
    QuestionRow,
    append_result_row,
    load_expected_output_headers,
    load_questions,
    read_existing_results,
    write_results_header,
)
from logging_utils import create_logger


def main() -> int:
    args = parse_args()

    try:
        config = load_config(args)
        ensure_directories(config.paths)
        expected_headers = load_expected_output_headers(config.paths.schema_template_csv)
        questions = load_questions(config.paths.questions_csv, config.run.max_questions)
    except ConfigError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 1

    results_path = results_file_path(config)
    run_log = run_log_path(config)
    error_log = error_log_path(config)
    state_path = state_file_path(config)
    logger = create_logger(config.run.run_id, run_log, error_log)

    try:
        existing_rows = _prepare_run_files(
            results_path=results_path,
            state_path=state_path,
            expected_headers=expected_headers,
            resume=args.resume,
            logger=logger,
        )
    except ConfigError as exc:
        logger.error(str(exc))
        return 1

    completed_question_ids = {
        row["question_id"].strip()
        for row in existing_rows
        if row.get("question_id", "").strip()
    }
    adapter = create_adapter(config)

    try:
        adapter.validate_environment()
    except AdapterError as exc:
        logger.error("Environment validation failed: %s", exc)
        return 1

    logger.info("Run started | run_id=%s | questions=%s | resume=%s", config.run.run_id, len(questions), args.resume)
    logger.info("Results file: %s", results_path)
    logger.info("Run log: %s", run_log)
    logger.info("Error log: %s", error_log)

    all_rows = list(existing_rows)
    progress_state = _load_state_file(state_path)
    if not progress_state:
        progress_state = _build_state_payload(config.run.run_id, questions, all_rows, started=True)
        _write_state_file(state_path, progress_state)

    sequence_to_conversation_id: dict[str, str] = {}

    for index, question in enumerate(questions, start=1):
        if question.question_id in completed_question_ids:
            logger.info(
                "[%s/%s] Skipping %s because it is already present in the results file.",
                index,
                len(questions),
                question.question_id,
            )
            continue

        logger.info(
            "[%s/%s] Sending %s using persona '%s'.",
            index,
            len(questions),
            question.question_id,
            question.target_persona,
        )

        conversation_id = ""
        if question.sequence_id:
            if question.sequence_id not in sequence_to_conversation_id:
                sequence_to_conversation_id[question.sequence_id] = str(uuid.uuid4())
            conversation_id = sequence_to_conversation_id[question.sequence_id]

        row = _process_question(question, config, adapter, logger, conversation_id)
        append_result_row(results_path, expected_headers, row)
        all_rows.append(row)
        completed_question_ids.add(question.question_id)

        progress_state = _build_state_payload(config.run.run_id, questions, all_rows, started=True)
        progress_state["last_completed_question_id"] = question.question_id
        _write_state_file(state_path, progress_state)

        logger.info(
            "[%s/%s] Wrote result for %s with status=%s.",
            index,
            len(questions),
            question.question_id,
            row["request_status"],
        )

        if index < len(questions) and config.run.delay_seconds > 0:
            logger.info("Sleeping for %s seconds before the next question.", config.run.delay_seconds)
            time.sleep(config.run.delay_seconds)

    summary = _build_summary(questions, all_rows)
    logger.info("Run finished.")
    for line in _format_summary_lines(summary):
        logger.info(line)

    progress_state = _build_state_payload(config.run.run_id, questions, all_rows, started=False)
    progress_state["finished_at"] = _utc_now_iso()
    progress_state["summary"] = summary
    _write_state_file(state_path, progress_state)

    return 0


def _prepare_run_files(
    *,
    results_path: Path,
    state_path: Path,
    expected_headers: list[str],
    resume: bool,
    logger,
) -> list[dict[str, str]]:
    if resume:
        if not results_path.exists():
            raise ConfigError(
                f"Resume was requested, but the results file does not exist: {results_path}"
            )
        existing_rows = read_existing_results(results_path, expected_headers)
        logger.info("Loaded %s existing rows from %s", len(existing_rows), results_path)
        return existing_rows

    if results_path.exists():
        raise ConfigError(
            f"Results file already exists: {results_path}. "
            "Use a new run_id or add --resume if you want to continue that same run."
        )
    if state_path.exists():
        raise ConfigError(
            f"State file already exists for this run_id: {state_path}. "
            "Use a new run_id or delete the old state if that run is no longer needed."
        )

    write_results_header(results_path, expected_headers)
    return []


def _process_question(question, config, adapter, logger, conversation_id: str = "") -> dict[str, str]:
    attempts_allowed = config.run.max_retries + 1
    last_error = ""

    for attempt_number in range(1, attempts_allowed + 1):
        started_at = time.perf_counter()
        try:
            result = adapter.send_question(
                persona=question.target_persona,
                question_text=question.question_text,
                timeout_seconds=config.run.request_timeout_seconds,
                conversation_id=conversation_id,
            )
            latency_seconds = time.perf_counter() - started_at
            return _build_output_row(
                config=config,
                question=question,
                request_status="success",
                error_message="",
                response_text=result.response_text,
                latency_seconds=latency_seconds,
                retrieval=result.retrieval,
                sources=result.sources,
                confidence=result.confidence,
                ttft_seconds=result.ttft_seconds,
                timings=result.timings,
            )
        except RetryableAdapterError as exc:
            latency_seconds = time.perf_counter() - started_at
            last_error = _truncate_error(str(exc))
            logger.warning(
                "Retryable failure for %s on attempt %s/%s: %s",
                question.question_id,
                attempt_number,
                attempts_allowed,
                last_error,
            )
            if attempt_number < attempts_allowed:
                if config.run.retry_backoff_seconds > 0:
                    logger.info(
                        "Waiting %s seconds before retrying %s.",
                        config.run.retry_backoff_seconds,
                        question.question_id,
                    )
                    time.sleep(config.run.retry_backoff_seconds)
                continue
            return _build_output_row(
                config=config,
                question=question,
                request_status=_classify_retryable_error(last_error),
                error_message=last_error,
                response_text="",
                latency_seconds=latency_seconds,
                retrieval=None,
                sources=None,
                confidence="",
                ttft_seconds=None,
                timings=None,
            )
        except FatalAdapterError as exc:
            latency_seconds = time.perf_counter() - started_at
            last_error = _truncate_error(str(exc))
            logger.error("Fatal failure for %s: %s", question.question_id, last_error)
            return _build_output_row(
                config=config,
                question=question,
                request_status="failed",
                error_message=last_error,
                response_text="",
                latency_seconds=latency_seconds,
                retrieval=None,
                sources=None,
                confidence="",
                ttft_seconds=None,
                timings=None,
            )

    return _build_output_row(
        config=config,
        question=question,
        request_status="failed",
        error_message=last_error or "Unexpected runner failure.",
        response_text="",
        latency_seconds=0.0,
        retrieval=None,
        sources=None,
        confidence="",
        ttft_seconds=None,
        timings=None,
    )


def _build_output_row(
    *,
    config,
    question: QuestionRow,
    request_status: str,
    error_message: str,
    response_text: str,
    latency_seconds: float,
    retrieval: dict[str, object] | None,
    sources: list[object] | None,
    confidence: str,
    ttft_seconds: float | None,
    timings: dict[str, object] | None,
) -> dict[str, str]:
    timing_fields = _build_timing_output_fields(timings)
    return {
        "run_id": config.run.run_id,
        "test_date": _utc_now_iso(),
        "question_id": question.question_id,
        "target_persona": question.target_persona,
        "question_text": question.question_text,
        "app_version": config.metadata.app_version,
        "model_name": config.metadata.model_name,
        "model_provider": config.metadata.model_provider,
        "prompt_version": config.metadata.prompt_version,
        "corpus_version": config.metadata.corpus_version,
        "rag_version": config.metadata.rag_version,
        "response_latency_seconds": f"{latency_seconds:.3f}",
        "request_status": request_status,
        "error_message": error_message,
        "somni_response": response_text,
        "retrieval": json.dumps(retrieval, ensure_ascii=True) if retrieval is not None else "",
        "sources": json.dumps(sources, ensure_ascii=True) if sources is not None else "",
        "confidence": confidence,
        "ttft_seconds": f"{ttft_seconds:.3f}" if ttft_seconds is not None else "",
        **timing_fields,
    }


def _build_timing_output_fields(timings: dict[str, object] | None) -> dict[str, str]:
    return {
        "timings": json.dumps(timings, ensure_ascii=True) if timings is not None else "",
        "auth_session_seconds": _format_timing_stage(timings, "auth_session_lookup"),
        "profile_context_seconds": _format_timing_stage(
            timings,
            "profile_baby_lookup",
            "profile_context_load",
            "sleep_plan_profile_load",
            "quota_lookup",
        ),
        "latest_message_age_extraction_seconds": _format_timing_stage(
            timings, "latest_message_age_extraction"
        ),
        "embedding_seconds": _format_timing_stage(timings, "embedding_creation"),
        "retrieval_total_seconds": _format_timing_stage(timings, "retrieval_total"),
        "retrieval_vector_search_seconds": _format_timing_stage(
            timings,
            "retrieval_rpc_vector_search",
            "retrieval_fallback_fetch",
            "retrieval_fallback_score",
        ),
        "retrieval_rerank_source_selection_seconds": _format_timing_stage(
            timings, "retrieval_rerank_source_selection"
        ),
        "prompt_assembly_seconds": _format_timing_stage(timings, "prompt_assembly"),
        "primary_model_call_seconds": _format_timing_stage(timings, "primary_model_call"),
        "primary_model_ttft_seconds": _format_timing_stage(timings, "primary_model_ttft"),
        "response_validation_filtering_seconds": _format_timing_stage(
            timings, "response_validation_filtering"
        ),
        "retry_rewrite_seconds": _format_timing_stage(timings, "retry_or_rewrite_pass"),
        "persistence_database_write_seconds": _format_timing_stage(
            timings, "persistence_database_write"
        ),
        "server_total_latency_seconds": _format_timing_value(
            _timing_number(timings, "total_latency_seconds")
        ),
        "server_time_to_first_token_seconds": _format_timing_value(
            _timing_mark(timings, "time_to_first_token")
        ),
        "retry_count": _format_timing_metadata(timings, "retry_count"),
        "retry_reason": _format_timing_metadata(timings, "retry_reason"),
        "response_character_count": _format_timing_metadata(
            timings, "response_character_count"
        ),
        "prompt_character_count": _format_timing_metadata(timings, "prompt_character_count"),
        "prompt_token_estimate": _format_timing_metadata(timings, "prompt_token_estimate"),
        "selected_source_count": _format_timing_metadata(timings, "selected_source_count"),
        "chat_model_name": _format_timing_metadata(timings, "model_name"),
        "chat_model_provider": _format_timing_metadata(timings, "model_provider"),
    }


def _format_timing_stage(timings: dict[str, object] | None, *stage_names: str) -> str:
    if not timings:
        return ""

    stage_seconds = timings.get("stage_seconds")
    if not isinstance(stage_seconds, dict):
        return ""

    values = []
    for stage_name in stage_names:
        value = stage_seconds.get(stage_name)
        if isinstance(value, (int, float)):
            values.append(float(value))

    if not values:
        return ""

    return _format_timing_value(sum(values))


def _format_timing_value(value: float | None) -> str:
    return f"{value:.3f}" if value is not None else ""


def _format_timing_metadata(timings: dict[str, object] | None, key: str) -> str:
    if not timings:
        return ""

    value = timings.get(key)
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=True)
    return str(value)


def _timing_number(timings: dict[str, object] | None, key: str) -> float | None:
    if not timings:
        return None

    value = timings.get(key)
    return float(value) if isinstance(value, (int, float)) else None


def _timing_mark(timings: dict[str, object] | None, key: str) -> float | None:
    if not timings:
        return None

    marks_seconds = timings.get("marks_seconds")
    if not isinstance(marks_seconds, dict):
        return None

    value = marks_seconds.get(key)
    return float(value) if isinstance(value, (int, float)) else None


def _build_summary(
    questions: list[QuestionRow], rows: list[dict[str, str]]
) -> dict[str, object]:
    success_rows = [row for row in rows if row["request_status"] == "success"]
    failed_rows = [row for row in rows if row["request_status"] != "success"]
    latencies = [
        float(row["response_latency_seconds"])
        for row in success_rows
        if row.get("response_latency_seconds", "").strip()
    ]
    slowest_rows = sorted(
        (
            {
                "question_id": row.get("question_id", ""),
                "latency_seconds": float(row.get("response_latency_seconds", "0") or 0),
                "ttft_seconds": _optional_float(row.get("ttft_seconds", "")),
            }
            for row in success_rows
            if row.get("response_latency_seconds", "").strip()
        ),
        key=lambda item: item["latency_seconds"],
        reverse=True,
    )[:5]
    average_stage_seconds = _build_average_stage_seconds(success_rows)
    empty_success_responses = [
        row["question_id"]
        for row in success_rows
        if not row.get("somni_response", "").strip()
    ]
    short_success_responses = [
        row["question_id"]
        for row in success_rows
        if len(row.get("somni_response", "").strip()) < 40
    ]
    incomplete_success_responses = [
        row["question_id"]
        for row in success_rows
        if _looks_incomplete_response(row.get("somni_response", ""))
    ]
    duplicate_response_counts = Counter(
        _normalize_response(row.get("somni_response", ""))
        for row in success_rows
        if row.get("somni_response", "").strip()
    )
    suspicious_duplicates = {
        response: count
        for response, count in duplicate_response_counts.items()
        if response and count >= 3
    }

    return {
        "total_questions_in_scope": len(questions),
        "rows_written": len(rows),
        "successful_rows": len(success_rows),
        "failed_rows": len(failed_rows),
        "average_latency_seconds": round(statistics.mean(latencies), 3) if latencies else None,
        "slowest_rows": slowest_rows,
        "average_stage_seconds": average_stage_seconds,
        "empty_success_responses": empty_success_responses,
        "short_success_responses": short_success_responses,
        "incomplete_success_responses": incomplete_success_responses,
        "suspicious_duplicate_response_groups": len(suspicious_duplicates),
        "suspicious_duplicate_response_counts": suspicious_duplicates,
    }


def _format_summary_lines(summary: dict[str, object]) -> list[str]:
    return [
        f"Summary | total_questions_in_scope={summary['total_questions_in_scope']}",
        f"Summary | rows_written={summary['rows_written']}",
        f"Summary | successful_rows={summary['successful_rows']}",
        f"Summary | failed_rows={summary['failed_rows']}",
        f"Summary | average_latency_seconds={summary['average_latency_seconds']}",
        f"Summary | slowest_rows={summary['slowest_rows']}",
        f"Summary | average_stage_seconds={summary['average_stage_seconds']}",
        f"Summary | empty_success_responses={summary['empty_success_responses']}",
        f"Summary | short_success_responses={summary['short_success_responses']}",
        f"Summary | incomplete_success_responses={summary['incomplete_success_responses']}",
        "Summary | suspicious_duplicate_response_groups="
        f"{summary['suspicious_duplicate_response_groups']}",
    ]


def _build_average_stage_seconds(rows: list[dict[str, str]]) -> dict[str, float]:
    stage_values: dict[str, list[float]] = {}

    for row in rows:
        raw_timings = row.get("timings", "").strip()
        if not raw_timings:
            continue

        try:
            timings = json.loads(raw_timings)
        except json.JSONDecodeError:
            continue

        if not isinstance(timings, dict):
            continue

        stage_seconds = timings.get("stage_seconds")
        if not isinstance(stage_seconds, dict):
            continue

        for stage_name, value in stage_seconds.items():
            if isinstance(value, (int, float)):
                stage_values.setdefault(str(stage_name), []).append(float(value))

    averages = {
        stage_name: round(statistics.mean(values), 3)
        for stage_name, values in stage_values.items()
        if values
    }
    return dict(sorted(averages.items(), key=lambda item: item[1], reverse=True)[:8])


def _optional_float(value: str) -> float | None:
    try:
        if not value.strip():
            return None
        return round(float(value), 3)
    except ValueError:
        return None


def _classify_retryable_error(error_text: str) -> str:
    lowered = error_text.lower()
    if "timed out" in lowered:
        return "timeout"
    if "401" in lowered or "unauthorized" in lowered:
        return "auth_retry_failed"
    if "429" in lowered:
        return "rate_limited"
    return "failed"


def _build_state_payload(
    run_id: str,
    questions: list[QuestionRow],
    rows: list[dict[str, str]],
    *,
    started: bool,
) -> dict[str, object]:
    completed_question_ids = [row["question_id"] for row in rows]
    successful_rows = [row for row in rows if row["request_status"] == "success"]
    failed_rows = [row for row in rows if row["request_status"] != "success"]

    payload: dict[str, object] = {
        "run_id": run_id,
        "updated_at": _utc_now_iso(),
        "status": "running" if started else "finished",
        "total_questions_in_scope": len(questions),
        "completed_row_count": len(rows),
        "successful_row_count": len(successful_rows),
        "failed_row_count": len(failed_rows),
        "completed_question_ids": completed_question_ids,
    }
    return payload


def _load_state_file(state_path: Path) -> dict[str, object]:
    if not state_path.exists():
        return {}
    try:
        return json.loads(state_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write_state_file(state_path: Path, payload: dict[str, object]) -> None:
    state_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def _truncate_error(text: str, limit: int = 500) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 3]}..."


def _normalize_response(text: str) -> str:
    return " ".join(text.lower().split())


def _looks_incomplete_response(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True

    if len(stripped.split()) < 60:
        return True

    if stripped.lower().endswith(("check-in:", "check in:", "what to try tonight:")):
        return True

    return stripped[-1] not in ".!?)\"'✨💖"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


if __name__ == "__main__":
    raise SystemExit(main())
