import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="py-4 px-6 border-b bg-white shadow-sm">
        <div className="container mx-auto">
          <h1 className="text-xl font-bold text-primary">TimeTrack Pro</h1>
        </div>
      </header>
      
      <main className="flex-1 py-8">
        <div className="container mx-auto">
          {children}
        </div>
      </main>
      
      <footer className="py-4 border-t bg-white">
        <div className="container mx-auto text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} TimeTrack Pro. All rights reserved.
        </div>
      </footer>
    </div>
  );
}