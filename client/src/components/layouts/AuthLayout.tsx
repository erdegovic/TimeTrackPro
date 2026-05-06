import { ReactNode } from "react";
import { Link } from "wouter";
import tickdLogo from "@/assets/tickd-logo.png";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "hsl(var(--tickd-bg))" }}>
      <header className="py-4 px-6 border-b bg-white shadow-sm">
        <div className="container mx-auto">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <img src={tickdLogo} alt="Tickd" className="h-8 w-8" />
            <span className="text-xl font-bold tickd-primary">TimeTrack Pro</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        {children}
      </main>

      <footer className="py-4 border-t bg-white">
        <div className="container mx-auto text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} TimeTrack Pro. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
