"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiweMessage } from "siwe";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

interface WalletConnectButtonProps {
  link?: boolean;
}

export function WalletConnectButton({ link }: WalletConnectButtonProps) {
  const [status, setStatus] = useState<"idle" | "connecting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function connect() {
    setStatus("connecting");
    setError(null);

    try {
      if (!window.ethereum) {
        throw new Error("No wallet found. Install MetaMask or another Ethereum wallet extension.");
      }

      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No wallet address returned.");

      const chainIdHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(chainIdHex, 16);

      const nonceRes = await fetch("/api/auth/siwe/nonce");
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to OwnReach with your wallet. This request will not trigger a blockchain transaction or cost any gas fees.",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });
      const message = siweMessage.prepareMessage();

      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      const verifyRes = await fetch("/api/auth/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, link }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.error ?? "Wallet sign-in failed");

      router.push(data.redirect ?? "/home");
      router.refresh();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Wallet sign-in failed");
      return;
    }
    setStatus("idle");
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="lg" className="w-full gap-3" onClick={connect} disabled={status === "connecting"}>
        <Wallet className="size-[18px]" />
        {status === "connecting" ? "Confirm in your wallet…" : "Connect Wallet"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
