import { AppSidebar } from "@/components/layout/AppSidebar";
import { Providers } from "@/components/Providers";
import { NetworkSwitchPrompt } from "@/components/feedback/NetworkSwitchPrompt";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-[#F8FAFA]">
        <AppSidebar />
        <main className="flex-1 ml-60">
          <div className="max-w-[1280px] mx-auto px-8">
            <NetworkSwitchPrompt />
            {children}
          </div>
        </main>
      </div>
    </Providers>
  );
}
