import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Radio, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifySession } from "@/lib/auth/session";

export default async function LandingPage() {
  const session = await verifySession();
  if (session) redirect("/home");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">OwnReach</span>
        <Button render={<Link href="/login" />} nativeButton={false} variant="outline">
          Log in
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-6 py-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Own your reach.
          <br />
          Keep your community.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-xl text-balance">
          A creator-first social network built to help people build, communicate with, and retain their communities
          — without depending entirely on one platform.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button render={<Link href="/login" />} nativeButton={false} size="lg">
            Join the network
          </Button>
          <Button render={<Link href="/explore" />} nativeButton={false} size="lg" variant="outline">
            Explore creators
          </Button>
        </div>

        <div className="mt-20 grid w-full grid-cols-2 gap-6 text-left sm:grid-cols-4">
          <Feature icon={Users} label="Profiles & followers" />
          <Feature icon={Radio} label="Channels" />
          <Feature icon={MessageSquare} label="Direct messages" />
          <Feature icon={ShieldCheck} label="You own your data" />
        </div>
      </main>

      <footer className="text-muted-foreground border-t px-6 py-6 text-center text-xs">
        We never ask for your password, seed phrase, or private key.
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="bg-accent flex size-9 items-center justify-center rounded-lg">
        <Icon className="text-accent-foreground size-4" />
      </div>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
