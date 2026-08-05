import PublicLayout from "@/components/marketing/PublicLayout";

const faqs = [
  ["Can I use Tickd for free?", "Yes. The Free plan includes time tracking, clients, projects, manual entry editing, and the activity dashboard."],
  ["What does Pro add?", "Pro adds detailed reports, exports, invoice generation, reusable client invoice settings, currencies, and business billing preferences."],
  ["Is Ultimate available now?", "Not yet. Ultimate is planned for scheduled invoice generation and automatic delivery to client email addresses."],
  ["Do I need a card to register?", "No payment details are required for the Free plan. Billing for paid plans will be connected separately."],
  ["Can each client use a different currency and invoice language?", "Yes. Client-specific currency, colors, invoice language, labels, and template settings can be saved independently."],
  ["Can I edit tracked time?", "Yes. Descriptions, projects, dates, start and end times, durations, and individual timer blocks can be corrected."],
  ["Can I export reports and invoices?", "Report and invoice export is included in Pro. Exports use the chosen client and project currency."],
  ["Is my account data separated from other users?", "Yes. Time entries, timers, clients, projects, reports, invoices, settings, and custom preferences are scoped to the signed-in account."],
  ["How do I get help?", "Visit the Help page for workflow guidance or use the Contact form to reach Tickd support."],
];

export default function FaqPage() {
  return <PublicLayout><section className="bg-[#f7f9fc] py-20 sm:py-24"><div className="mx-auto max-w-4xl px-4 sm:px-6"><div className="text-center"><p className="text-sm font-semibold text-blue-600">FAQ</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Good questions, clearly answered.</h1></div><div className="mt-12 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white px-5 sm:px-8">{faqs.map(([question, answer]) => <details key={question} className="group py-5"><summary className="cursor-pointer list-none pr-8 text-base font-semibold marker:hidden">{question}<span className="float-right text-xl font-normal text-blue-600 group-open:hidden">+</span><span className="float-right hidden text-xl font-normal text-blue-600 group-open:inline">−</span></summary><p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">{answer}</p></details>)}</div></div></section></PublicLayout>;
}
