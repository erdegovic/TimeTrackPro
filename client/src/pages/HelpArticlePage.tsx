import { ArrowLeft, CheckCircle2, Info, LifeBuoy } from "lucide-react";
import { Link, useRoute } from "wouter";
import PublicLayout from "@/components/marketing/PublicLayout";
import { getHelpArticle, helpArticles } from "@/lib/help-content";

const sectionId = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function HelpArticlePage() {
  const [, params] = useRoute("/help/:topic");
  const article = getHelpArticle(params?.topic);

  if (!article) {
    return <PublicLayout><section className="mx-auto max-w-3xl px-4 py-24 text-center"><h1 className="text-3xl font-bold">Guide not found</h1><p className="mt-3 text-gray-600">This help article may have moved.</p><Link href="/help" className="mt-6 inline-flex text-sm font-semibold text-blue-600">Back to Help Center</Link></section></PublicLayout>;
  }

  const relatedArticles = article.related.map(getHelpArticle).filter(Boolean) as typeof helpArticles;

  return (
    <PublicLayout>
      <header className="border-b border-gray-200 bg-[#f7f9fc]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <Link href="/help" className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-blue-700"><ArrowLeft className="mr-2 h-4 w-4" />Help Center</Link>
          <p className="mt-8 text-sm font-semibold text-blue-600">{article.category}</p>
          <h1 className="mt-2 max-w-4xl text-4xl font-bold sm:text-5xl">{article.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-600">{article.summary}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-8 lg:py-16">
        <article className="min-w-0">
          {article.image && (
            <figure className="mb-14 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <img src={article.image} alt={article.imageAlt || ""} className="aspect-[1.53/1] w-full object-cover object-top" />
              {article.imageCaption && <figcaption className="border-t border-gray-200 bg-white px-5 py-3 text-xs leading-5 text-gray-500">{article.imageCaption}</figcaption>}
            </figure>
          )}

          <div className="space-y-14">
            {article.sections.map((section) => (
              <section key={section.title} id={sectionId(section.title)} className="scroll-mt-24 border-t border-gray-200 pt-7">
                <h2 className="text-2xl font-bold">{section.title}</h2>
                {section.introduction && <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700">{section.introduction}</p>}
                {section.steps && (
                  <ol className="mt-6 space-y-5">
                    {section.steps.map((step, index) => <li key={step} className="grid grid-cols-[32px_1fr] gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{index + 1}</span><p className="pt-1 text-sm leading-6 text-gray-700">{step}</p></li>)}
                  </ol>
                )}
                {section.bullets && (
                  <ul className="mt-6 space-y-3">
                    {section.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" /><p className="text-sm leading-6 text-gray-700">{bullet}</p></li>)}
                  </ul>
                )}
                {section.note && <div className="mt-6 flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-4"><Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" /><p className="text-sm leading-6 text-blue-900">{section.note}</p></div>}
              </section>
            ))}
          </div>
        </article>

        <aside className="h-fit lg:sticky lg:top-24">
          <div className="border-l-2 border-gray-200 pl-5">
            <p className="text-xs font-bold uppercase text-gray-500">In this guide</p>
            <nav className="mt-4 flex flex-col gap-3" aria-label="Article sections">{article.sections.map((section) => <a key={section.title} href={`#${sectionId(section.title)}`} className="text-sm leading-5 text-gray-600 hover:text-blue-700">{section.title}</a>)}</nav>
          </div>

          <div className="mt-9 border-t border-gray-200 pt-6">
            <p className="text-xs font-bold uppercase text-gray-500">Related guides</p>
            <div className="mt-4 flex flex-col gap-3">{relatedArticles.map((related) => <Link key={related.slug} href={`/help/${related.slug}`} className="text-sm font-semibold leading-5 text-blue-600 hover:text-blue-700">{related.title}</Link>)}</div>
          </div>

          <div className="mt-9 rounded-lg bg-[#071127] p-5 text-white">
            <LifeBuoy className="h-5 w-5 text-blue-300" />
            <p className="mt-4 text-sm font-bold">Need a closer look?</p>
            <p className="mt-2 text-xs leading-5 text-gray-300">Send the page, action, and result to Tickd support.</p>
            <Link href="/contact" className="mt-4 inline-flex text-sm font-semibold text-blue-300 hover:text-white">Contact support</Link>
          </div>
        </aside>
      </div>
    </PublicLayout>
  );
}
