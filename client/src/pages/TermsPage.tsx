import { Link } from "wouter";
import LegalPage from "@/components/marketing/LegalPage";
import { CURRENT_TERMS_VERSION } from "@shared/legal";

const sections = [
  {
    title: "Your agreement with Tickd",
    content: <p>These Terms govern your use of the Tickd website and application. By creating an account or using Tickd, you agree to these Terms. If you use Tickd for a business, you confirm that you are authorised to accept them for that business.</p>,
  },
  {
    title: "Accounts and eligibility",
    content: <><p>You must provide accurate information, keep your sign-in details secure, and promptly tell us if you suspect unauthorised access. You are responsible for activity performed through your account unless the activity results from a failure of Tickd's systems.</p><p>You must be legally able to enter into this agreement. Tickd is not directed to children under 16.</p></>,
  },
  {
    title: "Using the service",
    content: <><p>Tickd provides tools for time tracking, projects, reports, invoicing, and related workflows. You may use the service only for lawful purposes and in a way that does not interfere with other users or the security and operation of Tickd.</p><p>You may not attempt to access another user's account, probe or bypass security, upload malicious code, abuse automated requests, or use Tickd to send unlawful, deceptive, or infringing material.</p></>,
  },
  {
    title: "Your content",
    content: <><p>You retain ownership of the information and files you add to Tickd. You give Tickd a limited permission to host, process, reproduce, and transmit that content only as needed to provide, secure, back up, and improve the service.</p><p>You are responsible for having the right to use the client details, project information, invoice content, and other data you add.</p></>,
  },
  {
    title: "Plans, billing, and changes",
    content: <><p>Features may vary by plan. Prices, billing intervals, trial terms, and renewal information will be shown before a paid purchase. Where permitted by law, changes to paid plans will apply from the next billing period after reasonable notice.</p><p>Features marked as coming soon are plans, not promises of a particular release date.</p></>,
  },
  {
    title: "Availability and exports",
    content: <><p>We work to keep Tickd reliable, but uninterrupted availability cannot be guaranteed. Maintenance, security incidents, internet failures, or third-party services may occasionally affect access.</p><p>You should review generated reports, invoices, tax calculations, payment details, and due dates before relying on or sending them. Tickd is a productivity tool and does not provide accounting, tax, or legal advice.</p></>,
  },
  {
    title: "Suspension and closing an account",
    content: <p>You may stop using Tickd at any time. We may limit or suspend access when reasonably necessary to protect users or the service, investigate suspected misuse, comply with law, or address unpaid charges. Where practical, we will provide notice and an opportunity to export relevant data.</p>,
  },
  {
    title: "Intellectual property",
    content: <p>Tickd and its software, design, branding, and documentation are owned by the Tickd operator or its licensors. These Terms give you a limited, non-exclusive right to use the service; they do not transfer ownership of Tickd to you.</p>,
  },
  {
    title: "Responsibility and liability",
    content: <><p>To the extent permitted by law, Tickd is provided without guarantees beyond those expressly stated here. We are not responsible for indirect or consequential losses, lost profits, or decisions based on unchecked reports or invoices.</p><p>Nothing in these Terms excludes rights or liability that cannot legally be excluded. Any dispute remains subject to the mandatory consumer and data-protection laws that apply to you and to the competent courts under applicable law.</p></>,
  },
  {
    title: "Updates and contact",
    content: <p>We may update these Terms as Tickd changes. Material updates will be communicated in the service or by email and may require renewed acceptance. Questions about these Terms can be sent through the <Link href="/contact" className="font-semibold text-[#096cfb] hover:underline">Tickd contact form</Link>.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of Service"
      title="A clear agreement for using Tickd."
      introduction="These terms explain what you can expect from Tickd and what we ask of everyone who uses it. They are written to be read, not hidden."
      version={CURRENT_TERMS_VERSION}
      sections={sections}
    />
  );
}

