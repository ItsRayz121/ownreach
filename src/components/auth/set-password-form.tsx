"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPassword } from "@/lib/actions/auth";

type Status = "idle" | "submitting" | "error";

export function SetPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setStatus("error");
      setError("Those passwords don't match.");
      return;
    }

    setStatus("submitting");
    const result = await setPassword({ email, password });
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border px-4 py-3">
      <p className="text-sm font-medium">Set a password</p>
      <p className="text-muted-foreground mb-1 text-sm">
        Add a password so you can sign in with an email and password too, not just the methods above.
      </p>
      <Input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "submitting"}
      />
      <Input
        type="password"
        required
        minLength={8}
        placeholder="Password"
        value={password}
        onChange={(e) => setPasswordValue(e.target.value)}
        disabled={status === "submitting"}
      />
      <Input
        type="password"
        required
        minLength={8}
        placeholder="Confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={status === "submitting"}
      />
      <Button type="submit" variant="outline" size="lg" className="w-full gap-3" disabled={status === "submitting"}>
        {status === "submitting" ? "Saving…" : "Set password"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
