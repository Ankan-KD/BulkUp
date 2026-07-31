"""
One-off merge script used to fold the Indian Nutrient Databank (INDB)
recipe dataset into master-food-database.source.csv.

Kept here (rather than deleted after running once) as a template for
merging in future external datasets — see the "Merging in another dataset"
section in src/data/README.md. Re-running this exact script is safe/
idempotent: it dedupes against whatever's already in the CSV (by normalized
name/local_name/alias), so it will only ever add genuinely-new rows.

Requires: pip install pandas openpyxl
"""

import csv
import re
import json
import unicodedata

import pandas as pd

# Run from the project root: python3 scripts/merge_indb.py
# (or adjust these paths if your external dataset lives elsewhere)
CSV_PATH = "src/data/master-food-database.source.csv"
INDB_PATH = "path/to/Indian-Nutrient-Databank-INDB--main/INDB.xlsx"
OUT_CSV = "src/data/master-food-database.source.csv"

# ── 1. Load the existing curated dataset ────────────────────────────────
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    existing_rows = list(reader)

next_id = max(int(r["id"]) for r in existing_rows) + 1
print(f"Existing rows: {len(existing_rows)}, next id: {next_id}")

# Add local_name + source columns to existing rows (proper schema, filled blank
# for the pre-existing curated rows — they never had a separate vernacular name,
# it was folded into aliases already, which is fine to leave as-is for them).
for r in existing_rows:
    r.setdefault("local_name", "")
    r.setdefault("source", "curated")

# ── 2. Build a normalized lookup of existing name+aliases for dedup ─────
def normalize(s: str) -> str:
    s = s.lower().strip()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    # Mirrors normalizeForMatch in src/lib/masterFoods.ts — keep these in
    # sync so dedup here and runtime matching agree on what counts as "the
    # same word" (z/j, w/v, aspirated consonants, long/short vowels,
    # doubled letters).
    s = re.sub(r"z", "j", s)
    s = re.sub(r"w", "v", s)
    s = re.sub(r"ph", "f", s)
    s = re.sub(r"([bdgjkpt])h", r"\1", s)
    s = re.sub(r"(ee|ii)", "i", s)
    s = re.sub(r"(.)\1+", r"\1", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

existing_terms = set()
for r in existing_rows:
    existing_terms.add(normalize(r["food_name"]))
    for a in r["aliases"].split(","):
        a = a.strip()
        if a:
            existing_terms.add(normalize(a))

# ── 3. Load INDB recipes ─────────────────────────────────────────────────
df = pd.read_excel(INDB_PATH, sheet_name="Nutrient Data")

def find_top_level_parens(s: str):
    spans = []
    depth = 0
    start = None
    for i, ch in enumerate(s):
        if ch == "(":
            if depth == 0:
                start = i
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
            if depth == 0 and start is not None:
                spans.append((start, i))
                start = None
    return spans

def split_name(raw: str):
    raw = raw.strip()
    spans = find_top_level_parens(raw)
    if not spans:
        return raw, ""
    last_start, last_end = spans[-1]
    # Only treat the final top-level paren group as the local/vernacular name
    # if it's genuinely the trailing part of the string (handles nested cases
    # like "Cabbage Rolls (dry) ((Pattagobhi Rolls) (dry))" correctly by
    # taking the whole final top-level group, not just its innermost part).
    if last_end == len(raw) - 1:
        local = raw[last_start + 1:last_end].strip()
        english = raw[:last_start].strip()
        return english, local
    return raw, ""

def title_case(s: str) -> str:
    # Simple title-casing that doesn't mangle already-capitalized acronyms
    return " ".join(w if w.isupper() and len(w) <= 4 else w.capitalize() for w in s.split())

# Subcategory classifier, reusing the existing "Indian Meals" subcategories
# already used by the curated rows instead of inventing new ones.
RULES = [
    (r"\b(chutney|pickle|achaar|achar)\b", "Chutneys & Pickles"),
    (r"\b(soup|shorba|consomme)\b", "Soups"),
    (r"\b(halwa|kheer|payasam|payasa|barfi|burfi|laddu|ladoo|kulfi|custard|pudding|souffle|ice cream|jalebi|gulab jamun|cake|pastry|trifle|charlotte)\b", "Desserts"),
    (r"\b(tea|coffee|juice|lassi|milkshake|sharbat|punch|squash|drink|nimbu pani|chai)\b", "Beverages"),
    (r"\b(raita|salad|kachumber)\b", "Salads"),
    (r"\b(chicken|mutton|lamb|fish|prawn|meat|egg|omelette|omlet|keema|kheema)\b", "Non-Vegetarian Mains"),
    (r"\b(pakora|pakoda|tikki|cutlet|chaat|vada|dhokla|samosa|bhajji|bonda|kebab|kabab)\b", "Snacks & Street Food"),
    (r"\b(naan|roti|paratha|parantha|poori|puri|bread|kulcha|bhatura|dosa|idli|uttapam)\b", "Breads"),
    (r"\b(rice|pulao|pilaf|biryani|khichdi|khichri|jeera rice|fried rice)\b", "Rice Dishes"),
    (r"\b(cake|biscuit|cookie|burfi)\b", "Bakery & Baked Snacks"),
]

def classify_subcategory(name: str) -> str:
    lower = name.lower()
    for pattern, subcat in RULES:
        if re.search(pattern, lower):
            return subcat
    return "Vegetarian Mains & Curries"

new_rows = []
skipped_duplicates = []

for _, row in df.iterrows():
    english, local = split_name(str(row["food_name"]))
    english = title_case(english)
    key = normalize(english)
    local_key = normalize(local) if local else None

    if key in existing_terms or (local_key and local_key in existing_terms):
        skipped_duplicates.append(row["food_name"])
        continue

    kcal_100g = float(row["energy_kcal"])
    unit_kcal = float(row["unit_serving_energy_kcal"]) if pd.notna(row["unit_serving_energy_kcal"]) else None
    weight_g = round(unit_kcal / kcal_100g * 100, 1) if unit_kcal and kcal_100g > 0 else None
    serving_unit = str(row["servings_unit"]).strip() if pd.notna(row["servings_unit"]) and str(row["servings_unit"]).strip() else "serving"

    aliases = []
    if local:
        aliases.append(local)
    aliases.append(english.lower())
    # de-dupe aliases, keep order
    seen = set()
    aliases_clean = []
    for a in aliases:
        al = a.strip()
        if al and al.lower() not in seen:
            seen.add(al.lower())
            aliases_clean.append(al)

    new_rows.append({
        "id": next_id,
        "category": "Indian Meals",
        "subcategory": classify_subcategory(english + " " + local),
        "food_name": english,
        "local_name": local,
        "aliases": ", ".join(aliases_clean),
        "serving_size": 1,
        "serving_unit": serving_unit,
        "weight_g": weight_g if weight_g else "",
        "calories_kcal": round(kcal_100g, 1),
        "protein_g": round(float(row["protein_g"]), 1),
        "carbohydrates_g": round(float(row["carb_g"]), 1),
        "fat_g": round(float(row["fat_g"]), 1),
        "dietary_fiber_g": round(float(row["fibre_g"]), 1) if pd.notna(row["fibre_g"]) else 0,
        "total_sugars_g": round(float(row["freesugar_g"]), 1) if pd.notna(row["freesugar_g"]) else 0,
        "saturated_fat_g": round(float(row["sfa_mg"]) / 1000, 2) if pd.notna(row["sfa_mg"]) else 0,
        "sodium_mg": round(float(row["sodium_mg"]), 1) if pd.notna(row["sodium_mg"]) else 0,
        "cholesterol_mg": round(float(row["cholesterol_mg"]), 1) if pd.notna(row["cholesterol_mg"]) else 0,
        "food_type": "Meals / Prepared Food",
        "source": "INDB",
    })
    existing_terms.add(key)
    if local_key:
        existing_terms.add(local_key)
    next_id += 1

print(f"New rows added: {len(new_rows)}")
print(f"Skipped as duplicates already in dataset: {len(skipped_duplicates)}")
print("Sample skipped:", skipped_duplicates[:10])

# ── 4. Write merged CSV with the new proper column layout ───────────────
fieldnames = [
    "id", "category", "subcategory", "food_name", "local_name", "aliases",
    "serving_size", "serving_unit", "weight_g", "calories_kcal", "protein_g",
    "carbohydrates_g", "fat_g", "dietary_fiber_g", "total_sugars_g",
    "saturated_fat_g", "sodium_mg", "cholesterol_mg", "food_type", "source",
]

with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for r in existing_rows:
        writer.writerow({k: r.get(k, "") for k in fieldnames})
    for r in new_rows:
        writer.writerow(r)

print(f"Total rows written: {len(existing_rows) + len(new_rows)}")
