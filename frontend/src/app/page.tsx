import { Navigation } from "@/components/landing/Navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsBar } from "@/components/landing/StatsBar";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { TrustBar } from "@/components/landing/TrustBar";
import { CTABlock } from "@/components/landing/CTABlock";
import { FooterSection } from "@/components/landing/FooterSection";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <HowItWorksSection />
      <ComparisonSection />
      <TrustBar />
      <CTABlock />
      <FooterSection />
    </div>
  );
}
