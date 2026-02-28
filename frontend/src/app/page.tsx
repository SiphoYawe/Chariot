import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { StatsBar } from "@/components/landing/StatsBar";
import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Simple header with logo */}
      <header className="flex items-center justify-between max-w-[1200px] mx-auto px-8 py-6">
        <Image src="/chariot-dark.svg" alt="Chariot" width={140} height={32} priority />
        <Link href="/dashboard" className="text-sm font-medium text-[#037971] hover:text-[#03B5AA] transition-colors">
          Launch App
        </Link>
      </header>

      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <HowItWorksSection />

      {/* Footer */}
      <footer className="bg-[#023436] py-12 mt-20">
        <div className="max-w-[1200px] mx-auto px-8 text-center">
          <p className="text-white/40 text-sm">Chariot Protocol - Built on Arc</p>
        </div>
      </footer>
    </div>
  );
}
