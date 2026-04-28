from __future__ import annotations

import base64
import json
import socket
import time
from dataclasses import dataclass
from typing import Any, Protocol
from urllib.parse import urlparse

import requests

from age_matching import derive_date_of_birth_from_question, extract_implied_gender_from_question
from configuration import EvalConfig, PersonaAccount


USER_AGENT = "somni-eval-runner/1.0"


class AdapterError(Exception):
    """Base class for transport errors."""


class RetryableAdapterError(AdapterError):
    """A temporary problem occurred and a retry is reasonable."""


class FatalAdapterError(AdapterError):
    """A permanent problem occurred and retrying will not help."""


@dataclass(frozen=True)
class AdapterResult:
    response_text: str
    retrieval: dict[str, object] | None = None
    sources: list[object] | None = None
    confidence: str = ""
    ttft_seconds: float | None = None


class SomniAdapter(Protocol):
    def validate_environment(self) -> None:
        ...

    def send_question(self, persona: str, question_text: str, timeout_seconds: int, conversation_id: str = "") -> AdapterResult:
        ...


class DryRunAdapter:
    def __init__(self, config: EvalConfig) -> None:
        self._config = config

    def validate_environment(self) -> None:
        return None

    def send_question(self, persona: str, question_text: str, timeout_seconds: int, conversation_id: str = "") -> AdapterResult:
        derived_dob = derive_date_of_birth_from_question(question_text)
        response = (
            "[DRY RUN] Somni adapter was not called. "
            f"Persona={persona}. Derived DOB={derived_dob or 'not-found'}. "
            f"Question preview={question_text[:120]}"
        )
        return AdapterResult(response_text=response)


@dataclass(frozen=True)
class PersonaSession:
    cookie_header: str
    user_id: str


class SomniApiAdapter:
    def __init__(self, config: EvalConfig) -> None:
        self._config = config
        self._base_url = config.transport.base_url.rstrip("/")
        self._chat_url = f"{self._base_url}/api/chat"
        self._supabase_auth_url = f"{config.transport.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
        self._rest_url = f"{config.transport.supabase_url.rstrip('/')}/rest/v1"
        self._session_cache: dict[str, PersonaSession] = {}
        self._http = requests.Session()
        self._http.headers.update({"User-Agent": USER_AGENT})

    def validate_environment(self) -> None:
        try:
            response = self._http.get(self._base_url, timeout=15)
        except requests.RequestException as exc:
            raise FatalAdapterError(
                f"Could not reach Somni at {self._base_url}. "
                "Make sure the app is running before starting the eval."
            ) from exc

        if response.status_code >= 500:
            raise FatalAdapterError(
                f"Somni is reachable but unhealthy at {self._base_url} (HTTP {response.status_code})."
            )

    def send_question(self, persona: str, question_text: str, timeout_seconds: int, conversation_id: str = "") -> AdapterResult:
        persona_session = self._session_cache.get(persona)
        if not persona_session:
            persona_session = self._login(persona, self._config.transport.persona_accounts[persona])
            self._session_cache[persona] = persona_session

        self._apply_age_match(persona_session, question_text)

        try:
            return self._post_chat(persona_session.cookie_header, question_text, timeout_seconds, conversation_id)
        except RetryableAdapterError as exc:
            message = str(exc).lower()
            if "401" in message or "unauthorized" in message:
                self._session_cache.pop(persona, None)
            raise

    def _login(self, persona: str, account: PersonaAccount) -> PersonaSession:
        headers = {
            "apikey": self._config.transport.supabase_anon_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {"email": account.email, "password": account.password}

        try:
            response = self._http.post(
                self._supabase_auth_url,
                headers=headers,
                json=payload,
                timeout=30,
            )
        except requests.RequestException as exc:
            raise RetryableAdapterError(
                f"Login request failed for persona '{persona}': {exc}"
            ) from exc

        if response.status_code in (429, 500, 502, 503, 504):
            raise RetryableAdapterError(
                f"Temporary login failure for persona '{persona}': HTTP {response.status_code} {response.text[:200]}"
            )
        if response.status_code >= 400:
            raise FatalAdapterError(
                f"Login failed for persona '{persona}': HTTP {response.status_code} {response.text[:200]}"
            )

        session_payload = response.json()
        if "access_token" not in session_payload or "refresh_token" not in session_payload:
            raise FatalAdapterError(
                f"Supabase login response for persona '{persona}' did not include a usable session."
            )
        user_id = str(session_payload.get("user", {}).get("id", "")).strip()
        if not user_id:
            raise FatalAdapterError(
                f"Supabase login response for persona '{persona}' did not include a user id."
            )

        project_ref = _project_ref_from_supabase_url(self._config.transport.supabase_url)
        encoded_session = _base64url_json(session_payload)
        cookie_header = f"sb-{project_ref}-auth-token=base64-{encoded_session}"
        return PersonaSession(cookie_header=cookie_header, user_id=user_id)

    def _apply_age_match(self, persona_session: PersonaSession, question_text: str) -> None:
        derived_dob = derive_date_of_birth_from_question(question_text)
        implied_gender = extract_implied_gender_from_question(question_text)
        gender_to_name = {
            "male": "Ari",
            "female": "Aria",
        }
        desired_name = gender_to_name.get(implied_gender) if implied_gender else None

        if not derived_dob and not implied_gender:
            return

        rest_headers = {
            "apikey": self._config.transport.supabase_service_role_key,
            "Authorization": f"Bearer {self._config.transport.supabase_service_role_key}",
            "Accept": "application/json",
        }

        try:
            baby_response = self._http.get(
                f"{self._rest_url}/babies",
                headers={**rest_headers, "Accept-Profile": "public"},
                params={
                    "select": "*",
                    "profile_id": f"eq.{persona_session.user_id}",
                    "order": "created_at.asc",
                    "limit": "1",
                },
                timeout=30,
            )
        except requests.RequestException as exc:
            raise RetryableAdapterError(f"Failed to load baby profile for age matching: {exc}") from exc

        if baby_response.status_code in (429, 500, 502, 503, 504):
            raise RetryableAdapterError(
                f"Temporary failure loading baby profile for age matching: HTTP {baby_response.status_code} {baby_response.text[:200]}"
            )
        if baby_response.status_code >= 400:
            raise FatalAdapterError(
                f"Could not load baby profile for age matching: HTTP {baby_response.status_code} {baby_response.text[:200]}"
            )

        babies = baby_response.json()
        if not isinstance(babies, list) or not babies:
            raise FatalAdapterError(
                "Age matching could not find a baby record for the selected persona account."
            )

        baby_id = str(babies[0].get("id", "")).strip()
        if not baby_id:
            raise FatalAdapterError("Age matching found a baby row without an id.")

        update_payload: dict[str, Any] = {}
        current_dob = str(babies[0].get("date_of_birth", "")).strip()
        if derived_dob and current_dob != derived_dob:
            update_payload["date_of_birth"] = derived_dob

        if implied_gender:
            current_name = str(babies[0].get("name", "")).strip()
            if desired_name and current_name != desired_name:
                update_payload["name"] = desired_name

            current_gender = babies[0].get("gender")
            if not isinstance(current_gender, str) or current_gender.strip().lower() != implied_gender:
                update_payload["gender"] = implied_gender

        if not update_payload:
            return

        self._patch_baby_for_age_match(rest_headers, baby_id, update_payload)

    def _patch_baby_for_age_match(
        self,
        rest_headers: dict[str, str],
        baby_id: str,
        update_payload: dict[str, Any],
    ) -> None:
        patch_headers = {
            **rest_headers,
            "Accept-Profile": "public",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

        try:
            update_response = self._http.patch(
                f"{self._rest_url}/babies",
                headers=patch_headers,
                params={"id": f"eq.{baby_id}"},
                json=update_payload,
                timeout=30,
            )
        except requests.RequestException as exc:
            raise RetryableAdapterError(f"Failed to update baby profile for age matching: {exc}") from exc

        if (
            update_response.status_code >= 400
            and "gender" in update_payload
            and _is_missing_gender_column_error(update_response)
        ):
            fallback_payload = dict(update_payload)
            fallback_payload.pop("gender", None)
            if not fallback_payload:
                return

            try:
                update_response = self._http.patch(
                    f"{self._rest_url}/babies",
                    headers=patch_headers,
                    params={"id": f"eq.{baby_id}"},
                    json=fallback_payload,
                    timeout=30,
                )
            except requests.RequestException as exc:
                raise RetryableAdapterError(
                    f"Failed to update baby profile for age matching fallback: {exc}"
                ) from exc

        if update_response.status_code in (429, 500, 502, 503, 504):
            raise RetryableAdapterError(
                "Temporary failure updating baby profile for age matching: "
                f"HTTP {update_response.status_code} {update_response.text[:200]}"
            )
        if update_response.status_code >= 400:
            raise FatalAdapterError(
                "Could not update baby profile for age matching: "
                f"HTTP {update_response.status_code} {update_response.text[:200]}"
            )

    def _post_chat(self, cookie_header: str, question_text: str, timeout_seconds: int, conversation_id: str = "") -> AdapterResult:
        headers = {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "Cookie": cookie_header,
        }
        if self._config.transport.send_eval_mode_header:
            headers["x-eval-mode"] = "true"

        request_started_at = time.perf_counter()
        try:
            payload = {"message": question_text}
            if conversation_id:
                payload["conversationId"] = conversation_id

            response = self._http.post(
                self._chat_url,
                headers=headers,
                json=payload,
                stream=True,
                timeout=(15, timeout_seconds),
            )
        except requests.Timeout as exc:
            raise RetryableAdapterError(
                f"Chat request timed out after {timeout_seconds} seconds."
            ) from exc
        except (requests.ConnectionError, socket.timeout) as exc:
            raise RetryableAdapterError(f"Network error while calling /api/chat: {exc}") from exc
        except requests.RequestException as exc:
            raise RetryableAdapterError(f"Chat request failed before response: {exc}") from exc

        if response.status_code in (401, 429, 500, 502, 503, 504):
            raise RetryableAdapterError(
                f"/api/chat temporary failure: HTTP {response.status_code} {response.text[:200]}"
            )
        if response.status_code >= 400:
            raise FatalAdapterError(
                f"/api/chat permanent failure: HTTP {response.status_code} {response.text[:200]}"
            )

        result = _read_sse_response_text(response, request_started_at)
        if not result.response_text.strip():
            raise RetryableAdapterError("Chat stream returned an empty assistant response.")
        return result


def create_adapter(config: EvalConfig) -> SomniAdapter:
    if config.run.dry_run:
        return DryRunAdapter(config)
    if config.transport.transport_type == "somni_api":
        return SomniApiAdapter(config)
    raise FatalAdapterError(
        f"Unsupported transport type '{config.transport.transport_type}'. "
        "Use 'somni_api' or run with --dry-run."
    )


def _read_sse_response_text(response: requests.Response, request_started_at: float) -> AdapterResult:
    event_lines: list[str] = []
    streamed_messages: dict[int, str] = {}
    done_messages: dict[int, str] = {}
    done_retrieval: dict[str, object] | None = None
    done_sources: list[object] | None = None
    done_confidence = ""
    error_message = ""
    first_token_at: float | None = None

    def apply_event(event_name: str, payload: dict[str, object]) -> None:
        nonlocal done_retrieval, done_sources, done_confidence
        nonlocal error_message, first_token_at

        if event_name == "token" and isinstance(payload.get("text"), str):
            if first_token_at is None:
                first_token_at = time.perf_counter()
            message_index = _parse_message_index(payload.get("message_index"))
            streamed_messages[message_index] = streamed_messages.get(message_index, "") + payload["text"]
            return

        if event_name == "done":
            if isinstance(payload.get("message"), str):
                message_index = _parse_message_index(payload.get("message_index"))
                done_messages[message_index] = payload["message"]
            retrieval = payload.get("retrieval")
            if isinstance(retrieval, dict):
                done_retrieval = retrieval
            sources = payload.get("sources")
            if isinstance(sources, list):
                done_sources = sources
            confidence = payload.get("confidence")
            if isinstance(confidence, str):
                done_confidence = confidence
            return

        if event_name == "error":
            human_message = str(payload.get("error", "Unknown chat error"))
            detail = str(payload.get("detail", "")).strip()
            error_message = f"{human_message} {detail}".strip()

    for raw_line in response.iter_lines(decode_unicode=True):
        if raw_line is None:
            continue

        line = raw_line.strip()
        if line == "":
            event_name, payload = _parse_sse_event(event_lines)
            event_lines.clear()
            if event_name:
                apply_event(event_name, payload)
            continue

        event_lines.append(line)

    if event_lines:
        event_name, payload = _parse_sse_event(event_lines)
        if event_name:
            apply_event(event_name, payload)

    if error_message:
        raise RetryableAdapterError(f"Chat stream error: {error_message}")

    final_message = _combine_sse_messages(streamed_messages, done_messages)
    if not final_message:
        raise RetryableAdapterError("Chat stream finished without a usable response message.")

    ttft_seconds = None
    if first_token_at is not None:
        ttft_seconds = max(0.0, first_token_at - request_started_at)

    return AdapterResult(
        response_text=final_message,
        retrieval=done_retrieval,
        sources=done_sources,
        confidence=done_confidence,
        ttft_seconds=ttft_seconds,
    )


def _parse_message_index(value: object) -> int:
    if isinstance(value, int) and value > 0:
        return value
    if isinstance(value, str) and value.isdigit():
        return max(1, int(value))
    return 1


def _is_complete_message(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False

    if stripped.lower().endswith(("check-in:", "check in:", "what to try tonight:")):
        return False

    return stripped[-1] in ".!?)\"'"


def _best_message_part(streamed_text: str, done_text: str) -> str:
    streamed_text = streamed_text.strip()
    done_text = done_text.strip()

    if not streamed_text:
        return done_text
    if not done_text:
        return streamed_text
    if _is_complete_message(done_text) and (
        not _is_complete_message(streamed_text) or len(done_text) >= len(streamed_text)
    ):
        return done_text
    if len(done_text) > len(streamed_text) * 1.2:
        return done_text
    return streamed_text


def _combine_sse_messages(streamed_messages: dict[int, str], done_messages: dict[int, str]) -> str:
    message_indexes = sorted(set(streamed_messages) | set(done_messages))
    parts = [
        _best_message_part(streamed_messages.get(index, ""), done_messages.get(index, ""))
        for index in message_indexes
    ]
    return "\n\n".join(part for part in parts if part.strip()).strip()


def _parse_sse_event(lines: list[str]) -> tuple[str, dict[str, object]]:
    if not lines:
        return "", {}

    event_name = ""
    payload_text = ""
    for line in lines:
        if line.startswith("event:"):
            event_name = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            payload_text = line.split(":", 1)[1].strip()

    if not event_name or not payload_text:
        return "", {}

    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError:
        return "", {}
    return event_name, payload if isinstance(payload, dict) else {}


def _project_ref_from_supabase_url(supabase_url: str) -> str:
    hostname = urlparse(supabase_url).hostname or ""
    if not hostname:
        raise FatalAdapterError(f"Could not parse Supabase hostname from {supabase_url}")
    return hostname.split(".")[0]


def _base64url_json(payload: dict[str, object]) -> str:
    raw_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw_bytes).decode("ascii").rstrip("=")


def _is_missing_gender_column_error(response: requests.Response) -> bool:
    text = response.text.lower()
    return "gender" in text and (
        "column" in text
        and ("does not exist" in text or "unknown" in text or "not found" in text or "not find" in text)
    )
