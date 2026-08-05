import { ReactNode } from "react";
import { Link } from "wouter";
import tickdLogoFull from "@/assets/tickd-logo-full.svg";
import PublicHeader from "./PublicHeader";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#101828]">
      <PublicHeader />

      <main>{children}</main>

      <footer className="border-t border-[#dfe5ee] bg-[#f8fafc] text-[#17233d]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <img src={tickdLogoFull} alt="Tickd" className="h-9 w-auto" />
            <p className="mt-5 max-w-sm text-sm leading-6 text-[#667085]">Calm time tracking, clear reports, and invoices your clients understand.</p>
          </div>
          <div>
            <p className="text-sm font-bold">Product</p>
            <div className="mt-4 flex flex-col gap-3 text-sm font-medium text-[#667085]"><Link className="hover:text-[#071127]" href="/how-it-works">How it works</Link><Link className="hover:text-[#071127]" href="/pricing">Pricing</Link><Link className="hover:text-[#071127]" href="/faq">FAQ</Link></div>
          </div>
          <div>
            <p className="text-sm font-bold">Support</p>
            <div className="mt-4 flex flex-col gap-3 text-sm font-medium text-[#667085]"><Link className="hover:text-[#071127]" href="/help">Help center</Link><Link className="hover:text-[#071127]" href="/contact">Contact</Link><Link className="hover:text-[#071127]" href="/login">Log in</Link></div>
          </div>
          <div>
            <p className="text-sm font-bold">Legal</p>
            <div className="mt-4 flex flex-col gap-3 text-sm font-medium text-[#667085]"><Link className="hover:text-[#071127]" href="/terms">Terms of Service</Link><Link className="hover:text-[#071127]" href="/privacy">Privacy Policy</Link></div>
          </div>
        </div>
        <div className="border-t border-[#dfe5ee] px-4 py-5 text-center text-xs text-[#8a94a5]">&copy; {new Date().getFullYear()} Tickd. All rights reserved.</div>
      </footer>
    </div>
  );
}
