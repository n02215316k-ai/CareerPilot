"use client";

import {
  Download,
  FileText,
  History,
  ListChecks,
  LogOut,
  Plus,
  Save,
  Sparkles,
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
  ProjectItem,
  SessionUser,
} from "@/lib/types";

type Tab = "profile" | "upload" | "tailor" | "history";
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

  const completion = useMemo(() => profileCompleteness(profile), [profile]);

  useEffect(() => {
    void loadProfile();
    void loadHistory();
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function responseError(response: Response) {
  const payload = await response.json().catch(() => ({ error: "Request failed." }));
  return payload.error || "Request failed.";
}
