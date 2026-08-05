import { Link } from "wouter";
import { ArrowRight, BarChart3, CheckCircle2, FileText, Play, ReceiptText, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/marketing/PublicLayout";
import PricingSection from "@/components/marketing/PricingSection";
import heroImage from "@/assets/tickd-landing-hero.webp";

const workflow = [
  { icon: Play, title: "Track the work", text: "Start a timer in one click or add time manually. Client and project context stays attached." },
  { icon: BarChart3, title: "Understand the week", text: "See where your time went across days, projects, clients, and currencies." },
  { icon: ReceiptText, title: "Bill with confidence", text: "Turn reviewed time into a clear report or a client-ready invoice." },
];

export default function LandingPage() {
  return (
    <PublicLayout>
      <section className="relative min-h-[calc(100vh-64px)] max-h-[880px] overflow-hidden bg-white">
        <img src={heroImage} alt="A Tickd workspace showing time tracking, client activity, and invoicing" className="absolute inset-0 h-full w-full object-cover object-[62%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-white/75 md:hidden" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[calc(100vh-64px)] max-h-[880px] max-w-7xl items-center px-4 pb-28 pt-16 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
              <CheckCircle2 className="h-4 w-4" /> Built for focused independent work
            </div>
            <h1 className="text-6xl font-bold text-[#071127] sm:text-7xl">Tickd</h1>
            <p className="mt-5 text-2xl font-semibold leading-tight text-[#17233d] sm:text-3xl">Time tracking that stays out of your way.</p>
            <p className="mt-5 max-w-lg text-base leading-7 text-gray-700 sm:text-lg">Track work, understand where your week went, and turn approved hours into invoices without rebuilding the same information twice.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-base" asChild><Link href="/register?plan=free">Start tracking free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button size="lg" variant="outline" className="h-12 border-gray-300 bg-white/90 px-6 text-base" asChild><Link href="/how-it-works">See how it works</Link></Button>
            </div>
            <p className="mt-4 text-xs font-medium text-gray-600">Free plan available. No payment details required.</p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 text-sm sm:px-6 lg:px-8">
            <p className="font-semibold text-gray-900">One calm workflow from timer to invoice.</p>
            <Link href="/pricing" className="hidden items-center font-semibold text-blue-600 hover:text-blue-700 sm:flex">Plans from $0 <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-200 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl"><p className="text-sm font-semibold text-blue-600">A clearer workday</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">From “what did I do?” to ready to send.</h2></div>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {workflow.map((step, index) => <div key={step.title} className="border-t border-gray-200 pt-6"><div className="flex items-center justify-between"><step.icon className="h-6 w-6 text-blue-600" /><span className="text-sm font-semibold text-gray-400">0{index + 1}</span></div><h3 className="mt-8 text-xl font-bold">{step.title}</h3><p className="mt-3 text-sm leading-6 text-gray-600">{step.text}</p></div>)}
          </div>
        </div>
      </section>

      <section className="bg-[#071127] py-20 text-white sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div><p className="text-sm font-semibold text-blue-300">Built around the real work</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Details when you need them. Quiet when you do not.</h2><p className="mt-5 max-w-xl text-base leading-7 text-gray-300">Tickd keeps time blocks editable, currencies client-aware, and invoice settings reusable. Your dashboard remains a working surface, not a wall of widgets.</p></div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15">
            {[{ icon: TimerReset, label: "Flexible time entries" }, { icon: FileText, label: "Detailed reports" }, { icon: ReceiptText, label: "Custom invoices" }, { icon: BarChart3, label: "Interactive dashboard" }].map(({ icon: Icon, label }) => <div key={label} className="min-h-36 bg-[#0b1830] p-6"><Icon className="h-6 w-6 text-blue-300" /><p className="mt-10 text-sm font-semibold">{label}</p></div>)}
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Your next hour deserves a clear place to land.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">Set up a client, choose a project, and start the timer. Tickd handles the structure around it.</p>
          <Button size="lg" className="mt-8" asChild><Link href="/register?plan=free">Create a free account</Link></Button>
        </div>
      </section>
    </PublicLayout>
  );
}
