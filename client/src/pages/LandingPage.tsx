import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Globe2,
  Languages,
  Layers3,
  LockKeyhole,
  Palette,
  Play,
  ReceiptText,
  ShieldCheck,
  TimerReset,
  ArchiveRestore,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/marketing/PublicLayout";
import PricingSection from "@/components/marketing/PricingSection";
import tickdLogoFull from "@/assets/tickd-logo-full.svg";
import laptopImage from "@/assets/tickd-laptop-studio.webp";

const workflow = [
  {
    number: "01",
    icon: Play,
    title: "Track with context",
    text: "Start the timer. Client, project, rate, and currency stay attached.",
  },
  {
    number: "02",
    icon: BarChart3,
    title: "Review the real picture",
    text: "See the week clearly and fix the details before they become admin.",
  },
  {
    number: "03",
    icon: ReceiptText,
    title: "Finish ready to send",
    text: "Turn approved time into a clear report or a polished invoice.",
  },
];

const capabilities = [
  {
    icon: TimerReset,
    label: "Time that stays editable",
  },
  {
    icon: BarChart3,
    label: "A dashboard that adds up",
  },
  {
    icon: FileText,
    label: "Reports built for review",
  },
  {
    icon: ReceiptText,
    label: "Invoices that feel like yours",
  },
];

const workspaceSignals = [
  { icon: Layers3, label: "One workspace", detail: "Track to invoice" },
  { icon: Globe2, label: "Made to travel", detail: "Currencies and languages" },
  { icon: BarChart3, label: "Your data, clearly", detail: "Hours and value connected" },
];

const internationalFeatures = [
  { icon: Globe2, text: "Live and custom currency support" },
  { icon: Languages, text: "Invoice languages and custom labels" },
  { icon: Palette, text: "Client-specific invoice styling" },
];

const privacySignals = [
  { icon: LockKeyhole, label: "Account isolated", detail: "Every workspace request is scoped to the signed-in account." },
  { icon: ShieldCheck, label: "Encrypted storage", detail: "Production storage is encrypted at rest and browser traffic uses HTTPS." },
  { icon: ArchiveRestore, label: "Protected backups", detail: "Account snapshots are AES-256-GCM encrypted before storage." },
];

export default function LandingPage() {
  return (
    <PublicLayout>
      <section className="overflow-hidden border-b border-[#dfe5ee] bg-white">
        <div className="mx-auto grid max-w-[1536px] items-center gap-10 px-4 pb-10 pt-12 sm:px-6 sm:pb-12 sm:pt-14 lg:px-10 xl:min-h-[650px] xl:grid-cols-[minmax(420px,0.78fr)_minmax(0,1.22fr)] xl:gap-4 xl:py-14 2xl:px-12">
          <div className="relative z-10 max-w-[560px] xl:pb-8">
            <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[#096cfb]">
              <span className="h-px w-8 bg-[#096cfb]" aria-hidden="true" />
              Built for independent work
            </p>
            <h1 className="sr-only">Tickd</h1>
            <img
              src={tickdLogoFull}
              alt="Tickd"
              className="mt-7 h-auto w-[240px] sm:w-[300px]"
            />
            <p className="mt-8 max-w-[530px] text-[38px] font-semibold leading-[1.06] text-[#071127] sm:text-[52px]">
              Time. Tasks. Invoices. <span className="text-[#096cfb]">All Tickd.</span>
            </p>
            <p className="mt-6 max-w-[480px] text-base leading-7 text-[#536075] sm:text-lg sm:leading-8">
              Track the work. See where it went. Send the invoice.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 rounded-md px-6 text-base shadow-[0_10px_28px_rgba(9,108,251,0.2)]" asChild>
                <Link href="/register?plan=free">
                  Start tracking free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-md border-[#cbd3df] bg-white px-6 text-base" asChild>
                <Link href="/how-it-works">See how it works</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#5f6b7c]">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#199473]" />Free plan available</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#199473]" />No payment details</span>
            </div>
          </div>

          <div className="relative min-w-0 xl:h-[610px]" aria-label="Tickd product preview">
            <img
              src={laptopImage}
              alt="Tickd dashboard inside a silver laptop, showing time by day, client, and project with the creative music panel"
              className="mx-auto block h-auto w-full max-w-[920px] object-contain xl:absolute xl:right-0 xl:top-1/2 xl:w-[820px] xl:max-w-none xl:-translate-y-1/2 2xl:w-[980px]"
            />
          </div>
        </div>

        <div className="bg-[#096cfb] text-white">
          <div className="mx-auto grid max-w-[1536px] divide-y divide-white/20 px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10 2xl:px-12">
            {workspaceSignals.map(({ icon: Icon, label, detail }, index) => (
              <div key={label} className={`flex items-center gap-4 py-5 ${index === 0 ? "md:pl-0 md:pr-8" : index === workspaceSignals.length - 1 ? "md:pl-8 md:pr-0" : "md:px-8"}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/12 text-[#62dc80] ring-1 ring-white/20">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-white/70">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#138a3b]">One continuous workflow</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-[#071127] sm:text-5xl">Less admin. More finished work.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#667085]">Everything useful stays attached from the first click to the final invoice.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {workflow.map(({ number, icon: Icon, title, text }, index) => (
              <article key={title} className={`min-h-[250px] rounded-lg border p-6 sm:p-7 ${index === 1 ? "border-[#cfead6] bg-[#f3fbf5]" : "border-[#d9e5f5] bg-[#f5f9ff]"}`}>
                <div className="flex items-center justify-between">
                  <span className={`grid h-11 w-11 place-items-center rounded-md ${index === 1 ? "bg-[#34C759] text-white" : "bg-[#096cfb] text-white"}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold text-[#98a2b3]">{number}</span>
                </div>
                <h3 className="mt-10 text-xl font-semibold text-[#111827]">{title}</h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-[#667085]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#071127] py-20 text-white sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-24">
            <div>
              <p className="text-sm font-bold text-[#79adff]">Why Tickd?</p>
              <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
                Reliable where it matters. Refined where it shows.
              </h2>
            </div>
            <div className="border-l border-white/20 pl-6 sm:pl-10">
              <p className="text-xl italic leading-8 text-[#c8d1e0] sm:text-2xl">
                Most platforms make you choose: reliable time tracking or beautiful invoices, but never both.
              </p>
              <p className="mt-7 text-2xl font-semibold text-white sm:text-3xl">Tickd bridges that gap.</p>
            </div>
          </div>

          <div className="mt-14 grid border-y border-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ icon: Icon, label }, index) => (
              <div key={label} className={`flex min-h-32 items-center gap-4 py-7 sm:px-7 ${index > 0 ? "sm:border-l sm:border-white/15" : ""}`}>
                <Icon className={`h-6 w-6 shrink-0 ${index % 2 === 0 ? "text-[#79adff]" : "text-[#62dc80]"}`} />
                <p className="text-base font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#d7eadc] bg-[#f2fbf4] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20 lg:px-8">
          <div>
            <p className="text-sm font-bold text-[#138a3b]">Built for international work</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight text-[#071127] sm:text-5xl">
              Your client should recognize the invoice as yours.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#566377]">
              Adapt language, currency, labels, colors, and payment details for each client.
            </p>
          </div>
          <div className="border-y border-[#c8e2cf]">
            {internationalFeatures.map(({ icon: Icon, text }, index) => (
              <div key={text} className="flex items-center gap-4 border-b border-[#c8e2cf] py-6 last:border-b-0">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white shadow-sm ${index === 1 ? "text-[#138a3b]" : "text-[#096cfb]"}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <p className="text-base font-semibold text-[#17233d] sm:text-lg">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#dfe5ee] bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-14">
            <div>
              <p className="text-sm font-bold text-[#138a3b]">Private by default</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#071127]">Your work stays yours.</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#667085]">Other Tickd users cannot access your workspace.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {privacySignals.map(({ icon: Icon, label, detail }, index) => (
                <div key={label} className="border-l border-[#dfe5ee] pl-5">
                  <Icon className={`h-5 w-5 ${index === 1 ? "text-[#34C759]" : "text-[#096cfb]"}`} />
                  <p className="mt-4 text-sm font-bold text-[#17233d]">{label}</p>
                  <p className="mt-2 text-xs leading-5 text-[#667085]">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PricingSection />

      <section className="border-t border-[#dfe5ee] bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-end gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <p className="text-sm font-bold text-[#096cfb]">Ready when you are</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-[#071127] sm:text-5xl">
              Give every hour a clear place to land.
            </h2>
          </div>
          <Button size="lg" className="h-12 rounded-md px-6" asChild>
            <Link href="/register?plan=free">
              Create a free account <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
