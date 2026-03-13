#!/usr/bin/env python3
"""
Scrape FantasyPros consensus draft rankings for Standard, Half-PPR, and PPR, then overwrite:
  src/data/consensus.csv

This is designed to mirror the project's KTC daily updater pattern.
"""
from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from io import StringIO
from pathlib import Path

import pandas as pd
import requests


URLS = {
    "standard": "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php",
    "halfPpr": "https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php",
    "ppr": "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php",
}

MIN_ROWS_BY_FORMAT = {
    "standard": 200,
    "halfPpr": 200,
    "ppr": 250,
}

OUT_CSV = Path("src/data/consensus.csv")
RANKINGS_TS = Path("src/data/rankings.ts")

TEAM_ALIASES = {
    "JAC": "JAX",
    "WSH": "WAS",
    "ARZ": "ARI",
    "GNB": "GB",
    "KAN": "KC",
    "LVR": "LV",
    "NOR": "NO",
    "NWE": "NE",
    "SFO": "SF",
    "TAM": "TB",
}

VALID_TEAM_CODES = {
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET",
    "GB", "HOU", "IND", "JAX", "KC", "LV", "LAC", "LAR", "MIA", "MIN", "NE",
    "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
}

TEAM_NAME_TO_CODE = {
    "arizona cardinals": "ARI",
    "atlanta falcons": "ATL",
    "baltimore ravens": "BAL",
    "buffalo bills": "BUF",
    "carolina panthers": "CAR",
    "chicago bears": "CHI",
    "cincinnati bengals": "CIN",
    "cleveland browns": "CLE",
    "dallas cowboys": "DAL",
    "denver broncos": "DEN",
    "detroit lions": "DET",
    "green bay packers": "GB",
    "houston texans": "HOU",
    "indianapolis colts": "IND",
    "jacksonville jaguars": "JAX",
    "kansas city chiefs": "KC",
    "las vegas raiders": "LV",
    "los angeles chargers": "LAC",
    "los angeles rams": "LAR",
    "miami dolphins": "MIA",
    "minnesota vikings": "MIN",
    "new england patriots": "NE",
    "new orleans saints": "NO",
    "new york giants": "NYG",
    "new york jets": "NYJ",
    "philadelphia eagles": "PHI",
    "pittsburgh steelers": "PIT",
    "san francisco 49ers": "SF",
    "seattle seahawks": "SEA",
    "tampa bay buccaneers": "TB",
    "tennessee titans": "TEN",
    "washington commanders": "WAS",
}

STATUS_TOKENS = {
    "O", "Q", "D", "IR", "PUP", "NFI", "SUSP", "OUT", "QUESTIONABLE", "DOUBTFUL",
}

NAME_ALIASES = {
    "pat mahomes": "patrick mahomes",
    "hollywood brown": "marquise brown",
    "tank dell": "nathaniel dell",
    "jeff wilson": "jeff wilson jr",
    "kenneth walker": "kenneth walker iii",
    "brian robinson": "brian robinson jr",
    "marvin mims": "marvin mims jr",
    "travis etienne": "travis etienne jr",
    "j k dobbins": "jk dobbins",
    "d k metcalf": "dk metcalf",
    "d j moore": "dj moore",
    "t j hockenson": "tj hockenson",
    "a j brown": "aj brown",
}

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


@dataclass(frozen=True)
class BasePlayer:
    id: str
    name: str
    position: str
    team: str | None


def flatten_columns(columns) -> list[str]:
    flat: list[str] = []
    for col in columns:
        if isinstance(col, tuple):
            pieces = [
                str(piece).strip()
                for piece in col
                if str(piece).strip() and str(piece).strip().lower() != "nan"
            ]
            flat.append(" ".join(pieces).strip())
        else:
            flat.append(str(col).strip())
    return flat


def find_column(columns: list[str], *needles: str) -> str:
    lowered = {col: col.lower() for col in columns}
    for col, low in lowered.items():
        if all(needle.lower() in low for needle in needles):
            return col
    raise KeyError(f"Could not find column containing: {needles!r}. Saw: {columns!r}")


def normalize_team(team: str | None) -> str | None:
    if team is None:
        return None
    cleaned = re.sub(r"[^A-Za-z]", "", team).upper()
    if not cleaned:
        return None
    normalized = TEAM_ALIASES.get(cleaned, cleaned)
    return normalized if normalized in VALID_TEAM_CODES else None


def clean_player_name(name: object) -> str:
    text = " ".join(str(name or "").split())
    if not text:
        return ""

    while True:
        pieces = text.rsplit(" ", 1)
        if len(pieces) != 2:
            break
        tail = pieces[1].strip().upper()
        if tail not in STATUS_TOKENS:
            break
        text = pieces[0].strip()

    text = re.sub(r"\s*\([^)]*\)\s*$", "", text).strip()
    return text


def normalize_name(name: str, *, strip_suffixes: bool = False) -> str:
    text = unicodedata.normalize("NFKD", name)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = text.replace("&", " and ")
    text = text.replace("/", " ")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    parts = [part for part in text.split() if part]
    if strip_suffixes:
        parts = [part for part in parts if part not in SUFFIXES]
    normalized = " ".join(parts)
    return NAME_ALIASES.get(normalized, normalized)


def slugify_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[\"']", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def extract_position(raw_pos: object) -> str | None:
    text = str(raw_pos or "").upper()
    match = re.search(r"(DST|QB|RB|WR|TE|K)", text)
    return match.group(1) if match else None


def infer_dst_team(name: str) -> str | None:
    normalized = normalize_name(name)
    normalized = normalized.replace(" dst", "").replace(" defense", "").strip()
    return TEAM_NAME_TO_CODE.get(normalized)


def normalize_dst_name(name: str) -> str:
    cleaned = clean_player_name(name)
    cleaned = re.sub(r"\s+(DST|DEF|DEFENSE)$", "", cleaned, flags=re.I).strip()
    return f"{cleaned} DST" if cleaned else "DST"


def split_name_and_team(player_cell: object, team_cell: object | None, position: str | None) -> tuple[str, str | None]:
    if team_cell is not None:
        raw_name = clean_player_name(player_cell)
        team = normalize_team(str(team_cell or ""))
        if position == "DST":
            return normalize_dst_name(raw_name), team or infer_dst_team(raw_name)
        return raw_name, team

    text = " ".join(str(player_cell or "").split())
    if not text:
        return "", None

    if position == "DST":
        raw_name = normalize_dst_name(text)
        return raw_name, infer_dst_team(raw_name)

    embedded_team = re.match(
        r"^(?P<name>.+?)\s+(?P<team>[A-Z]{2,4})\s*\((?P<bye>[^)]*)\)(?:\s+(?P<status>[A-Z]+))?$",
        text,
    )
    if embedded_team:
        raw_name = clean_player_name(embedded_team.group("name"))
        team = normalize_team(embedded_team.group("team"))
        return raw_name, team

    raw_name = clean_player_name(text)
    return raw_name, None


def load_base_players() -> list[BasePlayer]:
    content = RANKINGS_TS.read_text(encoding="utf-8")
    match = re.search(r"export const players: Player\[\] = (\[.*?\]);\s*export const rankingIds", content, re.S)
    if not match:
        raise RuntimeError("Could not parse players array from src/data/rankings.ts")

    array_text = match.group(1)
    jsonish = re.sub(r'(\{|,)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1 "\2":', array_text)
    jsonish = re.sub(r",\s*}", "}", jsonish)
    jsonish = re.sub(r",\s*]", "]", jsonish)
    raw_players = json.loads(jsonish)

    return [
        BasePlayer(
            id=player["id"],
            name=player["name"],
            position=player["position"],
            team=normalize_team(player.get("team")),
        )
        for player in raw_players
    ]


def build_indexes(players: list[BasePlayer]) -> dict[str, dict]:
    by_exact: dict[tuple[str, str], list[BasePlayer]] = {}
    by_bare: dict[tuple[str, str], list[BasePlayer]] = {}
    by_slug: dict[tuple[str, str], BasePlayer] = {}
    by_exact_name: dict[str, list[BasePlayer]] = {}
    by_bare_name: dict[str, list[BasePlayer]] = {}
    by_id: dict[str, BasePlayer] = {}

    for player in players:
        exact_name = normalize_name(player.name)
        bare_name = normalize_name(player.name, strip_suffixes=True)
        exact_key = (exact_name, player.position)
        bare_key = (bare_name, player.position)
        slug_key = (slugify_name(player.name), player.position)

        by_exact.setdefault(exact_key, []).append(player)
        by_bare.setdefault(bare_key, []).append(player)
        by_exact_name.setdefault(exact_name, []).append(player)
        by_bare_name.setdefault(bare_name, []).append(player)
        by_slug.setdefault(slug_key, player)
        by_id.setdefault(player.id, player)

    return {
        "by_exact": by_exact,
        "by_bare": by_bare,
        "by_slug": by_slug,
        "by_exact_name": by_exact_name,
        "by_bare_name": by_bare_name,
        "by_id": by_id,
    }


def choose_candidate(candidates: list[BasePlayer], team: str | None) -> BasePlayer | None:
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]

    if team:
        exact_team = [candidate for candidate in candidates if candidate.team == team]
        if len(exact_team) == 1:
            return exact_team[0]
        if exact_team:
            return exact_team[0]

    return candidates[0]


def match_player(name: str, position: str | None, team: str | None, indexes: dict[str, dict]) -> BasePlayer | None:
    cleaned_name = clean_player_name(name)
    if not cleaned_name:
        return None

    if position:
        slug_key = (slugify_name(cleaned_name), position)
        slug_match = indexes["by_slug"].get(slug_key)
        if slug_match:
            return slug_match

        exact_key = (normalize_name(cleaned_name), position)
        exact_match = choose_candidate(indexes["by_exact"].get(exact_key, []), team)
        if exact_match:
            return exact_match

        bare_key = (normalize_name(cleaned_name, strip_suffixes=True), position)
        bare_match = choose_candidate(indexes["by_bare"].get(bare_key, []), team)
        if bare_match:
            return bare_match

    exact_name_match = choose_candidate(indexes["by_exact_name"].get(normalize_name(cleaned_name), []), team)
    if exact_name_match:
        return exact_name_match

    bare_name_match = choose_candidate(
        indexes["by_bare_name"].get(normalize_name(cleaned_name, strip_suffixes=True), []),
        team,
    )
    if bare_name_match:
        return bare_name_match

    return indexes["by_id"].get(slugify_name(cleaned_name))


def choose_value_column(columns: list[str]) -> str:
    for option in (
        ("rk",),
        ("rank",),
        ("ecr",),
        ("overall", "rank"),
    ):
        try:
            return find_column(columns, *option)
        except KeyError:
            continue
    raise KeyError(f"Could not find consensus rank column. Saw: {columns!r}")


def dedupe_rows(rows: list[dict]) -> list[dict]:
    deduped: dict[tuple[str, str | None], dict] = {}
    for row in rows:
        key = (normalize_name(row["name"], strip_suffixes=True), row["position"])
        existing = deduped.get(key)
        if existing is None:
            deduped[key] = row
            continue

        existing_team = existing.get("team")
        incoming_team = row.get("team")
        if existing_team in {None, ""} and incoming_team not in {None, ""}:
            deduped[key] = row
            continue

        if float(row["rank"]) < float(existing["rank"]):
            deduped[key] = row

    return list(deduped.values())


def fetch_consensus_rows(url: str) -> list[dict]:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()

    tables = pd.read_html(StringIO(response.text))
    if not tables:
        raise RuntimeError(f"No tables found at {url}")

    table = None
    for candidate in tables:
        columns = flatten_columns(candidate.columns)
        lowered = [col.lower() for col in columns]
        if any("player" in col for col in lowered) and any(("rk" in col) or ("rank" in col) or ("ecr" in col) for col in lowered):
            table = candidate.copy()
            table.columns = columns
            break

    if table is None:
        raise RuntimeError(f"Could not find consensus rankings table at {url}")

    columns = list(table.columns)
    player_col = find_column(columns, "player")
    pos_col = find_column(columns, "pos")
    value_col = choose_value_column(columns)
    team_col = next((col for col in columns if "team" in col.lower() and col != player_col), None)

    rows: list[dict] = []
    for _, row in table.iterrows():
        position = extract_position(row.get(pos_col))
        player_name, team = split_name_and_team(
            row.get(player_col),
            row.get(team_col) if team_col else None,
            position,
        )
        value_raw = row.get(value_col)

        if not player_name or pd.isna(value_raw):
            continue

        value_match = re.search(r"\d+(?:\.\d+)?", str(value_raw))
        if not value_match:
            continue

        rank = float(value_match.group(0))
        if rank <= 0:
            continue

        rows.append(
            {
                "name": player_name,
                "team": team,
                "position": position,
                "rank": round(rank, 1),
            }
        )

    return dedupe_rows(rows)


def make_fallback_id(name: str, position: str | None, team: str | None, used_ids: set[str]) -> str:
    base = slugify_name(clean_player_name(name)) or "player"
    candidate = base
    if candidate in used_ids:
        pieces = [base]
        if position:
            pieces.append(position.lower())
        if team:
            pieces.append(team.lower())
        candidate = "-".join(piece for piece in pieces if piece)

    suffix = 2
    original = candidate
    while candidate in used_ids:
        candidate = f"{original}-{suffix}"
        suffix += 1

    return candidate


def write_csv(records: list[dict]) -> None:
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["id", "name", "position", "team", "consensusStandard", "consensusHalfPpr", "consensusPpr"],
        )
        writer.writeheader()
        for record in records:
            writer.writerow(record)


def main() -> int:
    base_players = load_base_players()
    indexes = build_indexes(base_players)

    merged: dict[str, dict] = {}
    fallback_skill_players: set[str] = set()
    fallback_k_dst_players: set[str] = set()
    fetched_counts: dict[str, int] = {}

    for format_key, url in URLS.items():
        rows = fetch_consensus_rows(url)
        fetched_counts[format_key] = len(rows)
        print(f"[{format_key}] fetched {len(rows)} rows")

        minimum = MIN_ROWS_BY_FORMAT[format_key]
        if len(rows) < minimum:
            raise RuntimeError(
                f"{format_key} returned only {len(rows)} rows, below the safety floor of {minimum}. "
                "Aborting so the existing consensus.csv does not get wiped out."
            )

        for row in rows:
            name = row["name"]
            team = row["team"]
            position = row["position"]
            rank = row["rank"]

            matched = match_player(name, position, team, indexes)

            if matched is not None:
                player_id = matched.id
                record = merged.setdefault(
                    player_id,
                    {
                        "id": player_id,
                        "name": matched.name,
                        "position": position or matched.position,
                        "team": team or matched.team or "",
                        "consensusStandard": "",
                        "consensusHalfPpr": "",
                        "consensusPpr": "",
                    },
                )
            else:
                player_id = make_fallback_id(name, position, team, set(merged.keys()))
                record = merged.setdefault(
                    player_id,
                    {
                        "id": player_id,
                        "name": clean_player_name(name) or name,
                        "position": position or "WR",
                        "team": team or "",
                        "consensusStandard": "",
                        "consensusHalfPpr": "",
                        "consensusPpr": "",
                    },
                )
                label = f"{record['name']} ({record['position']}, {record['team'] or '-'})"
                if position in {"K", "DST"}:
                    fallback_k_dst_players.add(label)
                else:
                    fallback_skill_players.add(label)

            field_name = (
                "consensusStandard" if format_key == "standard"
                else "consensusHalfPpr" if format_key == "halfPpr"
                else "consensusPpr"
            )
            current_value = record[field_name]
            if current_value == "" or rank < float(current_value):
                record[field_name] = rank

    records = list(merged.values())
    if len(records) < 250:
        raise RuntimeError(
            f"Only built {len(records)} consensus ranking records, which is below the safety floor. "
            "Aborting so the existing consensus.csv stays untouched."
        )

    records.sort(
        key=lambda record: (
            float(record["consensusHalfPpr"]) if record["consensusHalfPpr"] != "" else float("inf"),
            float(record["consensusPpr"]) if record["consensusPpr"] != "" else float("inf"),
            record["name"],
        )
    )
    write_csv(records)

    print(f"Wrote {len(records)} players to {OUT_CSV}")

    if fallback_k_dst_players:
        print(f"Created {len(fallback_k_dst_players)} new K/DST records (expected because rankings.ts has no K/DST base players)")

    if fallback_skill_players:
        sample = ", ".join(sorted(fallback_skill_players)[:15])
        print(
            f"Created fallback records for {len(fallback_skill_players)} unmatched skill players. "
            f"Examples: {sample}",
            file=sys.stderr,
        )
    else:
        print("Matched every scraped non-K/DST consensus player to an existing player record.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
