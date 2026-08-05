import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Globe2,
  Languages,
  Palette,
  Play,
  ReceiptText,
  TimerReset,
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
    text: "Start in one click or add time manually. Every block stays connected to the right client, project, rate, and currency.",
  },
  {
    number: "02",
    icon: BarChart3,
    title: "Review the real picture",
    text: "See where the week went, edit the details, and understand your work without rebuilding it in a spreadsheet.",
  },
  {
    number: "03",
    icon: ReceiptText,
    title: "Finish ready to send",
    text: "Turn approved time into a clear report or a polished invoice while every useful detail is still attached.",
  },
];

const capabilities = [
  {
    icon: TimerReset,
    label: "Time that stays editable",
    detail: "Timers, manual entries, flexible blocks, and precise corrections.",
  },
  {
    icon: BarChart3,
    label: "A dashboard that adds up",
    detail: "Days, clients, projects, rates, and converted totals in one view.",
  },
  {
    icon: FileText,
    label: "Reports built for review",
    detail: "Group, adjust, edit, export, and keep the numbers consistent.",
  },
  {
    icon: ReceiptText,
    label: "Invoices that feel like yours",
    detail: "Reusable client templates with the details your business needs.",
  },
];

const internationalFeatures = [
  { icon: Globe2, text: "Live and custom currency support" },
  { icon: Languages, text: "Invoice languages and custom labels" },
  { icon: Palette, text: "Client-specific invoice styling" },
];

export default function LandingPage() {
  return (
    <PublicLayout>
      <section className="overflow-hidden border-b border-[#dfe5ee] bg-white">
        <div className="mx-auto grid max-w-[1536px] items-center gap-10 px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-16 lg:px-10 xl:min-h-[690px] xl:grid-cols-[minmax(420px,0.78fr)_minmax(0,1.22fr)] xl:gap-4 xl:py-16 2xl:px-12">
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
            <p className="mt-6 max-w-[510px] text-base leading-7 text-[#536075] sm:text-lg sm:leading-8">
              Capture the work, understand where it went, and turn it into something ready to send. One calm workspace from first click to final invoice.
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

        <div className="border-t border-[#dfe5ee] bg-[#f8fafc]">
          <div className="mx-auto grid max-w-[1536px] divide-y divide-[#dfe5ee] px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-10 2xl:px-12">
            <div className="py-5 md:pr-8">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#8a94a5]">One workspace</p>
              <p className="mt-1 text-sm font-semibold text-[#17233d]">From focused work to final invoice</p>
            </div>
            <div className="py-5 md:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#8a94a5]">Made to travel</p>
              <p className="mt-1 text-sm font-semibold text-[#17233d]">Currencies and invoice languages included</p>
            </div>
            <div className="py-5 md:pl-8">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#8a94a5]">Your data, clearly</p>
              <p className="mt-1 text-sm font-semibold text-[#17233d]">Clients, projects, hours, and value connected</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-sm font-bold text-[#096cfb]">One continuous workflow</p>
              <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight text-[#071127] sm:text-5xl">
                Less admin between the work and getting paid.
              </h2>
              <p className="mt-6 max-w-md text-base leading-7 text-[#5a6577]">
                Tickd keeps the context attached, so your week never needs to be reconstructed at the end of the month.
              </p>
            </div>
            <div className="border-t border-[#d8e0ea]">
              {workflow.map(({ number, icon: Icon, title, text }) => (
                <article key={title} className="grid gap-5 border-b border-[#d8e0ea] py-8 sm:grid-cols-[88px_0.9fr_1.2fr] sm:items-start sm:py-10">
                  <div className="flex items-center gap-3 text-sm font-bold text-[#8a94a5]">
                    <span>{number}</span>
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-[#edf4ff] text-[#096cfb]">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-[#111827]">{title}</h3>
                  <p className="text-sm leading-6 text-[#667085] sm:text-base sm:leading-7">{text}</p>
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

          <div className="mt-16 grid border-y border-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ icon: Icon, label, detail }, index) => (
              <div key={label} className={`min-h-56 py-8 sm:px-7 ${index > 0 ? "sm:border-l sm:border-white/15" : ""}`}>
                <Icon className="h-6 w-6 text-[#79adff]" />
                <p className="mt-12 text-base font-semibold">{label}</p>
                <p className="mt-3 text-sm leading-6 text-[#9eabc0]">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#dfe5ee] bg-[#eef5ff] py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20 lg:px-8">
          <div>
            <p className="text-sm font-bold text-[#096cfb]">Built for international work</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight text-[#071127] sm:text-5xl">
              Your client should recognize the invoice as yours.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#566377]">
              Keep one dependable workflow while adapting the language, currency, labels, colors, and payment details for each client.
            </p>
          </div>
          <div className="border-y border-[#cbd9ec]">
            {internationalFeatures.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-4 border-b border-[#cbd9ec] py-6 last:border-b-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-[#096cfb] shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="text-base font-semibold text-[#17233d] sm:text-lg">{text}</p>
              </div>
            ))}
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
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#5e697a]">
              Set up a client, choose a project, and start the timer. Tickd keeps the structure around your work.
            </p>
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
