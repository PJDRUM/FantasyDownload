import csv
from datetime import datetime
import requests
from bs4 import BeautifulSoup

"""Scrape KeepTradeCut dynasty rankings (1QB + Superflex) and write to src/data/ktc.csv.

Output is a simple CSV intended to be committed into the repo and consumed by the app.
"""

URL = "https://keeptradecut.com/dynasty-rankings?page={page}&filters=QB|WR|RB|TE|RDP&format={fmt}"

def _parse_player_name_and_suffix(raw_name: str):
    # KTC sometimes appends team / status suffixes like "RFA", "FA", "R<TEAM>", or "TEAM"
    name = raw_name.strip()
    suffix = ""
    if len(name) >= 3 and name[-3:] == "RFA":
        suffix = "RFA"
    elif len(name) >= 2 and name[-2:] == "FA":
        suffix = "FA"
    elif len(name) >= 4 and name[-4] == "R":
        # matches the original repo logic (a bit odd but keeps behavior similar)
        suffix = name[-4:]
    elif len(name) >= 3 and name[-3:].isupper():
        suffix = name[-3:]

    cleaned = name.replace(suffix, "").strip()
    return cleaned, suffix

def scrape_ktc(pages: int = 10):
    players = {}

    for fmt in (1, 0):  # 1QB then SF
        for page in range(pages):
            resp = requests.get(
                URL.format(page=page, fmt=fmt),
                headers={
                    "User-Agent": "Mozilla/5.0",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                timeout=30,
            )
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            for el in soup.find_all(class_="onePlayer"):
                name_el = el.find(class_="player-name")
                posrank_el = el.find(class_="position")
                val_el = el.find(class_="value")
                age_el = el.find(class_="position hidden-xs")

                if not (name_el and posrank_el and val_el):
                    continue

                raw_name = name_el.get_text(strip=True)
                name, suffix = _parse_player_name_and_suffix(raw_name)

                posrank = posrank_el.get_text(strip=True)
                position = posrank[:2]
                try:
                    value = int(val_el.get_text(strip=True))
                except Exception:
                    continue

                age = ""
                if age_el:
                    age_txt = age_el.get_text(strip=True)
                    age = age_txt[:4].strip() if age_txt else ""

                team = ""
                rookie = ""
                if suffix.startswith("R") and len(suffix) > 1:
                    team = suffix[1:]
                    rookie = "Yes"
                else:
                    team = suffix
                    rookie = "No" if suffix else ""

                rec = players.get(name)
                if not rec:
                    rec = {
                        "Player Name": name,
                        "Position": position,
                        "Team": team if position != "PI" else "",
                        "Age": age if position != "PI" else "",
                        "Rookie": rookie if position != "PI" else "",
                        "1QB Position Rank": "",
                        "1QB Value": "",
                        "SF Position Rank": "",
                        "SF Value": "",
                    }
                    players[name] = rec

                if fmt == 1:
                    rec["1QB Position Rank"] = posrank
                    rec["1QB Value"] = value
                else:
                    rec["SF Position Rank"] = posrank
                    rec["SF Value"] = value

    def sort_key(rec):
        sf = rec["SF Value"] if isinstance(rec["SF Value"], int) else -1
        qb = rec["1QB Value"] if isinstance(rec["1QB Value"], int) else -1
        return (sf, qb)

    return sorted(players.values(), key=sort_key, reverse=True)

def export_to_csv(players, out_path: str):
    updated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    fieldnames = [
        "Updated",
        "Player Name",
        "Position",
        "Team",
        "Age",
        "Rookie",
        "1QB Position Rank",
        "1QB Value",
        "SF Position Rank",
        "SF Value",
    ]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for p in players:
            row = {"Updated": updated, **p}
            w.writerow(row)

if __name__ == "__main__":
    players = scrape_ktc(pages=10)
    export_to_csv(players, out_path="src/data/ktc.csv")
    print("Wrote src/data/ktc.csv")
