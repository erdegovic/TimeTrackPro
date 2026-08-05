import { ReactNode } from "react";
import PublicHeader from "@/components/marketing/PublicHeader";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "hsl(var(--tickd-bg))" }}>
      <PublicHeader authenticationPage />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        {children}
      </main>

      <footer className="py-4 border-t bg-white">
        <div className="container mx-auto text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Tickd. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
