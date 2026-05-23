import { AuthArtPanel } from "./_components/auth-art-panel";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="bg-background grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <AuthArtPanel />
      <div className="flex items-center justify-center px-6 py-12 sm:px-10 lg:py-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
