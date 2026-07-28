"use client";

import {
  BriefcaseBusiness,
  Download,
  ExternalLink,
  FileText,
  History,
  ListChecks,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { emptyProfile, mergeProfiles, profileCompleteness } from "@/lib/profile";
import type {
  CareerProfile,
  CertificationItem,
  CvDocument,
  EducationItem,
  ExperienceItem,
  GeneratedCvRecord,
  JobListing,
  JobRecommendation,
  JobSyncRun,
  ProjectItem,
  SessionUser,
} from "@/lib/types";

type Tab = "profile" | "upload" | "jobs" | "tailor" | "history";
type CvTemplate = "firstjob" | "ats" | "graduate" | "technical";

const inputClass = "h-10 w-full border border-[#cbd3dc] bg-white px-3 text-sm outline-none focus:border-[#0f766e]";
const areaClass = "min-h-24 w-full border border-[#cbd3dc] bg-white px-3 py-2 text-sm outline-none focus:border-[#0f766e]";
const labelClass = "grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#53616d]";

const blankEducation: EducationItem = {
  institution: "",
  qualification: "",
  field: "",
  startDate: "",
  endDate: "",
  details: "",
};

const blankExperience: ExperienceItem = {
  company: "",
  role: "",
  location: "",
  startDate: "",
  endDate: "",
  bullets: [],
};

const blankProject: ProjectItem = {
  name: "",
  role: "",
  technologies: [],
  description: "",
  outcome: "",
};

const blankCertification: CertificationItem = {
  name: "",
  issuer: "",
  date: "",
};

export default function Dashboard({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<CareerProfile>(() => clone(emptyProfile));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [cvText, setCvText] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [pendingExtractedProfile, setPendingExtractedProfile] = useState<CareerProfile | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [template, setTemplate] = useState<CvTemplate>("firstjob");
  const [generatedCv, setGeneratedCv] = useState<CvDocument | null>(null);
  const [currentCvId, setCurrentCvId] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedCvRecord[]>([]);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>([]);
  const [jobSyncRuns, setJobSyncRuns] = useState<JobSyncRun[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobSource, setJobSource] = useState("all");

  const completion = useMemo(() => profileCompleteness(profile), [profile]);

  useEffect(() => {
    void loadProfile();
    void loadHistory();
    void loadJobs();
  }, []);

  async function loadProfile() {
    const response = await fetch("/api/profile");
    if (response.ok) {
      const payload = await response.json();
      setProfile(payload.profile);
    }
  }

  async function loadHistory() {
    const response = await fetch("/api/cvs");
    if (response.ok) {
      const payload = await response.json();
      setHistory(payload.cvs || []);
    }
  }

  async function loadJobs() {
    setJobsLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (jobSearch.trim()) params.set("search", jobSearch.trim());
    if (jobLocation.trim()) params.set("location", jobLocation.trim());
    if (jobSource !== "all") params.set("source", jobSource);

    try {
      const [jobsResponse, recommendationsResponse] = await Promise.all([
        fetch(`/api/jobs?${params.toString()}`),
        fetch("/api/jobs/recommendations"),
      ]);

      if (jobsResponse.ok) {
        const payload = await jobsResponse.json();
        setJobs(payload.jobs || []);
        setJobSyncRuns(payload.syncRuns || []);
      } else {
        setStatus(await responseError(jobsResponse));
      }

      if (recommendationsResponse.ok) {
        const payload = await recommendationsResponse.json();
        setRecommendations(payload.recommendations || []);
        if (!jobSyncRuns.length) setJobSyncRuns(payload.syncRuns || []);
      }
    } catch {
      setStatus("Could not load jobs.");
    } finally {
      setJobsLoading(false);
    }
  }

  async function saveProfile(nextProfile = profile) {
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextProfile),
    });
    setBusy(false);
    setStatus(response.ok ? "Profile saved." : await responseError(response));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  async function extractCv() {
    setBusy(true);
    setStatus("");
    const formData = new FormData();
    formData.set("pastedText", cvText);
    if (cvFile) formData.set("file", cvFile);

    const response = await fetch("/api/extract", { method: "POST", body: formData });
    setBusy(false);

    if (response.ok) {
      const payload = await response.json();
      setPendingExtractedProfile(payload.extractedProfile);
      setQuestions(payload.missingInformation || []);
      setStatus("CV extracted. Review it before applying it to the verified profile.");
      return;
    }

    setStatus(await responseError(response));
  }

  async function findGaps() {
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setBusy(false);

    if (response.ok) {
      const payload = await response.json();
      setQuestions(payload.questions || []);
      setStatus("Profile questions refreshed.");
      return;
    }

    setStatus(await responseError(response));
  }

  async function saveAnswers() {
    const additions = Object.entries(answers)
      .map(([index, answer]) => {
        const question = questions[Number(index)];
        return answer.trim() && question ? `${question} ${answer.trim()}` : "";
      })
      .filter(Boolean);
    if (!additions.length) return;
    const nextProfile = { ...profile, achievements: [...profile.achievements, ...additions] };
    setProfile(nextProfile);
    setAnswers({});
    await saveProfile(nextProfile);
  }

  async function applyExtractedProfile() {
    if (!pendingExtractedProfile) return;
    const nextProfile = mergeProfiles(profile, pendingExtractedProfile);
    setProfile(nextProfile);
    setPendingExtractedProfile(null);
    await saveProfile(nextProfile);
    setActiveTab("profile");
    setStatus("Extracted CV details applied to the verified profile.");
  }

  async function generateCv() {
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, jobTitle, jobDescription, template }),
    });
    setBusy(false);

    if (response.ok) {
      const payload = await response.json();
      setGeneratedCv(payload.cv);
      setCurrentCvId(payload.id);
      setStatus("CV generated.");
      await loadHistory();
      return;
    }

    setStatus(await responseError(response));
  }

  async function download(kind: "docx" | "pdf" | "text") {
    if (!generatedCv) return;
    const response = await fetch(`/api/export/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(generatedCv),
    });
    if (!response.ok) {
      setStatus(await responseError(response));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug(generatedCv.title)}.${kind}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function saveGeneratedEdits() {
    if (!generatedCv || !currentCvId) return;
    setBusy(true);
    setStatus("");
    const response = await fetch(`/api/cvs/${currentCvId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(generatedCv),
    });
    setBusy(false);
    setStatus(response.ok ? "CV edits saved to history." : await responseError(response));
    if (response.ok) await loadHistory();
  }

  function useJobForCv(job: JobListing) {
    setJobTitle(job.title);
    setJobDescription(formatJobForTailoring(job));
    setGeneratedCv(null);
    setCurrentCvId(null);
    setActiveTab("tailor");
    setStatus(`Loaded ${job.title} into the CV tailoring workflow.`);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#172026]">
      <header className="no-print border-b border-[#d9dee5] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/brand-mark.svg" alt="CareerPilot" className="h-10 w-10" />
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#0f766e]">CareerPilot</p>
              <h1 className="text-lg font-semibold">AI CV Builder</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#53616d]">
            <span className="hidden sm:inline">{user.email}</span>
            <button onClick={logout} className="flex h-9 items-center gap-2 border border-[#cbd3dc] bg-white px-3">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[220px_1fr]">
        <aside className="no-print border border-[#d9dee5] bg-white p-3 lg:min-h-[calc(100vh-92px)]">
          <div className="mb-3 border border-[#d9dee5] p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Profile</span>
              <span className="text-[#0f766e]">{completion}%</span>
            </div>
            <div className="mt-2 h-2 bg-[#e7ebef]">
              <div className="h-2 bg-[#f59e0b]" style={{ width: `${completion}%` }} />
            </div>
          </div>
          <nav className="grid gap-2">
            <TabButton active={activeTab === "profile"} icon={<UserRound />} label="Profile" onClick={() => setActiveTab("profile")} />
            <TabButton active={activeTab === "upload"} icon={<Upload />} label="Upload" onClick={() => setActiveTab("upload")} />
            <TabButton active={activeTab === "jobs"} icon={<BriefcaseBusiness />} label="Jobs" onClick={() => setActiveTab("jobs")} />
            <TabButton active={activeTab === "tailor"} icon={<Sparkles />} label="Tailor" onClick={() => setActiveTab("tailor")} />
            <TabButton active={activeTab === "history"} icon={<History />} label="History" onClick={() => setActiveTab("history")} />
          </nav>
        </aside>

        <section className="grid gap-4">
          {status ? <div className="no-print border border-[#fbbf24] bg-[#fffbeb] px-4 py-3 text-sm text-[#784a06]">{status}</div> : null}

          {activeTab === "profile" ? (
            <ProfileTab
              profile={profile}
              setProfile={setProfile}
              questions={questions}
              answers={answers}
              setAnswers={setAnswers}
              busy={busy}
              onFindGaps={findGaps}
              onSaveAnswers={saveAnswers}
              onSave={() => void saveProfile()}
            />
          ) : null}

          {activeTab === "upload" ? (
            <UploadTab
              busy={busy}
              cvText={cvText}
              setCvText={setCvText}
              setCvFile={setCvFile}
              pendingExtractedProfile={pendingExtractedProfile}
              onApplyExtracted={applyExtractedProfile}
              onDiscardExtracted={() => setPendingExtractedProfile(null)}
              onExtract={extractCv}
            />
          ) : null}

          {activeTab === "jobs" ? (
            <JobsTab
              jobs={jobs}
              recommendations={recommendations}
              syncRuns={jobSyncRuns}
              jobsLoading={jobsLoading}
              search={jobSearch}
              setSearch={setJobSearch}
              location={jobLocation}
              setLocation={setJobLocation}
              source={jobSource}
              setSource={setJobSource}
              onRefresh={loadJobs}
              onUseJob={useJobForCv}
            />
          ) : null}

          {activeTab === "tailor" ? (
            <TailorTab
              busy={busy}
              jobTitle={jobTitle}
              setJobTitle={setJobTitle}
              jobDescription={jobDescription}
              setJobDescription={setJobDescription}
              template={template}
              setTemplate={setTemplate}
              generatedCv={generatedCv}
              setGeneratedCv={setGeneratedCv}
              onGenerate={generateCv}
              onSaveEdited={saveGeneratedEdits}
              onDownload={download}
            />
          ) : null}

          {activeTab === "history" ? (
            <HistoryTab
              history={history}
              onLoad={(cv) => {
                setGeneratedCv(cv.content);
                setCurrentCvId(cv.id);
                setJobTitle(cv.jobTitle);
                setTemplate((cv.template as CvTemplate) || "firstjob");
                setActiveTab("tailor");
              }}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function ProfileTab({
  profile,
  setProfile,
  questions,
  answers,
  setAnswers,
  busy,
  onFindGaps,
  onSaveAnswers,
  onSave,
}: {
  profile: CareerProfile;
  setProfile: (profile: CareerProfile) => void;
  questions: string[];
  answers: Record<number, string>;
  setAnswers: (answers: Record<number, string>) => void;
  busy: boolean;
  onFindGaps: () => void;
  onSaveAnswers: () => void;
  onSave: () => void;
}) {
  const update = (patch: Partial<CareerProfile>) => setProfile({ ...profile, ...patch });
  const updatePersonal = (key: keyof CareerProfile["personalDetails"], value: string) =>
    update({ personalDetails: { ...profile.personalDetails, [key]: value } });
  const updateSkills = (key: keyof CareerProfile["skills"], value: string) =>
    update({ skills: { ...profile.skills, [key]: csv(value) } });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-4">
        <Panel title="Personal Details" icon={<UserRound className="h-5 w-5" />}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Full name" value={profile.personalDetails.fullName} onChange={(value) => updatePersonal("fullName", value)} />
            <Field label="Email" value={profile.personalDetails.email} onChange={(value) => updatePersonal("email", value)} />
            <Field label="Phone" value={profile.personalDetails.phone} onChange={(value) => updatePersonal("phone", value)} />
            <Field label="Location" value={profile.personalDetails.location} onChange={(value) => updatePersonal("location", value)} />
            <Field label="LinkedIn" value={profile.personalDetails.linkedin} onChange={(value) => updatePersonal("linkedin", value)} />
            <Field label="Portfolio" value={profile.personalDetails.portfolio} onChange={(value) => updatePersonal("portfolio", value)} />
          </div>
        </Panel>

        <Panel title="Positioning" icon={<ListChecks className="h-5 w-5" />}>
          <div className="grid gap-3">
            <Field label="Target roles" value={profile.targetRoles.join(", ")} onChange={(value) => update({ targetRoles: csv(value) })} />
            <label className={labelClass}>
              Professional summary
              <textarea className={areaClass} value={profile.professionalSummary} onChange={(event) => update({ professionalSummary: event.target.value })} />
            </label>
          </div>
        </Panel>

        <Panel title="Experience" icon={<BriefcaseMini />}>
          <CollectionActions onAdd={() => update({ experience: [...profile.experience, blankExperience] })} />
          <div className="grid gap-3">
            {profile.experience.map((item, index) => (
              <div key={index} className="border border-[#d9dee5] p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Role" value={item.role} onChange={(value) => replaceAt(profile, setProfile, "experience", index, { ...item, role: value })} />
                  <Field label="Company" value={item.company} onChange={(value) => replaceAt(profile, setProfile, "experience", index, { ...item, company: value })} />
                  <Field label="Location" value={item.location} onChange={(value) => replaceAt(profile, setProfile, "experience", index, { ...item, location: value })} />
                  <Field label="Dates" value={[item.startDate, item.endDate].filter(Boolean).join(" - ")} onChange={(value) => {
                    const [startDate, endDate = ""] = value.split(/\s+-\s+/);
                    replaceAt(profile, setProfile, "experience", index, { ...item, startDate, endDate });
                  }} />
                </div>
                <label className={`${labelClass} mt-3`}>
                  Bullets
                  <textarea className={areaClass} value={item.bullets.join("\n")} onChange={(event) => replaceAt(profile, setProfile, "experience", index, { ...item, bullets: lines(event.target.value) })} />
                </label>
                <RemoveButton onClick={() => removeAt(profile, setProfile, "experience", index)} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Education" icon={<FileText className="h-5 w-5" />}>
          <CollectionActions onAdd={() => update({ education: [...profile.education, blankEducation] })} />
          <div className="grid gap-3">
            {profile.education.map((item, index) => (
              <div key={index} className="border border-[#d9dee5] p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Institution" value={item.institution} onChange={(value) => replaceAt(profile, setProfile, "education", index, { ...item, institution: value })} />
                  <Field label="Qualification" value={item.qualification} onChange={(value) => replaceAt(profile, setProfile, "education", index, { ...item, qualification: value })} />
                  <Field label="Field" value={item.field} onChange={(value) => replaceAt(profile, setProfile, "education", index, { ...item, field: value })} />
                  <Field label="Dates" value={[item.startDate, item.endDate].filter(Boolean).join(" - ")} onChange={(value) => {
                    const [startDate, endDate = ""] = value.split(/\s+-\s+/);
                    replaceAt(profile, setProfile, "education", index, { ...item, startDate, endDate });
                  }} />
                </div>
                <label className={`${labelClass} mt-3`}>
                  Details
                  <textarea className={areaClass} value={item.details} onChange={(event) => replaceAt(profile, setProfile, "education", index, { ...item, details: event.target.value })} />
                </label>
                <RemoveButton onClick={() => removeAt(profile, setProfile, "education", index)} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Projects" icon={<Sparkles className="h-5 w-5" />}>
          <CollectionActions onAdd={() => update({ projects: [...profile.projects, blankProject] })} />
          <div className="grid gap-3">
            {profile.projects.map((item, index) => (
              <div key={index} className="border border-[#d9dee5] p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Name" value={item.name} onChange={(value) => replaceAt(profile, setProfile, "projects", index, { ...item, name: value })} />
                  <Field label="Role" value={item.role} onChange={(value) => replaceAt(profile, setProfile, "projects", index, { ...item, role: value })} />
                  <Field label="Technologies" value={item.technologies.join(", ")} onChange={(value) => replaceAt(profile, setProfile, "projects", index, { ...item, technologies: csv(value) })} />
                  <Field label="Outcome" value={item.outcome} onChange={(value) => replaceAt(profile, setProfile, "projects", index, { ...item, outcome: value })} />
                </div>
                <label className={`${labelClass} mt-3`}>
                  Description
                  <textarea className={areaClass} value={item.description} onChange={(event) => replaceAt(profile, setProfile, "projects", index, { ...item, description: event.target.value })} />
                </label>
                <RemoveButton onClick={() => removeAt(profile, setProfile, "projects", index)} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Volunteering And Activities" icon={<ListChecks className="h-5 w-5" />}>
          <label className={labelClass}>
            Volunteering, community activities, clubs
            <textarea className={areaClass} value={profile.volunteering.join("\n")} onChange={(event) => update({ volunteering: lines(event.target.value) })} />
          </label>
        </Panel>

        <Panel title="Skills And Credentials" icon={<ListChecks className="h-5 w-5" />}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Technical skills" value={profile.skills.technical.join(", ")} onChange={(value) => updateSkills("technical", value)} />
            <Field label="Tools" value={profile.skills.tools.join(", ")} onChange={(value) => updateSkills("tools", value)} />
            <Field label="Soft skills" value={profile.skills.soft.join(", ")} onChange={(value) => updateSkills("soft", value)} />
            <Field label="Languages" value={profile.skills.languages.join(", ")} onChange={(value) => updateSkills("languages", value)} />
          </div>
          <div className="mt-4 border-t border-[#d9dee5] pt-4">
            <CollectionActions onAdd={() => update({ certifications: [...profile.certifications, blankCertification] })} />
            <div className="grid gap-3">
              {profile.certifications.map((item, index) => (
                <div key={index} className="grid gap-3 border border-[#d9dee5] p-3 md:grid-cols-[1fr_1fr_120px_auto]">
                  <Field label="Certification" value={item.name} onChange={(value) => replaceAt(profile, setProfile, "certifications", index, { ...item, name: value })} />
                  <Field label="Issuer" value={item.issuer} onChange={(value) => replaceAt(profile, setProfile, "certifications", index, { ...item, issuer: value })} />
                  <Field label="Date" value={item.date} onChange={(value) => replaceAt(profile, setProfile, "certifications", index, { ...item, date: value })} />
                  <RemoveButton onClick={() => removeAt(profile, setProfile, "certifications", index)} compact />
                </div>
              ))}
            </div>
          </div>
          <label className={`${labelClass} mt-4`}>
            Achievements
            <textarea className={areaClass} value={profile.achievements.join("\n")} onChange={(event) => update({ achievements: lines(event.target.value) })} />
          </label>
          <label className={`${labelClass} mt-3`}>
            References
            <textarea className={areaClass} value={profile.references} onChange={(event) => update({ references: event.target.value })} />
          </label>
        </Panel>
      </div>

      <aside className="no-print grid h-fit gap-4">
        <Panel title="Template Fields" icon={<FileText className="h-5 w-5" />}>
          <div className="grid gap-2 text-sm">
            {templateReadiness(profile).map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 border border-[#d9dee5] px-3 py-2">
                <span>{item.label}</span>
                <span className={`text-xs font-semibold uppercase tracking-[0.08em] ${item.ready ? "text-[#0f766e]" : "text-[#be123c]"}`}>
                  {item.ready ? "Ready" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Review" icon={<Sparkles className="h-5 w-5" />}>
          <div className="flex gap-2">
            <button disabled={busy} onClick={onFindGaps} className="flex h-10 flex-1 items-center justify-center gap-2 bg-[#172026] px-3 text-sm font-semibold text-white disabled:opacity-60">
              <Sparkles className="h-4 w-4" /> Find gaps
            </button>
            <button disabled={busy} onClick={onSave} className="flex h-10 flex-1 items-center justify-center gap-2 bg-[#0f766e] px-3 text-sm font-semibold text-white disabled:opacity-60">
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
          {questions.length ? (
            <div className="mt-4 grid gap-3">
              {questions.map((question, index) => (
                <label key={question} className="grid gap-1 text-sm text-[#25313a]">
                  <span className="font-medium">{question}</span>
                  <textarea className="min-h-20 border border-[#cbd3dc] px-3 py-2 outline-none focus:border-[#0f766e]" value={answers[index] || ""} onChange={(event) => setAnswers({ ...answers, [index]: event.target.value })} />
                </label>
              ))}
              <button onClick={onSaveAnswers} className="flex h-10 items-center justify-center gap-2 border border-[#0f766e] px-3 text-sm font-semibold text-[#0f766e]">
                <Save className="h-4 w-4" /> Save answers
              </button>
            </div>
          ) : null}
        </Panel>
      </aside>
    </div>
  );
}

function UploadTab({
  busy,
  cvText,
  setCvText,
  setCvFile,
  pendingExtractedProfile,
  onApplyExtracted,
  onDiscardExtracted,
  onExtract,
}: {
  busy: boolean;
  cvText: string;
  setCvText: (value: string) => void;
  setCvFile: (file: File | null) => void;
  pendingExtractedProfile: CareerProfile | null;
  onApplyExtracted: () => void;
  onDiscardExtracted: () => void;
  onExtract: () => void;
}) {
  return (
    <Panel title="Existing CV" icon={<Upload className="h-5 w-5" />}>
      <div className="grid gap-4">
        <label className={labelClass}>
          File
          <input
            className="w-full border border-[#cbd3dc] bg-white px-3 py-2 text-sm"
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCvFile(event.target.files?.[0] || null)}
          />
        </label>
        <label className={labelClass}>
          Pasted text
          <textarea className="min-h-72 w-full border border-[#cbd3dc] px-3 py-2 text-sm outline-none focus:border-[#0f766e]" value={cvText} onChange={(event) => setCvText(event.target.value)} />
        </label>
        <button disabled={busy} onClick={onExtract} className="flex h-11 w-fit items-center justify-center gap-2 bg-[#0f766e] px-4 font-semibold text-white disabled:opacity-60">
          <Sparkles className="h-4 w-4" /> Extract profile
        </button>
        {pendingExtractedProfile ? (
          <div className="border border-[#fbbf24] bg-[#fffbeb] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#784a06]">Review extracted profile</h3>
            <div className="mt-3 grid gap-2 text-sm text-[#25313a] md:grid-cols-2">
              <SummaryLine label="Name" value={pendingExtractedProfile.personalDetails.fullName || "Not found"} />
              <SummaryLine label="Contact" value={pendingExtractedProfile.personalDetails.email || pendingExtractedProfile.personalDetails.phone || "Not found"} />
              <SummaryLine label="Education" value={`${pendingExtractedProfile.education.length} entries`} />
              <SummaryLine label="Experience" value={`${pendingExtractedProfile.experience.length} entries`} />
              <SummaryLine label="Projects" value={`${pendingExtractedProfile.projects.length} entries`} />
              <SummaryLine label="Volunteering" value={`${pendingExtractedProfile.volunteering.length} entries`} />
              <SummaryLine label="Skills" value={`${pendingExtractedProfile.skills.technical.length + pendingExtractedProfile.skills.tools.length} entries`} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={onApplyExtracted} className="flex h-10 items-center gap-2 bg-[#0f766e] px-3 text-sm font-semibold text-white">
                <Save className="h-4 w-4" /> Apply to profile
              </button>
              <button onClick={onDiscardExtracted} className="flex h-10 items-center gap-2 border border-[#cbd3dc] bg-white px-3 text-sm font-semibold">
                <Trash2 className="h-4 w-4" /> Discard
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#eadfbd] bg-white px-3 py-2">
      <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#8a6417]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function JobsTab({
  jobs,
  recommendations,
  syncRuns,
  jobsLoading,
  search,
  setSearch,
  location,
  setLocation,
  source,
  setSource,
  onRefresh,
  onUseJob,
}: {
  jobs: JobListing[];
  recommendations: JobRecommendation[];
  syncRuns: JobSyncRun[];
  jobsLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  source: string;
  setSource: (value: string) => void;
  onRefresh: () => void;
  onUseJob: (job: JobListing) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="grid h-fit gap-4">
        <Panel title="Job Board" icon={<BriefcaseBusiness className="h-5 w-5" />}>
          <div className="grid gap-3">
            <label className={labelClass}>
              Keywords
              <div className="flex border border-[#cbd3dc] bg-white focus-within:border-[#0f766e]">
                <span className="flex w-10 items-center justify-center text-[#677683]">
                  <Search className="h-4 w-4" />
                </span>
                <input className="h-10 w-full px-1 text-sm outline-none" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </label>
            <label className={labelClass}>
              Location
              <div className="flex border border-[#cbd3dc] bg-white focus-within:border-[#0f766e]">
                <span className="flex w-10 items-center justify-center text-[#677683]">
                  <MapPin className="h-4 w-4" />
                </span>
                <input className="h-10 w-full px-1 text-sm outline-none" value={location} onChange={(event) => setLocation(event.target.value)} />
              </div>
            </label>
            <label className={labelClass}>
              Source
              <select className={inputClass} value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="all">All approved sources</option>
                <option value="vacancymail">VacancyMail</option>
                <option value="jobszimbabwe">JobsZimbabwe</option>
                <option value="ngojobsinafrica">NGOJobsInAfrica</option>
                <option value="reliefweb">ReliefWeb</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button disabled={jobsLoading} onClick={onRefresh} className="flex h-10 items-center justify-center gap-2 bg-[#0f766e] px-3 text-sm font-semibold text-white disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${jobsLoading ? "animate-spin" : ""}`} /> Refresh
              </button>
              <button
                onClick={() => {
                  setSearch("");
                  setLocation("");
                  setSource("all");
                }}
                className="flex h-10 items-center justify-center border border-[#cbd3dc] bg-white px-3 text-sm font-semibold"
              >
                Clear
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="Sources" icon={<RefreshCw className="h-5 w-5" />}>
          <div className="grid gap-3">
            {syncRuns.length ? syncRuns.map((run) => (
              <div key={run.id} className="border border-[#d9dee5] p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{sourceLabel(run.source)}</span>
                  <span className={`px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${syncStatusClass(run.status)}`}>{run.status}</span>
                </div>
                <p className="mt-2 text-[#53616d]">{run.jobsFound} jobs | {formatDateTime(run.finishedAt)}</p>
                {run.message ? <p className="mt-2 text-[#25313a]">{run.message}</p> : null}
              </div>
            )) : (
              <p className="text-sm text-[#677683]">No sync runs yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4">
        <Panel title="Recommended Matches" icon={<Star className="h-5 w-5" />}>
          <div className="grid gap-3">
            {recommendations.length ? recommendations.slice(0, 8).map((job) => (
              <JobCard key={`recommended-${job.id}`} job={job} onUseJob={onUseJob} />
            )) : (
              <p className="text-sm text-[#677683]">No recommendations yet.</p>
            )}
          </div>
        </Panel>

        <Panel title="Latest Jobs" icon={<BriefcaseBusiness className="h-5 w-5" />}>
          <div className="grid gap-3">
            {jobs.length ? jobs.map((job) => (
              <JobCard key={job.id} job={job} onUseJob={onUseJob} />
            )) : (
              <p className="text-sm text-[#677683]">No jobs found.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function JobCard({ job, onUseJob }: { job: JobListing | JobRecommendation; onUseJob: (job: JobListing) => void }) {
  const recommendation = "score" in job ? job : null;

  return (
    <article className="grid gap-3 border border-[#d9dee5] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[#172026]">{job.title}</h3>
          <p className="mt-1 text-sm text-[#53616d]">{[job.company, job.location].filter(Boolean).join(" | ") || sourceLabel(job.source)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
          <span className="border border-[#cbd3dc] px-2 py-1 text-[#42515c]">{sourceLabel(job.source)}</span>
          {recommendation ? <span className="border border-[#b7dfd9] bg-[#ecfdf5] px-2 py-1 text-[#0f766e]">{Math.min(recommendation.score, 100)} pts</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-[#53616d]">
        {job.jobType ? <span className="border border-[#d9dee5] px-2 py-1">{job.jobType}</span> : null}
        {job.salary ? <span className="border border-[#d9dee5] px-2 py-1">{job.salary}</span> : null}
        {job.postedText ? <span className="border border-[#d9dee5] px-2 py-1">{job.postedText}</span> : null}
        {job.expiresText ? <span className="border border-[#d9dee5] px-2 py-1">{job.expiresText}</span> : null}
      </div>

      {job.summary ? <p className="text-sm leading-6 text-[#25313a]">{job.summary}</p> : null}

      {recommendation?.matchedKeywords.length ? (
        <div className="flex flex-wrap gap-2">
          {recommendation.matchedKeywords.slice(0, 10).map((keyword) => (
            <span key={keyword} className="border border-[#d8eee9] bg-[#f5fffc] px-2 py-1 text-xs text-[#0f766e]">{keyword}</span>
          ))}
        </div>
      ) : null}

      {recommendation?.reasons.length ? (
        <ul className="grid gap-1 text-xs text-[#53616d]">
          {recommendation.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onUseJob(job)} className="flex h-10 items-center justify-center gap-2 bg-[#172026] px-3 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4" /> Tailor CV
        </button>
        <a href={job.url} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 border border-[#cbd3dc] bg-white px-3 text-sm font-semibold">
          <ExternalLink className="h-4 w-4" /> Open source
        </a>
      </div>
    </article>
  );
}

function TailorTab({
  busy,
  jobTitle,
  setJobTitle,
  jobDescription,
  setJobDescription,
  template,
  setTemplate,
  generatedCv,
  setGeneratedCv,
  onGenerate,
  onSaveEdited,
  onDownload,
}: {
  busy: boolean;
  jobTitle: string;
  setJobTitle: (value: string) => void;
  jobDescription: string;
  setJobDescription: (value: string) => void;
  template: CvTemplate;
  setTemplate: (value: CvTemplate) => void;
  generatedCv: CvDocument | null;
  setGeneratedCv: (value: CvDocument) => void;
  onGenerate: () => void;
  onSaveEdited: () => void;
  onDownload: (kind: "docx" | "pdf" | "text") => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Panel title="Job Match" icon={<Sparkles className="h-5 w-5" />}>
        <div className="grid gap-3">
          <Field label="Job title" value={jobTitle} onChange={setJobTitle} />
          <label className={labelClass}>
            Template
            <select className={inputClass} value={template} onChange={(event) => setTemplate(event.target.value as CvTemplate)}>
              <option value="firstjob">First Job Starter</option>
              <option value="ats">ATS</option>
              <option value="graduate">Graduate</option>
              <option value="technical">Technical</option>
            </select>
          </label>
          <label className={labelClass}>
            Job description
            <textarea className="min-h-80 w-full border border-[#cbd3dc] px-3 py-2 text-sm outline-none focus:border-[#0f766e]" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
          </label>
          <button disabled={busy || jobDescription.trim().length < 20} onClick={onGenerate} className="flex h-11 items-center justify-center gap-2 bg-[#0f766e] px-4 font-semibold text-white disabled:opacity-60">
            <Sparkles className="h-4 w-4" /> Generate CV
          </button>
        </div>
      </Panel>

      <Panel title="Editable Preview" icon={<FileText className="h-5 w-5" />}>
        {generatedCv ? (
          <div className="grid gap-4">
            <CvEditor cv={generatedCv} setCv={setGeneratedCv} onDownload={onDownload} />
            <div className="no-print flex justify-end">
              <button disabled={busy} onClick={onSaveEdited} className="flex h-10 items-center gap-2 border border-[#0f766e] bg-white px-3 text-sm font-semibold text-[#0f766e] disabled:opacity-60">
                <Save className="h-4 w-4" /> Save edited version
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-96 items-center justify-center border border-dashed border-[#cbd3dc] text-sm text-[#677683]">
            No CV generated yet.
          </div>
        )}
      </Panel>
    </div>
  );
}

function CvEditor({
  cv,
  setCv,
  onDownload,
}: {
  cv: CvDocument;
  setCv: (value: CvDocument) => void;
  onDownload: (kind: "docx" | "pdf" | "text") => void;
}) {
  const update = (patch: Partial<CvDocument>) => setCv({ ...cv, ...patch });

  return (
    <div className="grid gap-4">
      <div className="no-print flex flex-wrap gap-2">
        <button onClick={() => onDownload("docx")} className="flex h-10 items-center gap-2 bg-[#0f766e] px-3 text-sm font-semibold text-white">
          <Download className="h-4 w-4" /> Word template
        </button>
        <button onClick={() => onDownload("pdf")} className="flex h-10 items-center gap-2 bg-[#172026] px-3 text-sm font-semibold text-white">
          <Download className="h-4 w-4" /> PDF
        </button>
        <button onClick={() => onDownload("text")} className="flex h-10 items-center gap-2 border border-[#cbd3dc] bg-white px-3 text-sm font-semibold">
          <Download className="h-4 w-4" /> Text
        </button>
      </div>

      <div className="bg-white">
        <Field label="Title" value={cv.title} onChange={(value) => update({ title: value })} />
        <div className="mt-3">
          <Field label="Contact" value={cv.contact} onChange={(value) => update({ contact: value })} />
        </div>
        <label className={`${labelClass} mt-3`}>
          Summary
          <textarea className={areaClass} value={cv.summary} onChange={(event) => update({ summary: event.target.value })} />
        </label>
        <label className={`${labelClass} mt-3`}>
          Skills
          <textarea className={areaClass} value={cv.skills.join("\n")} onChange={(event) => update({ skills: lines(event.target.value) })} />
        </label>

        <SectionHeading>Experience</SectionHeading>
        {cv.experience.map((item, index) => (
          <div key={index} className="mt-3 border border-[#d9dee5] p-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Role" value={item.role} onChange={(value) => replaceCvAt(cv, setCv, "experience", index, { ...item, role: value })} />
              <Field label="Company" value={item.company} onChange={(value) => replaceCvAt(cv, setCv, "experience", index, { ...item, company: value })} />
              <Field label="Dates" value={item.dates} onChange={(value) => replaceCvAt(cv, setCv, "experience", index, { ...item, dates: value })} />
            </div>
            <label className={`${labelClass} mt-3`}>
              Bullets
              <textarea className={areaClass} value={item.bullets.join("\n")} onChange={(event) => replaceCvAt(cv, setCv, "experience", index, { ...item, bullets: lines(event.target.value) })} />
            </label>
          </div>
        ))}

        <SectionHeading>Projects</SectionHeading>
        {cv.projects.map((item, index) => (
          <div key={index} className="mt-3 border border-[#d9dee5] p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name" value={item.name} onChange={(value) => replaceCvAt(cv, setCv, "projects", index, { ...item, name: value })} />
              <Field label="Technologies" value={item.technologies.join(", ")} onChange={(value) => replaceCvAt(cv, setCv, "projects", index, { ...item, technologies: csv(value) })} />
            </div>
            <label className={`${labelClass} mt-3`}>
              Bullets
              <textarea className={areaClass} value={item.bullets.join("\n")} onChange={(event) => replaceCvAt(cv, setCv, "projects", index, { ...item, bullets: lines(event.target.value) })} />
            </label>
          </div>
        ))}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className={labelClass}>
            Volunteering
            <textarea className={areaClass} value={cv.volunteering.join("\n")} onChange={(event) => update({ volunteering: lines(event.target.value) })} />
          </label>
          <label className={labelClass}>
            References
            <textarea className={areaClass} value={cv.references} onChange={(event) => update({ references: event.target.value })} />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className={labelClass}>
            Education
            <textarea className={areaClass} value={cv.education.join("\n")} onChange={(event) => update({ education: lines(event.target.value) })} />
          </label>
          <label className={labelClass}>
            Certifications
            <textarea className={areaClass} value={cv.certifications.join("\n")} onChange={(event) => update({ certifications: lines(event.target.value) })} />
          </label>
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ history, onLoad }: { history: GeneratedCvRecord[]; onLoad: (cv: GeneratedCvRecord) => void }) {
  return (
    <Panel title="Generated CVs" icon={<History className="h-5 w-5" />}>
      <div className="grid gap-3">
        {history.length ? history.map((item) => (
          <button key={item.id} onClick={() => onLoad(item)} className="grid gap-1 border border-[#d9dee5] bg-white p-3 text-left hover:border-[#0f766e]">
            <span className="font-semibold">{item.title}</span>
            <span className="text-sm text-[#53616d]">{item.jobTitle || "Untitled role"} | {new Date(item.createdAt).toLocaleString()}</span>
          </button>
        )) : <p className="text-sm text-[#677683]">No generated CVs yet.</p>}
      </div>
    </Panel>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-[#d9dee5] bg-white p-4">
      <div className="mb-4 flex items-center gap-2 border-b border-[#edf0f3] pb-3">
        <span className="text-[#0f766e]">{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={labelClass}>
      {label}
      <input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CollectionActions({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mb-3 flex justify-end">
      <button onClick={onAdd} className="flex h-9 items-center gap-2 border border-[#0f766e] px-3 text-sm font-semibold text-[#0f766e]">
        <Plus className="h-4 w-4" /> Add
      </button>
    </div>
  );
}

function RemoveButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`mt-3 flex items-center justify-center gap-2 border border-[#fecdd3] text-sm font-semibold text-[#be123c] ${compact ? "h-10 px-3 md:mt-6" : "h-9 px-3"}`}
    >
      <Trash2 className="h-4 w-4" /> Remove
    </button>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactElement; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex h-10 items-center gap-3 px-3 text-left text-sm font-semibold ${active ? "bg-[#172026] text-white" : "text-[#42515c] hover:bg-[#edf0f3]"}`}>
      {icon}
      {label}
    </button>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 border-t border-[#d9dee5] pt-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#25313a]">{children}</h3>;
}

function templateReadiness(profile: CareerProfile) {
  return [
    { label: "Name", ready: Boolean(profile.personalDetails.fullName) },
    { label: "Target role", ready: profile.targetRoles.length > 0 },
    { label: "Location", ready: Boolean(profile.personalDetails.location) },
    { label: "Phone or email", ready: Boolean(profile.personalDetails.phone || profile.personalDetails.email) },
    { label: "Personal profile", ready: Boolean(profile.professionalSummary) },
    { label: "Key skills", ready: profile.skills.technical.length + profile.skills.tools.length + profile.skills.soft.length > 0 },
    { label: "Education", ready: profile.education.length > 0 },
    { label: "Experience", ready: profile.experience.length > 0 },
    { label: "Volunteering", ready: profile.volunteering.length > 0 },
    { label: "Projects", ready: profile.projects.length > 0 },
    { label: "References", ready: Boolean(profile.references) },
  ];
}

function BriefcaseMini() {
  return <FileText className="h-5 w-5" />;
}

function replaceAt<K extends "education" | "experience" | "projects" | "certifications">(
  profile: CareerProfile,
  setProfile: (profile: CareerProfile) => void,
  key: K,
  index: number,
  value: CareerProfile[K][number],
) {
  setProfile({
    ...profile,
    [key]: profile[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
  });
}

function removeAt<K extends "education" | "experience" | "projects" | "certifications">(
  profile: CareerProfile,
  setProfile: (profile: CareerProfile) => void,
  key: K,
  index: number,
) {
  setProfile({
    ...profile,
    [key]: profile[key].filter((_, itemIndex) => itemIndex !== index),
  });
}

function replaceCvAt<K extends "experience" | "projects">(
  cv: CvDocument,
  setCv: (cv: CvDocument) => void,
  key: K,
  index: number,
  value: CvDocument[K][number],
) {
  setCv({
    ...cv,
    [key]: cv[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
  });
}

function csv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function slug(value: string) {
  return (value || "careerpilot-cv").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function sourceLabel(source: string) {
  if (source === "vacancymail") return "VacancyMail";
  if (source === "vacancybox") return "VacancyBox";
  if (source === "jobszimbabwe") return "JobsZimbabwe";
  if (source === "ngojobsinafrica") return "NGOJobsInAfrica";
  if (source === "reliefweb") return "ReliefWeb";
  if (source === "zimbajob") return "Zimbajob";
  if (source === "inasi") return "iNasi";
  return source.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function syncStatusClass(status: string) {
  if (status === "success") return "border border-[#b7dfd9] bg-[#ecfdf5] text-[#0f766e]";
  if (status === "error") return "border border-[#fecdd3] bg-[#fff1f2] text-[#be123c]";
  if (status === "skipped") return "border border-[#fde68a] bg-[#fffbeb] text-[#92400e]";
  return "border border-[#d9dee5] bg-[#f6f7f9] text-[#53616d]";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJobForTailoring(job: JobListing) {
  return [
    `Job title: ${job.title}`,
    job.company ? `Company: ${job.company}` : "",
    job.location ? `Location: ${job.location}` : "",
    job.jobType ? `Job type: ${job.jobType}` : "",
    job.salary ? `Salary: ${job.salary}` : "",
    job.expiresText ? `Deadline: ${job.expiresText}` : "",
    job.summary ? `Summary:\n${job.summary}` : "",
    job.description && job.description !== job.summary ? `Description:\n${job.description}` : "",
    `Source: ${sourceLabel(job.source)}`,
    `URL: ${job.url}`,
  ].filter(Boolean).join("\n\n");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function responseError(response: Response) {
  const payload = await response.json().catch(() => ({ error: "Request failed." }));
  return payload.error || "Request failed.";
}
