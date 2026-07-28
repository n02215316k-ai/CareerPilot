"use client";

import { BriefcaseBusiness, Lock, LogIn, Mail, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";

export default function AuthPanel() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      window.location.reload();
      return;
    }

    const payload = await response.json().catch(() => ({ error: "Authentication failed." }));
    setStatus(payload.error || "Authentication failed.");
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10">
        <section className="grid w-full overflow-hidden border border-[#d9dee5] bg-white md:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-[#0f766e] p-8 text-white md:p-10">
            <div className="flex items-center gap-3">
              <img src="/brand-mark.svg" alt="CareerPilot" className="h-12 w-12" />
              <div>
                <p className="text-sm uppercase tracking-[0.16em] text-[#c7f2eb]">CareerPilot</p>
                <h1 className="text-3xl font-semibold tracking-normal">CV Builder</h1>
              </div>
            </div>
            <div className="mt-12 grid gap-4 text-sm text-[#e6fffb]">
              <div className="flex gap-3 border-l-4 border-[#fbbf24] pl-4">
                <BriefcaseBusiness className="mt-0.5 h-5 w-5 shrink-0" />
                <p>Verified career profiles, tailored CVs, and export-ready documents for real applications.</p>
              </div>
              <p className="max-w-sm text-[#d8f4ef]">
                Facts stay user-confirmed. AI improves structure, grammar, emphasis, and job alignment without inventing experience.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="p-8 md:p-10">
            <div className="flex gap-2 border border-[#d9dee5] p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex h-10 flex-1 items-center justify-center gap-2 text-sm font-medium ${
                  mode === "login" ? "bg-[#172026] text-white" : "text-[#42515c]"
                }`}
              >
                <LogIn className="h-4 w-4" /> Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`flex h-10 flex-1 items-center justify-center gap-2 text-sm font-medium ${
                  mode === "register" ? "bg-[#172026] text-white" : "text-[#42515c]"
                }`}
              >
                <UserPlus className="h-4 w-4" /> Register
              </button>
            </div>

            <div className="mt-8 grid gap-5">
              <label className="grid gap-2 text-sm font-medium text-[#25313a]">
                Email
                <span className="flex items-center gap-2 border border-[#cbd3dc] bg-white px-3">
                  <Mail className="h-4 w-4 text-[#677683]" />
                  <input
                    className="h-11 min-w-0 flex-1 outline-none"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </span>
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#25313a]">
                Password
                <span className="flex items-center gap-2 border border-[#cbd3dc] bg-white px-3">
                  <Lock className="h-4 w-4 text-[#677683]" />
                  <input
                    className="h-11 min-w-0 flex-1 outline-none"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </span>
              </label>
            </div>

            {status ? <p className="mt-5 border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-sm text-[#9f1239]">{status}</p> : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-7 flex h-11 w-full items-center justify-center gap-2 bg-[#0f766e] px-4 font-semibold text-white disabled:opacity-60"
            >
              {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {busy ? "Working" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
