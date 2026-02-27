interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between py-8">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-[#023436]">
        {title}
      </h1>
    </header>
  );
}
