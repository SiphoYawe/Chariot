import { AppSidebar } from "@/components/layout/AppSidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#F8FAFA]">
      <AppSidebar />
      <main className="flex-1 ml-60">
        <div className="max-w-[1280px] mx-auto px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
