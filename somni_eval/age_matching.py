from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class ParsedAge:
    quantity: int
    unit: str


AGE_PATTERNS = (
    re.compile(
        r"\b(?P<quantity>\d+)\s*[- ]?(?P<unit>week|weeks|month|months|year|years)\s*[- ]?old\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?P<quantity>\d+)\s*[- ]?(?P<unit>week|weeks|month|months|year|years)\s+old\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?P<quantity>\d+)\s*[- ]?(?P<unit>week|weeks|month|months|year|years)\b",
        re.IGNORECASE,
    ),
)


MALE_PRONOUN_TOKENS = {"he", "him", "his"}
FEMALE_PRONOUN_TOKENS = {"she", "her", "hers"}


def parse_age_from_question(question_text: str) -> ParsedAge | None:
    text = question_text.strip()
    if not text:
        return None

    lowered = text.lower()
    if "newborn" in lowered:
        return ParsedAge(quantity=2, unit="weeks")

    for pattern in AGE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue

        quantity = int(match.group("quantity"))
        unit = match.group("unit").lower()
        return ParsedAge(quantity=quantity, unit=unit)

    return None


def extract_implied_gender_from_question(question_text: str) -> str | None:
    text = question_text.strip().lower()
    if not text:
        return None

    tokens = set(re.findall(r"\b[a-z']+\b", text))
    has_male = bool(tokens.intersection(MALE_PRONOUN_TOKENS))
    has_female = bool(tokens.intersection(FEMALE_PRONOUN_TOKENS))

    if has_male and not has_female:
        return "male"
    if has_female and not has_male:
        return "female"
    return None


def derive_date_of_birth_from_question(question_text: str, today: date | None = None) -> str | None:
    parsed_age = parse_age_from_question(question_text)
    if parsed_age is None:
        return None

    reference_date = today or date.today()
    age_in_days = _age_to_days(parsed_age)
    date_of_birth = reference_date - timedelta(days=age_in_days)
    return date_of_birth.isoformat()


def _age_to_days(parsed_age: ParsedAge) -> int:
    unit = parsed_age.unit.rstrip("s")
    quantity = parsed_age.quantity

    if unit == "week":
        return quantity * 7
    if unit == "month":
        # A simple month approximation is good enough for broad Somni age-band matching.
        return round(quantity * 30.4375)
    if unit == "year":
        return round(quantity * 365.25)

    raise ValueError(f"Unsupported age unit: {parsed_age.unit}")
