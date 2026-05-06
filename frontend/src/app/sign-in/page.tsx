import { Suspense } from "react";
import { SignInCard } from "@/components/auth/SignInCard";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#023436] flex items-center justify-center px-4 py-12">
      <Suspense>
        <SignInCard />
      </Suspense>
    </div>
  );
}
