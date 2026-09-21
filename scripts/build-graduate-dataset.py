from pathlib import Path
from collections import Counter, defaultdict
import csv, json, re

root = Path(__file__).resolve().parents[1]
ocr_dirs = [root / "output" / "booklet-column-ocr", root / "output" / "booklet-column-ocr-11"]
public_dir = root / "public" / "graduate-insights"
public_dir.mkdir(parents=True, exist_ok=True)

def faculty_for(name):
    stamp = re.search(r"at (\d{2}\.\d{2}\.\d{2})", name)
    stamp = stamp.group(1) if stamp else ""
    suffix = ""
    if "(" in name:
        suffix = name[name.index("("):name.index(")") + 1]
    key = f"{stamp} {suffix}"
    if stamp <= "12.43.42": return "Applied Science"
    if stamp <= "12.43.45": return "Environmental Science"
    if stamp <= "12.43.50": return "Engineering"
    if stamp <= "12.43.52": return "Medicine"
    if stamp <= "12.43.59": return "Built Environment"
    if stamp == "12.44.00": return "Science and Technology Education"
    if stamp == "12.44.01" and suffix not in ("(2)",): return "Communication and Information Science"
    return "Business and Economic Sciences"

bad_words = {"name", "surname", "gender", "prize", "prizes", "awarded", "graduation", "ceremony", "faculty", "bachelor", "master", "degree", "honours"}
rows = []
for file in sorted(file for directory in ocr_dirs for file in directory.glob("*.txt")):
    name = file.name
    if not ("12.43.4" in name or "12.43.5" in name or "12.44.0" in name):
        continue
    faculty = faculty_for(name)
    text = file.read_text(encoding="utf-8", errors="ignore")
    headings = [re.sub(r"\s+", " ", line).strip(" .") for line in text.splitlines()
                if "Degree in" in line and len(line) < 130]
    programme = headings[0] if headings else "Programme not reliably resolved"
    for line in text.splitlines():
        line = line.replace("â€”", " ").replace("Â©", " ").replace("_", " ").replace("|", " ")
        matches = list(re.finditer(r"(?<!\d)(\d{1,3})[\.,]?\s+", line))
        for i, match in enumerate(matches):
            segment = line[match.end(): matches[i + 1].start() if i + 1 < len(matches) else len(line)]
            segment = re.sub(r"[^A-Za-zÀ-ÖØ-öø-ÿ' -]", " ", segment)
            words = [w for w in re.split(r"\s+", segment.strip()) if len(w) > 1]
            words = [w for w in words if w.lower() not in bad_words]
            if len(words) < 2 or len(words) > 7:
                continue
            if sum(w[0].isupper() for w in words) < 2:
                continue
            surname = words[-1]
            surname = {"Neube": "Ncube", "Ndlova": "Ndlovu", "Newenya": "Ngwenya"}.get(surname, surname)
            given = " ".join(words[:-1])
            confidence = "high" if 2 <= len(words) <= 4 and all(w[0].isupper() for w in words) else "review"
            if len(surname) < 3 or len(given) < 2:
                continue
            rows.append({
                "record_id": len(rows) + 1,
                "given_names": given,
                "surname": surname,
                "full_name": f"{given} {surname}",
                "faculty": faculty,
                "programme": programme,
                "gender": "",
                "record_type": "graduate",
                "ocr_confidence": confidence,
                "source_image": name.split("__c", 1)[0] + ".jpeg",
                "source_row_number": match.group(1),
            })

# Remove exact OCR duplicates while retaining separate same-name records across faculties.
deduped, seen = [], set()
for row in rows:
    key = (row["full_name"].lower(), row["faculty"])
    if key in seen: continue
    seen.add(key)
    row["record_id"] = len(deduped) + 1
    deduped.append(row)
rows = deduped

fields = list(rows[0].keys())
with (public_dir / "graduates.csv").open("w", encoding="utf-8-sig", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=fields)
    writer.writeheader(); writer.writerows(rows)

faculty_counts = Counter(row["faculty"] for row in rows)
surnames = Counter(row["surname"].title() for row in rows if row["ocr_confidence"] == "high")
confidence = Counter(row["ocr_confidence"] for row in rows)
metrics = {
    "official_total": 2570,
    "official_stem_share": 68,
    "records": len(rows),
    "high_confidence": confidence["high"],
    "review_required": confidence["review"],
    "faculty_counts": [{"name": k, "value": v} for k, v in faculty_counts.most_common()],
    "top_surnames": [{"name": k, "value": v} for k, v in surnames.most_common(15)],
    "rows": rows,
}
(public_dir / "data.json").write_text(json.dumps(metrics, ensure_ascii=True), encoding="utf-8")
print(json.dumps({k: v for k, v in metrics.items() if k != "rows"}, indent=2))
