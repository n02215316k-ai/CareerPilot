"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Search, ShieldCheck, TriangleAlert, UsersRound } from "lucide-react";
import styles from "./graduate-insights.module.css";

type Row = { record_id: number; full_name: string; given_names: string; surname: string; faculty: string; programme: string; ocr_confidence: "high" | "review"; source_image: string; source_row_number: string };
type Datum = { name: string; value: number };
type Dataset = { official_total: number; official_stem_share: number; records: number; high_confidence: number; review_required: number; faculty_counts: Datum[]; top_surnames: Datum[]; rows: Row[] };

const shortFaculty: Record<string, string> = {
  "Business and Economic Sciences": "Business",
  "Science and Technology Education": "Science Education",
  "Communication and Information Science": "Communication",
};

export default function GraduateInsights() {
  const [data, setData] = useState<Dataset | null>(null);
  const [query, setQuery] = useState("");
  const [faculty, setFaculty] = useState("All faculties");
  const [quality, setQuality] = useState("All records");
  const [view, setView] = useState<"overview" | "explorer" | "method">("overview");

  useEffect(() => { fetch("/graduate-insights/data.json").then((r) => r.json()).then(setData); }, []);
  const filtered = useMemo(() => !data ? [] : data.rows.filter((row) => {
    const search = `${row.full_name} ${row.surname} ${row.faculty}`.toLowerCase();
    return (!query || search.includes(query.toLowerCase())) && (faculty === "All faculties" || row.faculty === faculty) && (quality === "All records" || row.ocr_confidence === quality);
  }), [data, query, faculty, quality]);

  if (!data) return <main className={styles.loading}>Preparing the graduate dataset...</main>;
  const verifiedRate = Math.round((data.high_confidence / data.records) * 100);
  const coverageRate = Math.round((data.records / data.official_total) * 100);
  const topFive = data.top_surnames.slice(0, 5).reduce((sum, item) => sum + item.value, 0);
  const maxFaculty = Math.max(...data.faculty_counts.map((item) => item.value));

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><a className={styles.brand} href="/">CareerPilot <span>Research Desk</span></a><p>NUST 32nd Graduation Ceremony · 2026 booklet</p></div>
      <a className={styles.download} href="/graduate-insights/graduates.csv" download><Download size={17}/> Download CSV</a>
    </header>

    <section className={styles.intro}>
      <div><p className={styles.eyebrow}>Graduate intelligence</p><h1>What the graduation booklet reveals</h1><p className={styles.lede}>A searchable, auditable view of the photographed programme. Every row links back to its source image and carries an extraction-quality flag.</p></div>
      <div className={styles.coverage}><span>{coverageRate}%</span><p>of the official cohort recovered as rows</p><div><i style={{width: `${coverageRate}%`}} /></div></div>
    </section>

    <nav className={styles.tabs} aria-label="Analysis views">
      {(["overview", "explorer", "method"] as const).map((item) => <button key={item} onClick={() => setView(item)} className={view === item ? styles.active : ""}>{item === "method" ? "Method & caveats" : item}</button>)}
    </nav>

    {view === "overview" && <>
      <section className={styles.metrics}>
        <article><UsersRound/><p>Official cohort</p><strong>{data.official_total.toLocaleString()}</strong><small>graduates capped at the 32nd ceremony</small></article>
        <article><ShieldCheck/><p>Recovered from images</p><strong>{data.records.toLocaleString()}</strong><small>{coverageRate}% coverage; {verifiedRate}% structurally clean</small></article>
        <article><TriangleAlert/><p>Manual review queue</p><strong>{data.review_required.toLocaleString()}</strong><small>retained, never silently discarded</small></article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>Recovered sample</p><h2>Captured rows by faculty</h2></div><span>not official totals</span></div>
          <div className={styles.bars}>{data.faculty_counts.map((item, index) => <button key={item.name} onClick={() => {setFaculty(item.name); setView("explorer")}} title={`Explore ${item.name}`}><span>{shortFaculty[item.name] || item.name}</span><i><b style={{width: `${item.value / maxFaculty * 100}%`, background: `var(--chart-${index % 4})`}} /></i><strong>{item.value}</strong></button>)}</div>
        </article>
        <article className={styles.panel}><div className={styles.panelHead}><div><p className={styles.kicker}>Name ecology</p><h2>Most frequent surnames</h2></div><span>high-confidence only</span></div>
          <div className={styles.surnames}>{data.top_surnames.map((item, index) => <button key={item.name} onClick={() => {setQuery(item.name); setView("explorer")}} style={{fontSize: `${Math.max(13, 13 + item.value / 5)}px`}}><span>{item.name}</span><b>{item.value}</b></button>)}</div>
        </article>
      </section>

      <section className={styles.findings}>
        <div><p className={styles.kicker}>Signals beneath the surface</p><h2>Five findings worth investigating</h2></div>
        <ol>
          <li><b>The official cohort is 2,570.</b><span>{data.records} names are currently searchable, giving {coverageRate}% row-level coverage. Missing OCR rows are not treated as absent graduates.</span></li>
          <li><b>STEM dominates the full cohort.</b><span>{data.official_stem_share}% of graduands received STEM qualifications, according to the published ceremony report.</span></li>
          <li><b>A small surname set recurs heavily.</b><span>The five most common normalized surnames account for {topFive} high-confidence records, useful for entity matching but not evidence of family relationships.</span></li>
          <li><b>OCR errors are systematic.</b><span>Curved pages disproportionately alter initials and common surnames; confidence drops at gutters, edges and multi-column transitions.</span></li>
          <li><b>The booklet is analytically split.</b><span>Awards pages include gender and prizes, while the full graduate lists omit gender. Gender parity cannot be inferred from the full cohort without another source.</span></li>
        </ol>
      </section>
    </>}

    {view === "explorer" && <section className={styles.explorer}>
      <div className={styles.controls}><label><Search/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a name or surname"/></label><select value={faculty} onChange={(e) => setFaculty(e.target.value)}><option>All faculties</option>{data.faculty_counts.map((item) => <option key={item.name}>{item.name}</option>)}</select><select value={quality} onChange={(e) => setQuality(e.target.value)}><option>All records</option><option value="high">High confidence</option><option value="review">Needs review</option></select></div>
      <div className={styles.resultLine}><strong>{filtered.length}</strong> matching recovered records <button onClick={() => {setQuery("");setFaculty("All faculties");setQuality("All records")}}>Clear filters</button></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Name</th><th>Faculty</th><th>Quality</th><th>Source row</th></tr></thead><tbody>{filtered.slice(0, 300).map((row) => <tr key={row.record_id}><td><b>{row.full_name}</b><small>{row.surname}</small></td><td>{row.faculty}</td><td><span className={row.ocr_confidence === "high" ? styles.good : styles.review}>{row.ocr_confidence === "high" ? "High" : "Review"}</span></td><td><code>{row.source_row_number}</code><small>{row.source_image}</small></td></tr>)}</tbody></table>{filtered.length > 300 && <p className={styles.limit}>Showing the first 300 matches. Download the CSV for all rows.</p>}</div>
    </section>}

    {view === "method" && <section className={styles.method}><article><p className={styles.kicker}>Scope</p><h2>2,570 official graduates</h2><p>The official ceremony total is 2,570. The downloadable CSV contains {data.records} OCR-recovered names from 99 phone photographs, not the complete official register. The coverage gap is shown explicitly throughout this page.</p></article><article><p className={styles.kicker}>Important limitation</p><h2>Do not use as an official register</h2><p>Page curvature, faint print, bleed-through and two-column layouts mean some people are missing or misspelled. “High confidence” means the row passed extraction checks, not that it was independently verified against university records.</p></article><article><p className={styles.kicker}>Responsible analysis</p><h2>No inferred demographics</h2><p>Gender is blank in the full list and was not guessed from names. Shared surnames are descriptive frequencies only. They do not imply ethnicity, kinship or origin.</p></article></section>}

    <footer><p>CareerPilot Research Desk · Source: photographed NUST 32nd Graduation Ceremony booklet</p><a href="/">Return to CareerPilot</a></footer>
  </main>;
}
