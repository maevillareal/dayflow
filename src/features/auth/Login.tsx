import { useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, Lock, LogIn, Mail, User } from "lucide-react";
import { supabase } from "../../data/supabase";
import { Cat, Dog } from "../../companions/Companions";

type Mode = "login" | "signup" | "forgot";
const redirect = () => window.location.origin + window.location.pathname;

function Shell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-pets">
          <Dog size={84} />
          <Cat size={84} />
        </div>
        <div className="brand-row">
          <div className="logo-mark" aria-hidden />
          <b>DAYFLOW</b>
        </div>
        <h1>{title}</h1>
        <p className="sub center">{sub}</p>
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect(), data: { display_name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setMsg({ kind: "ok", text: "Check your email to confirm your account, then log in here." });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect() });
        if (error) throw error;
        setMsg({ kind: "ok", text: "If that email has an account, a reset link is on its way." });
      }
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, [string, string]> = {
    login: ["Welcome back", "Log in to pick up where you left off."],
    signup: ["Create your account", "Your data stays private to you."],
    forgot: ["Reset your password", "We'll email you a link to set a new one."],
  };

  return (
    <Shell title={titles[mode][0]} sub={titles[mode][1]}>
      <form onSubmit={submit} noValidate={false}>
        {mode === "signup" && (
          <>
            <label className="lb" htmlFor="nm">Your name</label>
            <div className="inp">
              <User size={16} />
              <input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should Lei and Tobi call you?" autoComplete="nickname" />
            </div>
          </>
        )}
        <label className="lb" htmlFor="em">Email</label>
        <div className="inp">
          <Mail size={16} />
          <input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </div>
        {mode !== "forgot" && (
          <>
            <label className="lb" htmlFor="pw">Password</label>
            <div className="inp">
              <Lock size={16} />
              <input
                id="pw"
                type={show ? "text" : "password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </>
        )}
        {mode === "login" && (
          <div className="login-row">
            <span />
            <button type="button" className="link" onClick={() => setMode("forgot")}>Forgot password?</button>
          </div>
        )}
        {msg && <p className={msg.kind === "error" ? "form-error" : "form-ok"}>{msg.text}</p>}
        <button className="btn block" type="submit" disabled={busy} style={{ marginTop: mode === "login" ? 0 : 18 }}>
          <LogIn size={16} />
          {busy ? "One moment…" : mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
      </form>
      <div className="login-foot">
        {mode === "login" ? (
          <>New to DAYFLOW? <button className="link" onClick={() => setMode("signup")}>Create account</button></>
        ) : (
          <>Have an account? <button className="link" onClick={() => setMode("login")}>Log in</button></>
        )}
      </div>
    </Shell>
  );
}

/** Shown after following a password-reset email link. */
export function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) setMsg(error.message);
    else onDone();
  }
  return (
    <Shell title="Set a new password" sub="Choose a password with at least 8 characters.">
      <form onSubmit={submit}>
        <label className="lb" htmlFor="np">New password</label>
        <div className="inp">
          <Lock size={16} />
          <input id="np" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        {msg && <p className="form-error">{msg}</p>}
        <button className="btn block" type="submit" style={{ marginTop: 18 }}>Save password</button>
      </form>
    </Shell>
  );
}
