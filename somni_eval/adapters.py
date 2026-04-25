from __future__ import annotations

import base64
import json
import socket
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlparse

import requests

from age_matching import derive_date_of_birth_from_question
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


class SomniAdapter(Protocol):
    def validate_environment(self) -> None:
        ...

    def send_question(self, persona: str, question_text: str, timeout_seconds: int) -> AdapterResult:
        ...


class DryRunAdapter:
    def __init__(self, config: EvalConfig) -> None:
        self._config = config

    def validate_environment(self) -> None:
        return None

    def send_question(self, persona: str, question_text: str, timeout_seconds: int) -> AdapterResult:
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

    def send_question(self, persona: str, question_text: str, timeout_seconds: int) -> AdapterResult:
        persona_session = self._session_cache.get(persona)
        if not persona_session:
            persona_session = self._login(persona, self._config.transport.persona_accounts[persona])
            self._session_cache[persona] = persona_session

        self._apply_age_match(persona_session, question_text)

        try:
            return self._post_chat(persona_session.cookie_header, question_text, timeout_seconds)
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
        if not derived_dob:
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
                    "select": "id,date_of_birth",
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

        current_dob = str(babies[0].get("date_of_birth", "")).strip()
        if current_dob == derived_dob:
            return

        try:
            update_response = self._http.patch(
                f"{self._rest_url}/babies",
                headers={
                    **rest_headers,
                    "Accept-Profile": "public",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                params={"id": f"eq.{baby_id}"},
                json={"date_of_birth": derived_dob},
                timeout=30,
            )
        except requests.RequestException as exc:
            raise RetryableAdapterError(f"Failed to update baby DOB for age matching: {exc}") from exc

        if update_response.status_code in (429, 500, 502, 503, 504):
            raise RetryableAdapterError(
                f"Temporary failure updating baby DOB for age matching: HTTP {update_response.status_code} {update_response.text[:200]}"
            )
        if update_response.status_code >= 400:
            raise FatalAdapterError(
                f"Could not update baby DOB for age matching: HTTP {update_response.status_code} {update_response.text[:200]}"
            )

    def _post_chat(self, cookie_header: str, question_text: str, timeout_seconds: int) -> AdapterResult:
        headers = {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "Cookie": cookie_header,
        }
        if self._config.transport.send_eval_mode_header:
            headers["x-eval-mode"] = "true"

        try:
            response = self._http.post(
                self._chat_url,
                headers=headers,
                json={"message": question_text},
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

        response_text = _read_sse_response_text(response)
        if not response_text.strip():
            raise RetryableAdapterError("Chat stream returned an empty assistant response.")
        return AdapterResult(response_text=response_text)


def create_adapter(config: EvalConfig) -> SomniAdapter:
    if config.run.dry_run:
        return DryRunAdapter(config)
    if config.transport.transport_type == "somni_api":
        return SomniApiAdapter(config)
    raise FatalAdapterError(
        f"Unsupported transport type '{config.transport.transport_type}'. "
        "Use 'somni_api' or run with --dry-run."
    )


def _read_sse_response_text(response: requests.Response) -> str:
    event_lines: list[str] = []
    streamed_text = ""
    done_message = ""
    error_message = ""

    for raw_line in response.iter_lines(decode_unicode=True):
        if raw_line is None:
            continue

        line = raw_line.strip()
        if line == "":
            event_name, payload = _parse_sse_event(event_lines)
            event_lines.clear()
            if not event_name:
                continue

            if event_name == "token" and isinstance(payload.get("text"), str):
                streamed_text += payload["text"]
            elif event_name == "done" and isinstance(payload.get("message"), str):
                done_message = payload["message"]
            elif event_name == "error":
                human_message = str(payload.get("error", "Unknown chat error"))
                detail = str(payload.get("detail", "")).strip()
                error_message = f"{human_message} {detail}".strip()
            continue

        event_lines.append(line)

    if event_lines:
        event_name, payload = _parse_sse_event(event_lines)
        if event_name == "token" and isinstance(payload.get("text"), str):
            streamed_text += payload["text"]
        elif event_name == "done" and isinstance(payload.get("message"), str):
            done_message = payload["message"]
        elif event_name == "error":
            human_message = str(payload.get("error", "Unknown chat error"))
            detail = str(payload.get("detail", "")).strip()
            error_message = f"{human_message} {detail}".strip()

    if error_message:
        raise RetryableAdapterError(f"Chat stream error: {error_message}")

    final_message = streamed_text.strip() or done_message.strip()
    if not final_message:
        raise RetryableAdapterError("Chat stream finished without a usable response message.")
    return final_message


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
