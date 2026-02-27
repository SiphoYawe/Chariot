import { WalletButton } from "./WalletButton";

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between py-6">
      <h1 className="text-2xl font-semibold font-[family-name:var(--font-heading)] text-[#023436]">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        {children}
        <WalletButton />
      </div>
    </header>
  );
}
