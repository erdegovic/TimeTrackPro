import { BookOpen, Clock3, FileText, ReceiptText, Settings2, Users } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/marketing/PublicLayout";

const categories = [
  { icon: Clock3, title: "Time tracking", text: "Start, stop, resume, edit, move, and organize time entries.", href: "/how-it-works" },
  { icon: Users, title: "Clients and projects", text: "Set rates, colors, currencies, and client billing preferences.", href: "/how-it-works" },
  { icon: FileText, title: "Reports", text: "Filter, group, adjust, edit, and export reviewed work.", href: "/faq" },
  { icon: ReceiptText, title: "Invoices", text: "Customize invoice content, templates, dates, and payment details.", href: "/faq" },
  { icon: Settings2, title: "Account and settings", text: "Manage business details, security, language, and profile preferences.", href: "/faq" },
  { icon: BookOpen, title: "Getting started", text: "Follow the complete Tickd workflow from first client to invoice.", href: "/how-it-works" },
];

export default function HelpPage() {
  return <PublicLayout><section className="bg-[#f7f9fc] py-20 sm:py-24"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold text-blue-600">Help center</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Find the right next step.</h1><p className="mt-5 text-lg leading-8 text-gray-600">Browse the main Tickd workflows or contact us when something needs a closer look.</p></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map(({ icon: Icon, title, text, href }) => <Link key={title} href={href} className="group rounded-lg border border-gray-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-sm"><Icon className="h-6 w-6 text-blue-600" /><h2 className="mt-8 text-lg font-bold group-hover:text-blue-700">{title}</h2><p className="mt-2 text-sm leading-6 text-gray-600">{text}</p></Link>)}</div><div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-lg bg-[#071127] p-7 text-white sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">Still need help?</h2><p className="mt-1 text-sm text-gray-300">Send the details and Tickd support will take a look.</p></div><Link href="/contact" className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Contact support</Link></div></div></section></PublicLayout>;
}
