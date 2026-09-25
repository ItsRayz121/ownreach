import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { verifySession } from "@/lib/auth/session";
import { getLinkedProviders } from "@/lib/auth/accounts";
import { GoogleButton } from "@/components/auth/google-button";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { WalletConnectButton } from "@/components/auth/wallet-connect-button";
import { EmailLoginForm } from "@/components/auth/email-login-form";

export const metadata = { title: "Connected accounts / OwnReach" };

const PROVIDER_LABELS = {
  google: "Google",
  telegram: "Telegram",
  wallet: "Wallet",
  email: "Email",
  password: "Password",
} as const;

export default async function ConnectedAccountsPage() {
  const session = await verifySession();
  if (!session) redirect("/login?next=/settings/connected-accounts");

  const linked = await getLinkedProviders(session.userId);
  const linkedProviders = new Set(linked.map((a) => a.provider));

  return (
    <div className="px-4 py-6">
      <p className="text-muted-foreground mb-6 text-sm">
        Link multiple sign-in methods to the same OwnReach account — your identity, followers, and posts stay put
        even if you lose access to one provider.
      </p>

      {linked.length > 0 && (
        <ul className="mb-6 flex flex-col gap-2">
          {linked.map((account) => (
            <li key={account.id} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
              <span>{PROVIDER_LABELS[account.provider]}</span>
              <span className="text-primary flex items-center gap-1.5">
                <Check className="size-4" />
                Connected
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        {!linkedProviders.has("google") && <GoogleButton link label="Connect Google" />}
        {!linkedProviders.has("telegram") && <TelegramLoginButton link />}
        {!linkedProviders.has("wallet") && <WalletConnectButton link />}
        {!linkedProviders.has("email") && <EmailLoginForm link />}
      </div>
    </div>
  );
}
