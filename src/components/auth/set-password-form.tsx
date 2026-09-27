"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPassword } from "@/lib/actions/auth";

type Status = "idle" | "submitting" | "error";

export function SetPasswordForm() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  if (!expanded) {
    return (
      <Button type="button" variant="outline" size="lg" className="w-full gap-3" onClick={() => setExpanded(true)}>
        <Mail className="size-[18px]" />
        Connect email
      </Button>
    );
  }

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
        {status === "submitting" ? "Connecting…" : "Connect email"}
      </Button>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
    </form>
  );
}
