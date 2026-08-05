import { ReactNode } from "react";
import PublicLayout from "./PublicLayout";

type LegalSection = {
  title: string;
  content: ReactNode;
};

export default function LegalPage({
  eyebrow,
  title,
  introduction,
  version,
  sections,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  version: string;
  sections: LegalSection[];
}) {
  return (
    <PublicLayout>
      <section className="border-b border-[#dfe5ee] bg-[#f7f9fc] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-sm font-bold text-[#138a3b]">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#071127] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#667085]">{introduction}</p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-[#8a94a5]">Effective {version}</p>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="divide-y divide-[#e4e9f0] border-y border-[#e4e9f0]">
            {sections.map((section, index) => (
              <article key={section.title} className="grid gap-4 py-8 sm:grid-cols-[52px_1fr] sm:gap-6 sm:py-10">
                <span className="text-sm font-bold text-[#096cfb]">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="text-xl font-semibold text-[#17233d]">{section.title}</h2>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-[#5f6b7c]">{section.content}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

