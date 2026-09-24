import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { WalletConnectButton } from "@/components/auth/wallet-connect-button";

export const metadata = { title: "Log in / OwnReach", robots: { index: false } };

const ERROR_MESSAGES: Record<string, string> = {
  missing_state: "Your sign-in session expired. Please try again.",
  invalid_state: "Your sign-in session expired. Please try again.",
  state_mismatch: "Something looked off with that sign-in attempt. Please try again.",
  google_cancelled: "Google sign-in was cancelled.",
  google_auth_failed: "Google sign-in failed. Please try again.",
  already_linked: "That account is already linked to a different OwnReach profile.",
  not_authenticated: "Sign in first, then connect another account from Settings.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Something went wrong. Please try again.") : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            OwnReach
          </Link>
          <p className="text-muted-foreground mt-2 text-sm text-balance">
            Own your reach. Keep your community.
          </p>
        </div>

        {errorMessage && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-lg border px-4 py-3 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <GoogleButton />
          <TelegramLoginButton />
          <WalletConnectButton />
        </div>

        <p className="text-muted-foreground mt-8 text-center text-xs text-balance">
          We never ask for your password, seed phrase, or private key. Wallet sign-in only requests a
          message signature.
        </p>
      </div>
    </div>
  );
}
