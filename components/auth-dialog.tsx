"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, X } from "lucide-react";

type AuthUser = { id: string; email: string };
type Props = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
};

export function AuthDialog({ open, onClose, onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/v1/auth/" + mode, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not authenticate.");
      if (!result.user) throw new Error("The API returned an incomplete session.");
      onAuthenticated(result.user);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to WealthOS.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="modal-heading">
        <div><div className="panel-kicker">YOUR PRIVATE WORKSPACE</div><h2 id="auth-title">{mode === "login" ? "Welcome back." : "Create your account."}</h2><p>Your financial records stay attached to your account.</p></div>
        <button className="icon-button" onClick={onClose} aria-label="Close sign-in"><X size={18} /></button>
      </div>
      <form onSubmit={submit}>
        <label className="form-label">Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label className="form-label">Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 10 : 1} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 10 characters" : "Your password"} /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions auth-actions">
          <button type="button" className="text-link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Already have an account? Sign in"}</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Please wait…" : <><LockKeyhole size={14} /> {mode === "login" ? "Sign in" : "Create account"}</>}</button>
        </div>
      </form>
      <div className="auth-disclaimer">Your session is stored in a Secure, HttpOnly cookie. Demo mode remains available without signing in.</div>
    </section>
  </div>;
}
