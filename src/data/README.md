# Master Food Database

- `master-food-database.source.csv` — the source-of-truth reference dataset
  (3,233 rows: category, subcategory, name, **local_name**, aliases, serving
  size, full macro/micro nutrition, and **source**). Keep this checked into
  git. Treat it as read-only: don't hand-edit rows in the running app; if the
  dataset needs a correction, edit this CSV and regenerate the JSON below.
- `masterFoodDatabase.json` — a compact JSON build of the CSV above, imported
  directly by `src/lib/masterFoods.ts`. This is what actually ships with the
  app. There is no write path to it anywhere in the codebase, so nothing at
  runtime — not a user, not the AI, not a bug — can modify it. The only way
  it changes is by regenerating it from the CSV and redeploying.

## Column layout

| Column | Meaning |
|---|---|
| `id` | Stable numeric row id. New rows always get the next unused id — never reuse or renumber existing ids, since nothing else references rows by anything other than this. |
| `category` / `subcategory` | This app's grouping, e.g. `Indian Meals` / `Rice Dishes`. |
| `food_name` | The canonical display name, English (or the common name if there's no separate English name). |
| `local_name` | Regional/vernacular name kept in **its own column** instead of being crammed into `food_name` or `aliases` — e.g. `food_name` "Split Bengal Gram Dal", `local_name` "Channa Dal". Blank when there isn't a separate local name. |
| `aliases` | Comma-separated alternate spellings/synonyms someone might actually type (misspellings, plurals, hyphenation, brand-ish names). Matching also runs a phonetic-normalization fallback (see `masterFoods.ts`), so you don't need to hand-enumerate every z/j, w/v spelling variant here — just the genuinely different names. |
| `serving_size` / `serving_unit` / `weight_g` | What the nutrition columns are "per" — either `g`/`ml` with a gram weight, or a named unit (`bowl`, `piece`, `roll`, ...) with `weight_g` as its approximate gram equivalent. |
| `calories_kcal` … `cholesterol_mg` | Standard macro/micro nutrition for that serving. |
| `food_type` | `Meals / Prepared Food` vs `Raw`. |
| `source` | Provenance: `curated` for the original hand-built dataset, `INDB` for rows merged in from the [Indian Nutrient Databank](https://github.com/abhijeet-genome/Indian-Nutrient-Databank-INDB-) (Longvah et al./NIN-ICMR-derived recipe nutrition). Add a new value here (e.g. `usda`) whenever you merge in another external dataset, so provenance stays traceable. |
| `ingredients` | Comma-separated real-world ingredients this dish is made of (e.g. Chicken Biryani → `Rice, Chicken, Yogurt, Onion, Spices`). This is what grounds the AI's Case 3 "does this dish's ingredients match a Diet item" check in real curated data instead of the model's own guess — fill it in for composite dishes; leave blank for raw/single-ingredient entries where it wouldn't add anything (e.g. "Rice" itself). |

## Merging in another dataset

When adding a new external dataset, follow the same approach used for the
INDB merge (see git history / `merge_indb.py`-style script):
1. Normalize each incoming food name the same way as existing entries
   (case, whitespace, transliteration — see `normalizeForMatch` in
   `src/lib/masterFoods.ts`) and check it against existing `food_name` +
   `local_name` + `aliases` before adding, so you don't create duplicate
   rows for the same dish under a different spelling.
2. Split any "English Name (Local Name)" style source names into
   `food_name` + `local_name` — don't leave the parenthetical local name
   jammed inside `food_name`.
3. Only add genuinely new rows; on a true duplicate, consider merging any
   new alias/local name into the *existing* row instead of adding a
   second one.
4. Tag new rows with a `source` value identifying where they came from.
5. Regenerate the JSON (below) and rebuild.

## Regenerating the JSON after editing the CSV

Run this from the project root whenever `master-food-database.source.csv`
changes:

```bash
python3 - << 'EOF'
import csv, json

with open("src/data/master-food-database.source.csv", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    out = []
    for row in reader:
        out.append({
            "id": int(row["id"]),
            "category": row["category"].strip(),
            "subcategory": row["subcategory"].strip(),
            "name": row["food_name"].strip(),
            "localName": row.get("local_name", "").strip(),
            "aliases": [a.strip() for a in row["aliases"].split(",") if a.strip()],
            "servingSize": float(row["serving_size"]) if row["serving_size"] else None,
            "servingUnit": row["serving_unit"].strip(),
            "weightG": float(row["weight_g"]) if row["weight_g"] else None,
            "calories": float(row["calories_kcal"] or 0),
            "protein": float(row["protein_g"] or 0),
            "carbs": float(row["carbohydrates_g"] or 0),
            "fat": float(row["fat_g"] or 0),
            "fiber": float(row["dietary_fiber_g"] or 0),
            "sugar": float(row["total_sugars_g"] or 0),
            "satFat": float(row["saturated_fat_g"] or 0),
            "sodiumMg": float(row["sodium_mg"] or 0),
            "cholesterolMg": float(row["cholesterol_mg"] or 0),
            "foodType": row["food_type"].strip(),
            "ingredients": [a.strip() for a in row.get("ingredients", "").split(",") if a.strip()],
        })

with open("src/data/masterFoodDatabase.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
EOF
```

## If you later want it in Supabase instead

Bundling it as JSON (above) is enough for everything the app currently does
with it (grounding the AI's estimates, backstopping the no-Gemini fallback).
If a future feature needs it queryable from the client or joinable in SQL,
create a `master_foods` table, enable Row Level Security, add a `select`
policy for `authenticated`/`anon`, and add **no** `insert`/`update`/`delete`
policies for them — with RLS on and no write policy, Postgres denies those
operations outright for every role except your service-role key. That's a
stronger read-only guarantee than a bundled file: it's enforced by the
database itself, not by "nothing in the code happens to write to it."
