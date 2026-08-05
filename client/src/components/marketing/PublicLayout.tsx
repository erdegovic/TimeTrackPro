import { ReactNode, useState } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import tickdLogoFull from "@/assets/tickd-logo-full.svg";

const navigation = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/help", label: "Help" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white text-[#101828]">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center" aria-label="Tickd home">
            <img src={tickdLogoFull} alt="Tickd" className="h-9 w-auto" />
          </Link>
          <nav className="ml-12 hidden items-center gap-8 md:flex" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <Link href="/contact" className="text-sm font-medium text-gray-600 hover:text-gray-950">Contact</Link>
            {user ? (
              <Button asChild><Link href="/tracker">Open Tickd</Link></Button>
            ) : (
              <>
                <Button variant="ghost" asChild><Link href="/login">Log in</Link></Button>
                <Button asChild><Link href="/pricing">Get started</Link></Button>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Close menu" : "Open menu"}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        {menuOpen && (
          <div className="border-t border-gray-200 bg-white px-4 py-4 md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1" aria-label="Mobile navigation">
              {navigation.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {item.label}
                </Link>
              ))}
              <Link href="/contact" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Contact</Link>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-200 pt-4">
                {user ? (
                  <Button className="col-span-2" asChild><Link href="/tracker">Open Tickd</Link></Button>
                ) : (
                  <><Button variant="outline" asChild><Link href="/login">Log in</Link></Button><Button asChild><Link href="/pricing">Get started</Link></Button></>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-gray-200 bg-[#071127] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
          <div>
            <img src={tickdLogoFull} alt="Tickd" className="h-9 w-auto rounded bg-white px-2 py-1" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-gray-300">Calm time tracking, clear reports, and invoices your clients understand.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Product</p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-gray-300"><Link href="/how-it-works">How it works</Link><Link href="/pricing">Pricing</Link><Link href="/faq">FAQ</Link></div>
          </div>
          <div>
            <p className="text-sm font-semibold">Support</p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-gray-300"><Link href="/help">Help center</Link><Link href="/contact">Contact</Link><Link href="/login">Log in</Link></div>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-gray-400">&copy; {new Date().getFullYear()} Tickd. All rights reserved.</div>
      </footer>
    </div>
  );
}
