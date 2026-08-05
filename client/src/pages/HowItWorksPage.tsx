import { BarChart3, CircleDollarSign, Clock3, FileCheck2, FolderKanban, ReceiptText } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/marketing/PublicLayout";

const steps = [
  { icon: FolderKanban, title: "Set up the work", text: "Create a client and project, set the rate and currency, and give each project a color you can spot quickly." },
  { icon: Clock3, title: "Track naturally", text: "Run the timer, pause and resume work in blocks, or enter time manually. Every block stays editable." },
  { icon: BarChart3, title: "Review the period", text: "Choose a date range and inspect hours, activity, clients, projects, and earned value in one dashboard." },
  { icon: FileCheck2, title: "Refine the report", text: "Group by week, adjust or round time, edit descriptions and rates, then export a clear work record." },
  { icon: ReceiptText, title: "Generate the invoice", text: "Reuse the client’s language, currency, colors, labels, payment details, and saved invoice preferences." },
  { icon: CircleDollarSign, title: "Keep billing consistent", text: "Save invoice records, follow due dates, and maintain a reliable history of what has been billed." },
];

export default function HowItWorksPage() {
  return <PublicLayout>
    <section className="border-b border-gray-200 bg-[#f7f9fc] py-20 sm:py-24"><div className="mx-auto max-w-4xl px-4 text-center sm:px-6"><p className="text-sm font-semibold text-blue-600">How Tickd works</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">One source of truth for your working time.</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">Capture the work once, then use it everywhere from your weekly review to the final invoice.</p></div></section>
    <section className="py-20 sm:py-24"><div className="mx-auto grid max-w-6xl gap-x-12 gap-y-14 px-4 sm:px-6 md:grid-cols-2 lg:px-8">{steps.map((step, index) => <article key={step.title} className="grid grid-cols-[48px_1fr] gap-4 border-t border-gray-200 pt-6"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700"><step.icon className="h-5 w-5" /></div><div><span className="text-xs font-semibold text-gray-400">STEP {index + 1}</span><h2 className="mt-2 text-xl font-bold">{step.title}</h2><p className="mt-3 text-sm leading-6 text-gray-600">{step.text}</p></div></article>)}</div></section>
    <section className="border-t border-gray-200 bg-[#071127] px-4 py-16 text-center text-white"><h2 className="text-3xl font-bold">Ready to make time visible?</h2><Button size="lg" className="mt-7" asChild><Link href="/register?plan=free">Start free</Link></Button></section>
  </PublicLayout>;
}
