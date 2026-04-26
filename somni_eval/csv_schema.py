from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from configuration import DEFAULT_ALLOWED_PERSONAS, ConfigError


REQUIRED_INPUT_COLUMNS = ("question_id", "target_persona", "question_text")
ADDITIONAL_OUTPUT_COLUMNS = (
    "retrieval",
    "sources",
    "confidence",
    "ttft_seconds",
)


@dataclass(frozen=True)
class QuestionRow:
    question_id: str
    target_persona: str
    question_text: str
    row_number: int


def load_expected_output_headers(template_path: Path) -> list[str]:
    if not template_path.exists():
        raise ConfigError(f"Output schema template not found: {template_path}")

    with template_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        headers = next(reader, None)

    if not headers:
        raise ConfigError(f"Output schema template is empty: {template_path}")

    cleaned_headers = [header.strip() for header in headers]
    for extra_header in ADDITIONAL_OUTPUT_COLUMNS:
        if extra_header not in cleaned_headers:
            cleaned_headers.append(extra_header)

    if len(cleaned_headers) != len(set(cleaned_headers)):
        raise ConfigError(f"Output schema template contains duplicate columns: {template_path}")
    return cleaned_headers


def load_questions(question_path: Path, max_questions: int | None = None) -> list[QuestionRow]:
    if not question_path.exists():
        raise ConfigError(f"Questions CSV not found: {question_path}")

    with question_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        _validate_input_headers(headers, question_path)

        question_ids: set[str] = set()
        rows: list[QuestionRow] = []

        for row_number, raw_row in enumerate(reader, start=2):
            question_id = (raw_row.get("question_id") or "").strip()
            target_persona = (raw_row.get("target_persona") or "").strip()
            question_text = (raw_row.get("question_text") or "").strip()

            if not question_id:
                raise ConfigError(f"Missing question_id at row {row_number} in {question_path}")
            if question_id in question_ids:
                raise ConfigError(f"Duplicate question_id '{question_id}' in {question_path}")
            question_ids.add(question_id)

            if target_persona not in DEFAULT_ALLOWED_PERSONAS:
                allowed = ", ".join(DEFAULT_ALLOWED_PERSONAS)
                raise ConfigError(
                    f"Invalid target_persona '{target_persona}' at row {row_number}. Expected one of: {allowed}"
                )

            if not question_text:
                raise ConfigError(
                    f"Missing question_text for question_id '{question_id}' at row {row_number}"
                )

            rows.append(
                QuestionRow(
                    question_id=question_id,
                    target_persona=target_persona,
                    question_text=question_text,
                    row_number=row_number,
                )
            )

            if max_questions is not None and len(rows) >= max_questions:
                break

    if not rows:
        raise ConfigError(f"No questions found in {question_path}")
    return rows


def read_existing_results(results_path: Path, expected_headers: list[str]) -> list[dict[str, str]]:
    if not results_path.exists():
        return []

    with results_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        if headers != expected_headers:
            raise ConfigError(
                "Existing results CSV schema does not match the expected template. "
                f"Expected {expected_headers}, found {headers}. File: {results_path}"
            )

        rows: list[dict[str, str]] = []
        for row_number, row in enumerate(reader, start=2):
            row_dict = {header: row.get(header, "") for header in expected_headers}
            validate_output_row(row_dict, expected_headers, row_number=row_number, source=results_path)
            rows.append(row_dict)

    return rows


def write_results_header(results_path: Path, expected_headers: list[str]) -> None:
    with results_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=expected_headers)
        writer.writeheader()


def append_result_row(results_path: Path, expected_headers: list[str], row: dict[str, str]) -> None:
    validate_output_row(row, expected_headers, row_number=None, source=results_path)
    with results_path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=expected_headers)
        writer.writerow(row)


def validate_output_row(
    row: dict[str, str],
    expected_headers: list[str],
    *,
    row_number: int | None,
    source: Path,
) -> None:
    row_keys = list(row.keys())
    if row_keys != expected_headers:
        raise ConfigError(
            f"Output row schema mismatch in {source}. Expected {expected_headers}, found {row_keys}"
        )

    required_non_empty = ("run_id", "test_date", "question_id", "target_persona", "question_text", "request_status")
    for field in required_non_empty:
        value = row.get(field, "")
        if not isinstance(value, str) or not value.strip():
            location = f" row {row_number}" if row_number else ""
            raise ConfigError(f"Missing required output value '{field}' in {source}{location}")


def _validate_input_headers(headers: list[str], question_path: Path) -> None:
    missing_columns = [column for column in REQUIRED_INPUT_COLUMNS if column not in headers]
    if missing_columns:
        missing_text = ", ".join(missing_columns)
        raise ConfigError(f"Questions CSV is missing required columns: {missing_text}. File: {question_path}")
