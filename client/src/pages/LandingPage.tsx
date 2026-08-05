import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Play,
  ReceiptText,
  TimerReset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/marketing/PublicLayout";
import PricingSection from "@/components/marketing/PricingSection";
import heroImage from "@/assets/tickd-dashboard-hero.webp";

const workflow = [
  {
    icon: Play,
    title: "Track the work",
    text: "Start in one click or add time manually. Every block keeps its client and project context.",
  },
  {
    icon: BarChart3,
    title: "See the full picture",
    text: "Understand days, projects, clients, rates, and currencies without rebuilding a spreadsheet.",
  },
  {
    icon: ReceiptText,
    title: "Send it beautifully",
    text: "Turn reviewed time into a polished report or a client-ready invoice while the details are fresh.",
  },
];

const capabilities = [
  { icon: TimerReset, label: "Flexible time entries", detail: "Timers, manual entries, editable blocks" },
  { icon: BarChart3, label: "A dashboard that adds up", detail: "Clients, projects, days, and currencies" },
  { icon: FileText, label: "Reports built for review", detail: "Adjust, group, edit, export, and save" },
  { icon: ReceiptText, label: "Invoices that feel like yours", detail: "Reusable client templates and languages" },
];

export default function LandingPage() {
  return (
    <PublicLayout>
      <section className="relative min-h-[760px] overflow-hidden border-b border-[#dfe5ee] bg-white lg:min-h-[calc(100vh-64px)] lg:max-h-[940px]">
        <img
          src={heroImage}
          alt="Tickd dashboard showing 32 hours and 30 minutes of work across clients and projects"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-white/90 sm:bg-white/72 lg:bg-transparent" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[760px] max-w-7xl items-center px-4 py-20 sm:px-6 lg:min-h-[calc(100vh-64px)] lg:max-h-[940px] lg:px-8">
          <div className="max-w-[570px] pb-12 lg:pb-20">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#096cfb]">
              <span className="h-px w-8 bg-[#096cfb]" aria-hidden="true" />
              Time tracking for independent work
            </p>
            <h1 className="mt-7 text-6xl font-bold text-[#071127] sm:text-7xl lg:text-[88px] lg:leading-[0.95]">Tickd</h1>
            <p className="mt-7 max-w-lg text-3xl font-semibold leading-[1.08] text-[#111b31] sm:text-4xl">
              Time. Tasks. Invoices. <span className="text-[#096cfb]">All Tickd.</span>
            </p>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#4d596d] sm:text-lg">
              One focused workspace to capture the hours, understand the work, and turn it into something ready to send.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-6 text-base" asChild>
                <Link href="/register?plan=free">Start tracking free <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 border-[#cbd3df] bg-white px-6 text-base" asChild>
                <Link href="/how-it-works">See how it works</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-[#5e697a]">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" />Free plan available</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" />No payment details</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 border-t border-[#dfe5ee] bg-white/96">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-5 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold text-[#17233d]">A single source of truth from first click to final invoice.</p>
            <Link href="/pricing" className="hidden items-center text-sm font-semibold text-[#096cfb] hover:text-[#075bd3] sm:flex">
              Plans from $0 <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <p className="text-sm font-semibold text-[#096cfb]">One continuous workflow</p>
              <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight text-[#071127] sm:text-4xl">Less admin between the work and getting paid.</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[#5a6577]">Tickd keeps the context attached, so your week does not have to be reconstructed at the end of the month.</p>
            </div>
            <div className="border-t border-[#dfe5ee]">
              {workflow.map((step, index) => (
                <article key={step.title} className="grid gap-5 border-b border-[#dfe5ee] py-7 sm:grid-cols-[64px_1fr_1.15fr] sm:items-start">
                  <div className="flex items-center gap-3 text-sm font-semibold text-[#8a94a5]">
                    <span>0{index + 1}</span>
                    <step.icon className="h-5 w-5 text-[#096cfb]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#111827]">{step.title}</h3>
                  <p className="text-sm leading-6 text-[#667085]">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#071127] py-20 text-white sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-24">
            <div>
              <p className="text-sm font-semibold text-[#78aeff]">Why Tickd?</p>
              <h2 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">Reliable where it matters. Refined where it shows.</h2>
            </div>
            <div className="border-l border-white/20 pl-6 sm:pl-10">
              <p className="text-xl italic leading-8 text-[#c8d1e0] sm:text-2xl">
                Most platforms make you choose: reliable time tracking or beautiful invoices — but never both.
              </p>
              <p className="mt-7 text-2xl font-bold text-white sm:text-3xl">Tickd bridges that gap.</p>
            </div>
          </div>
          <div className="mt-16 grid border-y border-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ icon: Icon, label, detail }, index) => (
              <div key={label} className={`min-h-52 py-7 sm:px-7 ${index > 0 ? "sm:border-l sm:border-white/15" : ""}`}>
                <Icon className="h-6 w-6 text-[#78aeff]" />
                <p className="mt-12 text-base font-semibold">{label}</p>
                <p className="mt-2 text-sm leading-6 text-[#99a7bb]">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="border-t border-[#e2e7ef] bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <p className="text-sm font-semibold text-[#096cfb]">Ready when you are</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight text-[#071127] sm:text-4xl">Give every hour a clear place to land.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#5e697a]">Set up a client, choose a project, and start the timer. Tickd keeps the structure around your work.</p>
          </div>
          <Button size="lg" className="h-12 px-6" asChild>
            <Link href="/register?plan=free">Create a free account <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
