from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = REPO_ROOT / "somni_eval" / "config.json"
DEFAULT_ALLOWED_PERSONAS = ("gentle", "balanced", "fast-track")


class ConfigError(Exception):
    """Raised when the evaluation config is missing or invalid."""


@dataclass(frozen=True)
class RunSettings:
    run_id: str
    delay_seconds: int
    request_timeout_seconds: int
    max_retries: int
    retry_backoff_seconds: int
    max_questions: int | None
    dry_run: bool


@dataclass(frozen=True)
class MetadataSettings:
    app_version: str
    model_name: str
    model_provider: str
    prompt_version: str
    corpus_version: str
    rag_version: str


@dataclass(frozen=True)
class PathsSettings:
    questions_csv: Path
    schema_template_csv: Path
    results_dir: Path
    logs_dir: Path
    state_dir: Path


@dataclass(frozen=True)
class PersonaAccount:
    email: str
    password: str


@dataclass(frozen=True)
class TransportSettings:
    transport_type: str
    base_url: str
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    send_eval_mode_header: bool
    persona_accounts: dict[str, PersonaAccount]


@dataclass(frozen=True)
class EvalConfig:
    config_path: Path
    run: RunSettings
    metadata: MetadataSettings
    paths: PathsSettings
    transport: TransportSettings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Somni evaluation harness against the benchmark CSV."
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help="Path to the JSON config file. Default: somni_eval/config.json",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume an existing run_id instead of creating a fresh run.",
    )
    parser.add_argument(
        "--run-id",
        default="",
        help="Optional explicit run_id. Useful when resuming or naming a run manually.",
    )
    parser.add_argument(
        "--max-questions",
        type=int,
        default=None,
        help="Optional limit for smoke tests, for example 5.",
    )
    parser.add_argument(
        "--delay-seconds",
        type=int,
        default=None,
        help="Optional override for the delay between questions.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not call the real app. Return a predictable placeholder response instead.",
    )
    return parser.parse_args()


def load_config(args: argparse.Namespace) -> EvalConfig:
    config_path = Path(args.config).expanduser().resolve()
    if not config_path.exists():
        raise ConfigError(
            f"Config file not found: {config_path}. Start from somni_eval/config.json."
        )

    raw_config = json.loads(config_path.read_text(encoding="utf-8"))
    env_defaults = _load_env_file(REPO_ROOT / ".env.local")

    run_id = _resolve_run_id(raw_config, args)
    run_settings = RunSettings(
        run_id=run_id,
        delay_seconds=_resolve_delay_seconds(raw_config, args),
        request_timeout_seconds=_read_int(
            raw_config, ("run", "request_timeout_seconds"), default=180, minimum=1
        ),
        max_retries=_read_int(raw_config, ("run", "max_retries"), default=2, minimum=0),
        retry_backoff_seconds=_read_int(
            raw_config, ("run", "retry_backoff_seconds"), default=15, minimum=0
        ),
        max_questions=_resolve_max_questions(raw_config, args),
        dry_run=bool(args.dry_run or _read_bool(raw_config, ("run", "dry_run"), default=False)),
    )

    metadata = MetadataSettings(
        app_version=_read_string(raw_config, ("metadata", "app_version"), default=""),
        model_name=_read_string(raw_config, ("metadata", "model_name"), default=""),
        model_provider=_read_string(raw_config, ("metadata", "model_provider"), default=""),
        prompt_version=_read_string(raw_config, ("metadata", "prompt_version"), default=""),
        corpus_version=_read_string(raw_config, ("metadata", "corpus_version"), default=""),
        rag_version=_read_string(raw_config, ("metadata", "rag_version"), default=""),
    )

    paths = PathsSettings(
        questions_csv=_resolve_path(
            config_path, _read_string(raw_config, ("paths", "questions_csv"), required=True)
        ),
        schema_template_csv=_resolve_path(
            config_path,
            _read_string(raw_config, ("paths", "schema_template_csv"), required=True),
        ),
        results_dir=_resolve_path(
            config_path, _read_string(raw_config, ("paths", "output_results_dir"), required=True)
        ),
        logs_dir=_resolve_path(
            config_path, _read_string(raw_config, ("paths", "output_logs_dir"), required=True)
        ),
        state_dir=_resolve_path(
            config_path, _read_string(raw_config, ("paths", "output_state_dir"), required=True)
        ),
    )

    raw_persona_accounts = _read_mapping(raw_config, ("transport", "persona_accounts"))
    persona_accounts: dict[str, PersonaAccount] = {}
    for persona_name in DEFAULT_ALLOWED_PERSONAS:
        persona_data = raw_persona_accounts.get(persona_name)
        if not isinstance(persona_data, dict):
            raise ConfigError(
                f"Missing transport.persona_accounts.{persona_name} in {config_path}"
            )
        persona_accounts[persona_name] = PersonaAccount(
            email=_require_non_empty_string(
                persona_data.get("email"),
                f"transport.persona_accounts.{persona_name}.email",
            ),
            password=_require_non_empty_string(
                persona_data.get("password"),
                f"transport.persona_accounts.{persona_name}.password",
            ),
        )

    transport = TransportSettings(
        transport_type=_read_string(
            raw_config, ("transport", "type"), default="somni_api"
        ).strip()
        or "somni_api",
        base_url=_resolve_env_or_config(
            raw_config,
            env_defaults,
            env_name="SOMNI_EVAL_BASE_URL",
            config_path=("transport", "base_url"),
            default="http://127.0.0.1:3000",
        ),
        supabase_url=_resolve_env_or_config(
            raw_config,
            env_defaults,
            env_name="NEXT_PUBLIC_SUPABASE_URL",
            config_path=("transport", "supabase_url"),
            required=not run_settings.dry_run,
        ),
        supabase_anon_key=_resolve_env_or_config(
            raw_config,
            env_defaults,
            env_name="NEXT_PUBLIC_SUPABASE_ANON_KEY",
            config_path=("transport", "supabase_anon_key"),
            required=not run_settings.dry_run,
        ),
        supabase_service_role_key=_resolve_env_or_config(
            raw_config,
            env_defaults,
            env_name="SUPABASE_SERVICE_ROLE_KEY",
            config_path=("transport", "supabase_service_role_key"),
            required=not run_settings.dry_run,
        ),
        send_eval_mode_header=_read_bool(
            raw_config, ("transport", "send_eval_mode_header"), default=True
        ),
        persona_accounts=persona_accounts,
    )

    return EvalConfig(
        config_path=config_path,
        run=run_settings,
        metadata=metadata,
        paths=paths,
        transport=transport,
    )


def ensure_directories(paths: PathsSettings) -> None:
    for directory in (paths.results_dir, paths.logs_dir, paths.state_dir):
        directory.mkdir(parents=True, exist_ok=True)


def results_file_path(config: EvalConfig) -> Path:
    return config.paths.results_dir / f"run_results_{config.run.run_id}.csv"


def run_log_path(config: EvalConfig) -> Path:
    return config.paths.logs_dir / f"{config.run.run_id}.log"


def error_log_path(config: EvalConfig) -> Path:
    return config.paths.logs_dir / f"{config.run.run_id}.errors.log"


def state_file_path(config: EvalConfig) -> Path:
    return config.paths.state_dir / f"run_state_{config.run.run_id}.json"


def _resolve_run_id(raw_config: dict[str, Any], args: argparse.Namespace) -> str:
    explicit_run_id = (args.run_id or "").strip()
    config_run_id = _read_string(raw_config, ("run", "run_id"), default="").strip()

    if explicit_run_id:
        return explicit_run_id
    if config_run_id:
        return config_run_id

    timestamp = datetime.now().strftime("%Y_%m_%d_%H%M%S")
    run_label = _read_string(raw_config, ("run", "run_label"), default="").strip()
    return f"{timestamp}_{run_label}" if run_label else timestamp


def _resolve_max_questions(raw_config: dict[str, Any], args: argparse.Namespace) -> int | None:
    if args.max_questions is not None:
        if args.max_questions <= 0:
            return None
        return args.max_questions

    configured_value = _read_int(raw_config, ("run", "max_questions"), default=0, minimum=0)
    return configured_value or None


def _resolve_delay_seconds(raw_config: dict[str, Any], args: argparse.Namespace) -> int:
    if args.delay_seconds is not None:
        if args.delay_seconds < 0:
            raise ConfigError("--delay-seconds cannot be negative.")
        return args.delay_seconds

    configured_delay = _read_int(raw_config, ("run", "delay_seconds"), default=60, minimum=0)
    if args.dry_run and configured_delay == 60:
        return 0
    return configured_delay


def _resolve_path(config_path: Path, raw_value: str) -> Path:
    path = Path(raw_value).expanduser()
    if not path.is_absolute():
        path = (config_path.parent / path).resolve()
    return path


def _resolve_env_or_config(
    raw_config: dict[str, Any],
    env_defaults: dict[str, str],
    *,
    env_name: str,
    config_path: tuple[str, ...],
    default: str = "",
    required: bool = False,
) -> str:
    value = os.environ.get(env_name) or env_defaults.get(env_name)
    if value:
        return value

    config_value = _read_string(raw_config, config_path, default=default).strip()
    if config_value:
        return config_value

    if required:
        joined_path = ".".join(config_path)
        raise ConfigError(
            f"Missing required value for {joined_path}. Set it in config or {env_name}."
        )
    return config_value


def _load_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    loaded: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        loaded[key.strip()] = value.strip().strip('"').strip("'")
    return loaded


def _read_mapping(raw_config: dict[str, Any], path_parts: tuple[str, ...]) -> dict[str, Any]:
    current: Any = raw_config
    for part in path_parts:
        if not isinstance(current, dict) or part not in current:
            raise ConfigError(f"Missing required config section: {'.'.join(path_parts)}")
        current = current[part]
    if not isinstance(current, dict):
        raise ConfigError(f"Expected a JSON object at {'.'.join(path_parts)}")
    return current


def _read_string(
    raw_config: dict[str, Any],
    path_parts: tuple[str, ...],
    *,
    default: str = "",
    required: bool = False,
) -> str:
    current: Any = raw_config
    for part in path_parts:
        if not isinstance(current, dict) or part not in current:
            if required:
                raise ConfigError(f"Missing required config value: {'.'.join(path_parts)}")
            return default
        current = current[part]

    if current is None:
        if required:
            raise ConfigError(f"Missing required config value: {'.'.join(path_parts)}")
        return default

    if not isinstance(current, str):
        raise ConfigError(f"Expected text for config value {'.'.join(path_parts)}")
    return current


def _read_int(
    raw_config: dict[str, Any],
    path_parts: tuple[str, ...],
    *,
    default: int,
    minimum: int | None = None,
) -> int:
    current: Any = raw_config
    for part in path_parts:
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]

    try:
        value = int(current)
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"Expected whole number for config value {'.'.join(path_parts)}") from exc

    if minimum is not None and value < minimum:
        raise ConfigError(
            f"Config value {'.'.join(path_parts)} must be at least {minimum}, got {value}"
        )
    return value


def _read_bool(
    raw_config: dict[str, Any],
    path_parts: tuple[str, ...],
    *,
    default: bool,
) -> bool:
    current: Any = raw_config
    for part in path_parts:
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]

    if isinstance(current, bool):
        return current
    if isinstance(current, str):
        normalized = current.strip().lower()
        if normalized in {"true", "1", "yes", "y"}:
            return True
        if normalized in {"false", "0", "no", "n"}:
            return False

    raise ConfigError(f"Expected true/false for config value {'.'.join(path_parts)}")


def _require_non_empty_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"Missing required text value: {label}")
    return value.strip()
