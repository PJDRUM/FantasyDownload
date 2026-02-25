#!/usr/bin/env python3
"""
Scrape KeepTradeCut dynasty values (1QB + Superflex) and overwrite:
  src/data/rankings.csv

Designed to run locally or via GitHub Actions on a schedule.
"""
from __future__ import annotations

import csv
import sys
from datetime import date, datetime

import requests
from bs4 import BeautifulSoup


KTC_DYNASTY_URL = "https://keeptradecut.com/dynasty-rankings?page={page}&filters=QB|WR|RB|TE|RDP&format={fmt}"
OUT_CSV = "src/data/rankings.csv"


def _team_suffix_from_name(name: str) -> str:
    # Matches the original script's suffix cleanup logic.
    if name.endswith("RFA"):
        return name[-3:]
    if len(name) >= 4 and name[-4] == "R":
        return name[-4:]
    if name.endswith("FA"):
        return name[-2:]
    if len(name) >= 3 and name[-3:].isupper():
        return name[-3:]
    return ""


def scrape_ktc() -> list[dict]:
    """
    Returns a list of dicts containing both 1QB and SF values.
    """
    players: list[dict] = []

    # format=1 -> 1QB, format=0 -> Superflex
    for fmt in [1, 0]:
        all_elements = []

        # KTC seems to return ~50-ish per page; 10 pages usually covers all, but keep same as repo.
        for page_num in range(10):
            resp = requests.get(
                KTC_DYNASTY_URL.format(page=page_num, fmt=fmt),
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=30,
            )
            resp.raise_for_status()
            soup = BeautifulSoup(resp.content, "html.parser")
            all_elements.extend(soup.find_all(class_="onePlayer"))

        if fmt == 1:
            # First pass: create base records with 1QB value
            for el in all_elements:
                name_el = el.find(class_="player-name")
                pos_el = el.find(class_="position")
                val_el = el.find(class_="value")
                age_el = el.find(class_="position hidden-xs")

                if not (name_el and pos_el and val_el):
                    continue

                raw_name = name_el.get_text(strip=True)
                suffix = _team_suffix_from_name(raw_name)
                player_name = raw_name.replace(suffix, "").strip()

                position_rank = pos_el.get_text(strip=True)
                position = position_rank[:2]
                value = int(val_el.get_text(strip=True))

                player_age = 0
                if age_el:
                    age_text = age_el.get_text(strip=True)
                    if age_text:
                        try:
                            player_age = float(age_text[:4])
                        except Exception:
                            player_age = 0

                # rookie vs team
                if suffix[:1] == "R":
                    team = suffix[1:]
                    rookie = "Yes"
                else:
                    team = suffix
                    rookie = "No"

                if position == "PI":
                    players.append(
                        {
                            "Player Name": player_name,
                            "Position Rank": None,
                            "Position": position,
                            "Team": None,
                            "Value": value,
                            "Age": None,
                            "Rookie": None,
                            "SFPosition Rank": None,
                            "SFValue": 0,
                        }
                    )
                else:
                    players.append(
                        {
                            "Player Name": player_name,
                            "Position Rank": position_rank,
                            "Position": position,
                            "Team": team,
                            "Value": value,
                            "Age": player_age,
                            "Rookie": rookie,
                            "SFPosition Rank": None,
                            "SFValue": 0,
                        }
                    )
        else:
            # Second pass: fill SF values into existing records
            for el in all_elements:
                name_el = el.find(class_="player-name")
                pos_el = el.find(class_="position")
                val_el = el.find(class_="value")

                if not (name_el and pos_el and val_el):
                    continue

                raw_name = name_el.get_text(strip=True)
                suffix = _team_suffix_from_name(raw_name)
                player_name = raw_name.replace(suffix, "").strip()

                sf_position_rank = pos_el.get_text(strip=True)
                sf_position = sf_position_rank[:2]
                sf_value = int(val_el.get_text(strip=True))

                if sf_position == "PI":
                    for pick in players:
                        if pick["Player Name"] == player_name:
                            pick["SFValue"] = sf_value
                            break
                else:
                    for p in players:
                        if p["Player Name"] == player_name:
                            p["SFPosition Rank"] = sf_position_rank
                            p["SFValue"] = sf_value
                            break

    return players


def export_to_csv(players: list[dict], out_csv: str = OUT_CSV) -> None:
    # Match your app's existing rankings.csv structure:
    # header row with Updated..., then name, position ranks, position, team, values, age, rookie
    header = [
        f"Updated {date.today().strftime('%m/%d/%y')} at {datetime.now().strftime('%I:%M%p').lower()}",
        "Position Rank",
        "Position",
        "Team",
        "Value",
        "Age",
        "Rookie",
        "SFPosition Rank",
        "SFValue",
    ]

    rows = [
        [
            p["Player Name"],
            p["Position Rank"],
            p["Position"],
            p["Team"],
            p["Value"],
            p["Age"],
            p["Rookie"],
            p["SFPosition Rank"],
            p["SFValue"],
        ]
        for p in players
    ]
    rows.insert(0, header)

    os.makedirs(os.path.dirname(out_csv), exist_ok=True)  # type: ignore
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    print(f"Wrote {out_csv} ({len(rows)-1} rows).")


def main() -> int:
    players = scrape_ktc()
    export_to_csv(players, OUT_CSV)
    return 0


if __name__ == "__main__":
    import os
    raise SystemExit(main())
