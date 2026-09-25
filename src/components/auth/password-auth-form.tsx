"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginWithPassword, signupWithPassword } from "@/lib/actions/auth";

type Mode = "login" | "signup";
type Status = "idle" | "submitting" | "error";

export function PasswordAuthForm() {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-3"
        onClick={() => setExpanded(true)}
      >
        <Mail className="size-[18px]" />
        Continue with email
      </Button>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    try {
      const action = mode === "login" ? loginWithPassword : signupWithPassword;
      const result = await action({ email, password });
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
      }
      // On success the action itself redirects, so there's nothing else to do here.
    } catch (e) {
      // A successful login/signup rejects this promise with Next's internal
      // redirect signal (see server-action-reducer.js) — let it propagate so
      // RedirectBoundary handles the navigation instead of showing it as an error.
      unstable_rethrow(e);
      setStatus("error");
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "submitting"}
        autoFocus
      />
      <Input
        type="password"
        required
        minLength={8}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={status === "submitting"}
      />
      {mode === "login" && (
        <Link href="/login/forgot-password" className="text-muted-foreground self-end text-xs hover:underline">
          Forgot password?
        </Link>
      )}
      <Button type="submit" variant="outline" size="lg" className="w-full gap-3" disabled={status === "submitting"}>
        {status === "submitting" ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </Button>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
        }}
        className="text-muted-foreground mt-1 text-center text-xs hover:underline"
      >
        {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
      </button>
    </form>
  );
}
