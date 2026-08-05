import { useState } from "react";
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

export default function PublicHeader({ authenticationPage = false }: { authenticationPage?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-[#dfe5ee] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1536px] items-center px-4 sm:px-6 lg:px-10 2xl:px-12">
        <Link href="/" className="flex items-center" aria-label="Tickd home">
          <img src={tickdLogoFull} alt="Tickd" className="h-8 w-auto" />
        </Link>
        <nav className="ml-14 hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-semibold text-[#667085] transition-colors hover:text-[#071127]">
              {item.label}
            </Link>
          ))}
        </nav>
        {!authenticationPage && (
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <Link href="/contact" className="mr-2 text-sm font-semibold text-[#667085] hover:text-[#071127]">Contact</Link>
            {user ? (
              <Button className="rounded-md" asChild><Link href="/tracker">Open Tickd</Link></Button>
            ) : (
              <>
                <Button variant="ghost" className="rounded-md" asChild><Link href="/login">Log in</Link></Button>
                <Button className="rounded-md px-5" asChild><Link href="/pricing">Get started</Link></Button>
              </>
            )}
          </div>
        )}
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
            {!authenticationPage && (
              <>
                <Link href="/contact" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Contact</Link>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-200 pt-4">
                  {user ? (
                    <Button className="col-span-2" asChild><Link href="/tracker">Open Tickd</Link></Button>
                  ) : (
                    <><Button variant="outline" asChild><Link href="/login">Log in</Link></Button><Button asChild><Link href="/pricing">Get started</Link></Button></>
                  )}
                </div>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
