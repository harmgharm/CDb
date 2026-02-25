/**
 * Auth layout — centered card layout for login/signup pages
 */

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
