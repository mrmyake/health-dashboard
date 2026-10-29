"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const denied = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("denied");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setState("error"); setMsg(error.message); } else setState("sent");
  }

  return (
    <div className="card" style={{ maxWidth: 380, margin: "48px auto" }}>
      <h1>Inloggen</h1>
      <p className="sub">Je krijgt een inloglink per mail.</p>
      {denied && <div className="notice">Dit account heeft geen toegang.</div>}
      {state === "sent" ? (
        <p>Check je inbox.</p>
      ) : (
        <form className="stack" onSubmit={submit}>
          <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <button disabled={state === "sending"}>Stuur link</button>
          {state === "error" && <p className="badc">{msg}</p>}
        </form>
      )}
    </div>
  );
}
