"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { SiweMessage } from "siwe";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import {
  IconWallet,
  IconShieldCheckFilled,
  IconLoader2,
} from "@tabler/icons-react";

type SignInStep = "connect" | "sign";

export function SignInCard() {
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [step, setStep] = useState<SignInStep>("connect");
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") ?? "/dashboard";
  const redirect =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/dashboard";

  // Advance step when wallet connects, reset when it disconnects
  useEffect(() => {
    setStep(isConnected && address ? "sign" : "connect");
  }, [isConnected, address]);

  const handleSignIn = async () => {
    if (!address || !walletClient) return;
    setIsSigning(true);
    setError(null);

    try {
      // 1. Fetch nonce
      const nonceRes = await fetch("/api/auth/nonce");
      if (!nonceRes.ok) throw new Error("Failed to get nonce.");
      const { nonce } = await nonceRes.json();

      // 2. Build SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement:
          "Sign in to Chariot. This request will not trigger a blockchain transaction or cost any gas fees.",
        uri: window.location.origin,
        version: "1",
        chainId: chain?.id ?? 5042002,
        nonce,
      });

      const messageString = message.prepareMessage();

      // 3. Prompt wallet signature
      const signature = await walletClient.signMessage({
        message: messageString,
      });

      // 4. Verify on server
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageString, signature }),
      });

      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => null);
        throw new Error(body?.error ?? "Signature verification failed.");
      }

      router.push(redirect);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.toLowerCase().includes("user rejected") || message.toLowerCase().includes("denied")) {
        setError("Sign-in cancelled. Try again to access your account.");
      } else {
        setError(message);
      }
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white border border-[rgba(3,181,170,0.15)]">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-[rgba(3,121,113,0.08)] flex flex-col items-center">
          <Image
            src="/chariot-dark.svg"
            alt="Chariot"
            width={110}
            height={25}
            className="mb-6"
          />
          <h1 className="text-xl font-bold text-[#023436] font-[family-name:var(--font-heading)] tracking-tight">
            Sign in to Chariot
          </h1>
          <p className="text-sm text-[#6B8A8D] mt-1.5 text-center font-[family-name:var(--font-body)]">
            Connect your wallet and verify ownership to continue.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 px-8 py-4 border-b border-[rgba(3,121,113,0.08)]">
          <StepDot
            active={step === "connect"}
            done={step === "sign"}
            label="Connect"
          />
          <div className="w-12 h-px bg-[rgba(3,121,113,0.15)]" />
          <StepDot active={step === "sign"} done={false} label="Verify" />
        </div>

        {/* Step content */}
        <div className="px-8 py-7 space-y-5">
          {step === "connect" && (
            <div className="flex flex-col items-center gap-5">
              <div className="w-12 h-12 bg-[#F8FAFA] border border-[rgba(3,121,113,0.1)] flex items-center justify-center">
                <IconWallet size={22} className="text-[#037971]" />
              </div>
              <p className="text-sm text-[#3D5C5F] text-center font-[family-name:var(--font-body)]">
                Connect the wallet you use with Chariot to get started.
              </p>
              {/* Wrap ConnectButton to fill width */}
              <div className="w-full">
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button
                      onClick={openConnectModal}
                      className="w-full h-11 bg-[#03B5AA] hover:bg-[#037971] text-white text-sm font-semibold transition-colors"
                    >
                      Connect Wallet
                    </button>
                  )}
                </ConnectButton.Custom>
              </div>
            </div>
          )}

          {step === "sign" && (
            <div className="flex flex-col items-center gap-5">
              <div className="w-12 h-12 bg-[#F8FAFA] border border-[rgba(3,121,113,0.1)] flex items-center justify-center">
                <IconShieldCheckFilled size={22} className="text-[#037971]" />
              </div>
              <div className="text-center">
                <p className="text-xs text-[#6B8A8D] mb-1 font-[family-name:var(--font-body)]">
                  Connected as
                </p>
                <p className="font-mono text-sm font-semibold text-[#023436] tracking-wide">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </div>
              <p className="text-sm text-[#3D5C5F] text-center font-[family-name:var(--font-body)]">
                Sign a message in your wallet to verify ownership. No gas fees.
              </p>

              {error && (
                <div className="w-full bg-[rgba(217,119,6,0.06)] border border-[rgba(217,119,6,0.2)] px-3 py-2.5">
                  <p className="text-xs text-[#D97706] font-[family-name:var(--font-body)]">
                    {error}
                  </p>
                </div>
              )}

              <button
                onClick={handleSignIn}
                disabled={isSigning || !walletClient}
                className="w-full h-11 bg-[#03B5AA] hover:bg-[#037971] text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSigning ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    <span>Awaiting signature...</span>
                  </>
                ) : (
                  "Sign In to Chariot"
                )}
              </button>

              <button
                onClick={() => { setStep("connect"); setError(null); }}
                className="text-xs text-[#6B8A8D] hover:text-[#037971] transition-colors font-[family-name:var(--font-body)]"
              >
                Use a different wallet
              </button>
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-8 pb-7 text-center border-t border-[rgba(3,121,113,0.06)] pt-4">
          <p className="text-[11px] text-[#6B8A8D] leading-relaxed font-[family-name:var(--font-body)]">
            Sign-In with Ethereum verifies wallet ownership cryptographically.
            <br />
            No password. No email. No blockchain transaction.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-2 h-2 transition-colors ${
          done
            ? "bg-[#10B981]"
            : active
              ? "bg-[#03B5AA]"
              : "bg-[rgba(3,121,113,0.2)]"
        }`}
      />
      <span
        className={`text-[10px] font-medium font-[family-name:var(--font-body)] ${
          active || done ? "text-[#023436]" : "text-[#6B8A8D]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
