import csv
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECTION_B = Path(r"C:\Users\lenovo\Downloads\nust_2026_section_b_awards_distinctions_with_master_matches.csv")
SECTION_C = Path(r"C:\Users\lenovo\Downloads\nust_2026_section_c_cumulative_pages61_93_corrected.csv")
JOBS = ROOT / "output" / "jobs-2026.json"
OUT = ROOT / "public" / "graduate-insights"


def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def integer(value):
    try:
        return int(value or 0)
    except ValueError:
        return 0


def compact_programme(value):
    value = re.sub(r"\s+in\s+collaboration\s+with.*$", "", value, flags=re.I)
    prefixes = [
        r"Bachelor of Medicine and Bachelor of Surgery Degrees?",
        r"Bachelor of (?:Science|Commerce|Engineering|Technology|Environmental Science|Architectural Studies|Design and Technology Education|Technology Education)(?: Education)?(?: Special)? Honours Degree in",
        r"Master of (?:Science|Engineering|Architecture|Technology Education|Urban Design|Business Administration|Business Leadership)(?: Education)? Degree in",
        r"Master of Business Administration(?: Degree)? in",
        r"Master of Science Education Degree in",
        r"Doctor of Philosophy(?: Degree)? in",
        r"Postgraduate Diploma in",
    ]
    for prefix in prefixes:
        value = re.sub(rf"^{prefix}\s*", "", value, flags=re.I)
    value = re.sub(r"^(Bachelor|Master) of [A-Za-z ]+ Degree in\s+", "", value, flags=re.I)
    value = value.strip()
    aliases = {
        "Bachelor of Medicine and Bachelor of Surgery Degrees": "Medicine and Surgery",
        "Bachelor of Medicine and Bachelor of Surgery": "Medicine and Surgery",
        "Bachelor of Architectural Studies Honours Degree": "Architecture",
        "Master of Architecture Degree": "Architecture",
        "Master of Urban Design Degree": "Urban Design",
        "Master of Business Administration": "Business Administration",
        "Master of Business Leadership": "Business Leadership",
        "Risk Management and Insurance": "Risk Management and Insurance",
        "Accounting and Business Studies": "Accounting and Business Education",
        "Computer Science": "Computer Science",
    }
    return aliases.get(value, value)


CLUSTERS = {
    "Digital & data": ["software", "developer", "programmer", "information technology", " it ", "ict", "data", "cyber", "network", "systems", "database", "computer", "digital", "analytics", "business intelligence"],
    "Finance & accounting": ["account", "finance", "financial", "audit", "tax", "bank", "treasury", "actuar", "insurance", "credit", "economist", "fiscal", "investment"],
    "Engineering & industrial": ["engineer", "electrical", "electronic", "mechanical", "manufactur", "chemical", "process", "telecom", "instrument", "maintenance", "plant", "technician"],
    "Construction & property": ["construction", "quantity survey", "architect", "property", "estate", "civil", "project manager", "urban", "built environment"],
    "Health & clinical": ["doctor", "medical", "health", "nurse", "midwi", "radiograph", "ultrasound", "clinical", "hospital", "pharmac", "public health"],
    "Education & training": ["teacher", "lecturer", "education", "trainer", "training", "school", "academic", "tutor"],
    "Environment & geospatial": ["environment", "climate", "gis", "geospatial", "remote sensing", "wildlife", "forestry", "conservation", "sustainab", "water resources", "sanitation"],
    "Media & information": ["journal", "media", "communication", "public relations", "content", "editor", "library", "records", "archive", "publishing"],
    "Sales & marketing": ["sales", "marketing", "brand", "business development", "customer", "retail", "commercial"],
    "Management & operations": ["manager", "management", "administrator", "administration", "operations", "governance", "development studies", "programme officer", "project officer"],
    "People & legal": ["human resources", " hr ", "people officer", "legal", "lawyer", "compliance", "labour"],
    "Supply chain": ["procurement", "supply chain", "logistics", "warehouse", "stores", "transport", "buyer"],
    "Food, agriculture & bioscience": ["agric", "food", "biolog", "biotech", "microbiolog", "laboratory", "lab techn", "quality control", "chem", "nutrition"],
}


PROGRAMME_HINTS = {
    "Computer Science": "Digital & data", "Informatics": "Digital & data", "Information Systems": "Digital & data", "Big Data": "Digital & data", "Business Analytics": "Digital & data", "Operations Research and Statistics": "Digital & data", "Applied Mathematical Modelling": "Digital & data", "Applied Mathematics": "Digital & data",
    "Accounting": "Finance & accounting", "Accounting and Finance": "Finance & accounting", "Accounting and Business Education": "Finance & accounting", "Finance": "Finance & accounting", "Finance and Investment": "Finance & accounting", "Financial Engineering": "Finance & accounting", "Banking and Investment Management": "Finance & accounting", "Banking and Financial Economics": "Finance & accounting", "Economics and Econometrics": "Finance & accounting", "Actuarial Science": "Finance & accounting", "Fiscal Studies": "Finance & accounting", "Risk Management and Insurance": "Finance & accounting",
    "Civil and Water Engineering": "Engineering & industrial", "Chemical Engineering": "Engineering & industrial", "Chemical and Environmental Process Engineering": "Engineering & industrial", "Electronic Engineering": "Engineering & industrial", "Electrical Engineering": "Engineering & industrial", "Telecommunications Engineering": "Engineering & industrial", "Industrial and Manufacturing Engineering": "Engineering & industrial", "Manufacturing Engineering and Operations Management": "Engineering & industrial", "Manufacturing Systems and Operations Management": "Engineering & industrial", "Fibre and Polymer Materials Engineering": "Engineering & industrial", "Mechanical and Industrial Engineering": "Engineering & industrial",
    "Quantity Surveying": "Construction & property", "Property Development and Estate Management": "Construction & property", "Construction Management": "Construction & property", "Construction Project Management": "Construction & property", "Architectural Studies Honours Degree": "Construction & property", "Architecture Degree": "Construction & property", "Urban Design Degree": "Construction & property", "Construction Engineering": "Construction & property", "Civil and Construction Engineering": "Construction & property",
    "Medicine and Surgery": "Health & clinical", "Midwifery Education": "Health & clinical", "Medical Ultrasound": "Health & clinical", "Medical Physics": "Health & clinical", "Radiography": "Health & clinical", "Public Health": "Health & clinical", "Environmental Health": "Health & clinical", "Environmental Science and Health": "Environment & geospatial",
    "Geographical Information Systems and Remote Sensing in Natural Resources Management": "Environment & geospatial", "Applied Geographical Information Science and Remote Sensing": "Environment & geospatial", "Climate Change and Sustainable Development": "Environment & geospatial", "Forest Resources and Wildlife Management": "Environment & geospatial", "Wildlife and Protected Area Management": "Environment & geospatial", "Water Resources Engineering": "Environment & geospatial", "Water Supply and Sanitation": "Environment & geospatial", "Environmental Science and Health": "Environment & geospatial",
    "Journalism and Media Studies": "Media & information", "Strategic Communication": "Media & information", "Publishing Media and Technology Studies": "Media & information", "Library and Information Science": "Media & information", "Records and Archives Management": "Media & information", "Information Management and Technology": "Media & information",
    "Marketing": "Sales & marketing", "Strategic Marketing": "Sales & marketing",
    "Management": "Management & operations", "Business Administration": "Management & operations", "Strategic Management": "Management & operations", "Public Management": "Management & operations", "Business Leadership": "Management & operations", "Leadership and Management": "Management & operations", "Governance and Leadership": "Management & operations", "Development Studies": "Management & operations", "Disaster Management": "Management & operations",
    "Food Science and Technology": "Food, agriculture & bioscience", "Biotechnology": "Food, agriculture & bioscience", "Applied Biology and Biochemistry": "Food, agriculture & bioscience", "Applied Microbiology and Biotechnology": "Food, agriculture & bioscience", "Applied Chemistry": "Food, agriculture & bioscience", "Analytical Chemistry": "Food, agriculture & bioscience", "Chemical Technology": "Food, agriculture & bioscience",
}


def cluster_for_programme(name):
    if name in PROGRAMME_HINTS:
        return PROGRAMME_HINTS[name]
    if "Education" in name or name in {"Physics", "Mathematics", "Biology", "Chemistry", "Tertiary and Higher Education", "Science and Technology Education"}:
        return "Education & training"
    if "Sports Science" in name:
        return "Health & clinical"
    return "Management & operations"


def cluster_for_job(job):
    text = " " + " ".join(str(job.get(key, "")) for key in ("title", "summary", "description"))[:5000].lower() + " "
    title = str(job.get("title", "")).lower()
    scores = {}
    for cluster, terms in CLUSTERS.items():
        scores[cluster] = sum((4 if term.strip() in title else 1) for term in terms if term in text)
    best, score = max(scores.items(), key=lambda item: item[1])
    return best if score else "Management & operations"


def date_from_job(job):
    match = re.search(r"(2026-\d{2}-\d{2})", str(job.get("posted_text", "")))
    return match.group(1) if match else str(job.get("discovered_at", ""))[:10]


def metric_rows(counter, name="name", value="value"):
    return [{name: key, value: val} for key, val in counter.most_common()]


def main():
    awards = read_csv(SECTION_B)
    graduates = read_csv(SECTION_C)
    jobs = json.loads(JOBS.read_text(encoding="utf-8-sig"))

    # Cross-source duplicate suppression for the vacancy sample.
    unique_jobs = {}
    for job in jobs:
        key = re.sub(r"\W+", " ", f"{job.get('title','')} {job.get('company','')}".lower()).strip()
        unique_jobs.setdefault(key, job)
    jobs = [job for job in unique_jobs.values() if date_from_job(job).startswith("2026-")]
    for job in jobs:
        job["market_cluster"] = cluster_for_job(job)
        job["observed_date"] = date_from_job(job)

    programme = defaultdict(lambda: {"graduates": 0, "faculties": Counter(), "levels": Counter()})
    faculty = defaultdict(lambda: {"graduates": 0, "undergraduate": 0, "postgraduate": 0, "programmes": set()})
    level_counts = Counter()
    for row in graduates:
        family = compact_programme(row["degree_program"])
        level = row["degree_level"]
        is_postgrad = level.startswith("Master") or level.startswith("Doctor") or level.startswith("Postgraduate")
        programme[family]["graduates"] += 1
        programme[family]["faculties"][row["faculty"]] += 1
        programme[family]["levels"][level] += 1
        faculty[row["faculty"]]["graduates"] += 1
        faculty[row["faculty"]]["postgraduate" if is_postgrad else "undergraduate"] += 1
        faculty[row["faculty"]]["programmes"].add(family)
        level_counts[level] += 1

    award_by_programme = defaultdict(lambda: {"recipients": 0, "prizes": 0, "first_divisions": 0, "distinctions": 0, "female": 0, "male": 0})
    award_by_faculty = defaultdict(lambda: {"recipients": 0, "prizes": 0, "first_divisions": 0, "distinctions": 0, "female": 0, "male": 0})
    for row in awards:
        family = compact_programme(row["section_b_degree_program"])
        bucket = award_by_programme[family]
        f_bucket = award_by_faculty[row["faculty"]]
        for target in (bucket, f_bucket):
            target["prizes"] += integer(row["award_count"])
            target["recipients"] += integer(row["award_count"]) > 0
            target["first_divisions"] += row["degree_classification"] == "First Division"
            target["distinctions"] += row["degree_classification"] == "Distinction"
            target["female"] += row["gender"] == "F"
            target["male"] += row["gender"] == "M"

    vacancy_counts = Counter(job["market_cluster"] for job in jobs)
    programme_rows = []
    for name, values in programme.items():
        cluster = cluster_for_programme(name)
        vacancies = vacancy_counts[cluster]
        graduates_count = values["graduates"]
        awards_values = award_by_programme[name]
        programme_rows.append({
            "programme": name,
            "faculty": values["faculties"].most_common(1)[0][0],
            "cluster": cluster,
            "graduates": graduates_count,
            "vacancies": vacancies,
            "vacancies_per_100_graduates": round(vacancies * 100 / graduates_count, 1),
            "observed_pressure_gap": vacancies - graduates_count,
            **awards_values,
        })

    faculty_rows = []
    for name, values in faculty.items():
        award_values = award_by_faculty[name]
        faculty_rows.append({
            "faculty": name.replace("Faculty of The ", "").replace("Faculty of ", ""),
            "full_faculty": name,
            "graduates": values["graduates"],
            "undergraduate": values["undergraduate"],
            "postgraduate": values["postgraduate"],
            "programmes": len(values["programmes"]),
            **award_values,
        })

    masters = [row for row in graduates if row["degree_level"].startswith("Master")]
    master_counts = Counter(compact_programme(row["degree_program"]) for row in masters)
    master_awards = [row for row in awards if row["degree_level"].startswith("Master")]
    master_award_counts = Counter()
    master_first = Counter()
    for row in master_awards:
        family = compact_programme(row["section_b_degree_program"])
        master_award_counts[family] += integer(row["award_count"])
        master_first[family] += row["degree_classification"] == "Distinction"

    market_rows = []
    for cluster, count in vacancy_counts.most_common():
        supply = sum(item["graduates"] for item in programme_rows if item["cluster"] == cluster)
        market_rows.append({
            "cluster": cluster,
            "vacancies": count,
            "graduates": supply,
            "vacancies_per_100_graduates": round(count * 100 / supply, 1) if supply else None,
            "observed_pressure_gap": count - supply,
        })

    prize_recipients = [row for row in awards if integer(row["award_count"]) > 0]
    top_prize_people = sorted(({
        "name": row["section_b_full_name"], "gender": row["gender"], "faculty": row["faculty"].replace("Faculty of ", ""),
        "programme": compact_programme(row["section_b_degree_program"]), "prizes": integer(row["award_count"]),
    } for row in prize_recipients), key=lambda item: (-item["prizes"], item["name"]))

    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "headline_reported_total": 2570,
        "graduate_records": len(graduates),
        "record_difference": len(graduates) - 2570,
        "faculties": len(faculty),
        "programme_families": len(programme),
        "degree_programmes": len(set(row["degree_program"] for row in graduates)),
        "postgraduates": sum(v["postgraduate"] for v in faculty.values()),
        "masters": len(masters),
        "doctorates": sum(row["degree_level"].startswith("Doctor") for row in graduates),
        "award_records": len(awards),
        "prize_recipients": len(prize_recipients),
        "prizes": sum(integer(row["award_count"]) for row in awards),
        "first_divisions": sum(row["degree_classification"] == "First Division" for row in awards),
        "distinctions": sum(row["degree_classification"] == "Distinction" for row in awards),
        "award_gender": dict(Counter("Female" if row["gender"] == "F" else "Male" for row in prize_recipients)),
        "award_population_gender": dict(Counter("Female" if row["gender"] == "F" else "Male" for row in awards)),
        "vacancy_sample": len(jobs),
        "vacancy_sources": len(set(job["source"] for job in jobs)),
        "vacancy_date_min": min(job["observed_date"] for job in jobs),
        "vacancy_date_max": max(job["observed_date"] for job in jobs),
        "faculty_rows": sorted(faculty_rows, key=lambda row: -row["graduates"]),
        "programme_rows": sorted(programme_rows, key=lambda row: -row["graduates"]),
        "qualification_levels": metric_rows(level_counts),
        "market_rows": market_rows,
        "master_programmes": [{"programme": name, "graduates": count, "prizes": master_awards.get(name, 0) if False else master_award_counts[name], "distinctions": master_first[name]} for name, count in master_counts.most_common()],
        "top_prize_recipients": top_prize_people[:30],
        "method": {
            "graduate_source": SECTION_C.name,
            "award_source": SECTION_B.name,
            "vacancy_sources": sorted(set(job["source"] for job in jobs)),
            "vacancy_deduplication": "Normalized title + employer across sources; earliest retained.",
            "market_model": "Vacancy titles and descriptions are classified into 13 occupational clusters. Programme families map to one primary cluster. Ratios compare observed 2026 postings with one graduation cohort and are directional, not unemployment or shortage estimates.",
        },
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "data.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for source, target in ((SECTION_B, OUT / "awards-and-distinctions.csv"), (SECTION_C, OUT / "graduates.csv")):
        target.write_bytes(source.read_bytes())
    with (OUT / "programme-analysis.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=programme_rows[0].keys())
        writer.writeheader()
        writer.writerows(sorted(programme_rows, key=lambda row: -row["graduates"]))
    print(json.dumps({key: result[key] for key in ("graduate_records", "programme_families", "masters", "prizes", "first_divisions", "distinctions", "vacancy_sample")}, indent=2))


if __name__ == "__main__":
    main()
