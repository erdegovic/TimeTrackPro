import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CircleDollarSign,
  Clock3,
  FileText,
  FolderKanban,
  Headphones,
  HelpCircle,
  PencilLine,
  ReceiptText,
  Search,
  Settings2,
} from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import PublicLayout from "@/components/marketing/PublicLayout";
import { helpArticles } from "@/lib/help-content";

const articleIcons: Record<string, typeof BookOpen> = {
  "getting-started": BookOpen,
  "clients-and-projects": FolderKanban,
  "tracking-time": Clock3,
  "editing-time-entries": PencilLine,
  dashboard: BarChart3,
  reports: FileText,
  invoices: ReceiptText,
  "invoice-customization": Settings2,
  "currencies-and-conversion": CircleDollarSign,
  "settings-and-account": Settings2,
  "creative-panel": Headphones,
  troubleshooting: HelpCircle,
};

const categoryOrder = ["Start", "Track", "Review", "Bill", "Personalize", "Support"] as const;

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredArticles = useMemo(() => helpArticles.filter((article) => {
    if (!normalizedQuery) return true;
    return [article.title, article.summary, article.category, ...article.keywords]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  }), [normalizedQuery]);

  return (
    <PublicLayout>
      <section className="border-b border-gray-200 bg-[#f7f9fc] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="text-sm font-semibold text-blue-600">Tickd Help Center</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">How can we help?</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">Practical guides for every part of Tickd, from the first timer to a finished invoice.</p>
          <div className="relative mx-auto mt-8 max-w-2xl text-left">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search timers, reports, invoices, currencies..."
              className="h-12 rounded-md border-gray-300 bg-white pl-12 text-base shadow-sm"
              aria-label="Search help articles"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {filteredArticles.length === 0 ? (
          <div className="border-y border-gray-200 py-16 text-center">
            <HelpCircle className="mx-auto h-8 w-8 text-gray-400" />
            <h2 className="mt-4 text-xl font-bold">No guide matched “{query}”</h2>
            <p className="mt-2 text-sm text-gray-600">Try a shorter term or send the question directly to Tickd support.</p>
            <Link href="/contact" className="mt-5 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700">Contact support</Link>
          </div>
        ) : normalizedQuery ? (
          <section>
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
              <div><p className="text-sm font-semibold text-blue-600">Search results</p><h2 className="mt-1 text-2xl font-bold">{filteredArticles.length} {filteredArticles.length === 1 ? "guide" : "guides"}</h2></div>
              <button type="button" className="text-sm font-semibold text-gray-600 hover:text-gray-950" onClick={() => setQuery("")}>Clear search</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filteredArticles.map((article) => <HelpCard key={article.slug} article={article} />)}</div>
          </section>
        ) : (
          <div className="space-y-14">
            {categoryOrder.map((category) => {
              const categoryArticles = filteredArticles.filter((article) => article.category === category);
              if (!categoryArticles.length) return null;
              return (
                <section key={category}>
                  <div className="mb-6 border-b border-gray-200 pb-4">
                    <p className="text-sm font-semibold text-blue-600">{category}</p>
                    <h2 className="mt-1 text-2xl font-bold">{categoryTitle(category)}</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{categoryArticles.map((article) => <HelpCard key={article.slug} article={article} />)}</div>
                </section>
              );
            })}
          </div>
        )}

        <section className="mt-16 flex flex-col items-start justify-between gap-5 rounded-lg bg-[#071127] p-7 text-white sm:flex-row sm:items-center">
          <div><h2 className="text-xl font-bold">Couldn’t find the answer?</h2><p className="mt-1 text-sm leading-6 text-gray-300">Tell us what happened and include the page and action involved.</p></div>
          <Link href="/contact" className="shrink-0 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Contact support</Link>
        </section>
      </div>
    </PublicLayout>
  );
}

function HelpCard({ article }: { article: (typeof helpArticles)[number] }) {
  const Icon = articleIcons[article.slug] || BookOpen;
  return (
    <Link href={`/help/${article.slug}`} className="group flex min-h-52 flex-col rounded-lg border border-gray-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-sm">
      <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></span><span className="text-xs font-semibold uppercase text-gray-400">{article.category}</span></div>
      <h3 className="mt-7 text-lg font-bold group-hover:text-blue-700">{article.title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{article.summary}</p>
      <span className="mt-auto pt-5 text-sm font-semibold text-blue-600">Read guide</span>
    </Link>
  );
}

function categoryTitle(category: (typeof categoryOrder)[number]) {
  const labels = {
    Start: "Set up your workspace",
    Track: "Capture and correct time",
    Review: "Understand and prepare work",
    Bill: "Create client-ready invoices",
    Personalize: "Make Tickd yours",
    Support: "Solve a problem",
  };
  return labels[category];
}
