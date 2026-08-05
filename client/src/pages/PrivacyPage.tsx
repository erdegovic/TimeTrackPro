import { Link } from "wouter";
import LegalPage from "@/components/marketing/LegalPage";
import { CURRENT_PRIVACY_VERSION } from "@shared/legal";

const sections = [
  {
    title: "Who handles your data",
    content: <p>Tickd's operator is the controller of personal information collected through the service. Privacy questions and rights requests can be submitted through the <Link href="/contact" className="font-semibold text-[#096cfb] hover:underline">Tickd contact form</Link>.</p>,
  },
  {
    title: "Information we collect",
    content: <><p>We collect account information such as your name, email address, profile image, authentication method, plan, and account status. We also store the workspace information you choose to add, including clients, projects, time entries, notes, business settings, reports, invoices, and custom preferences.</p><p>Our systems may process basic technical information such as IP address, browser details, session identifiers, request logs, and security events. If paid plans are enabled, payment providers process billing details; Tickd should not store complete card numbers.</p></>,
  },
  {
    title: "Why we use it",
    content: <><p>We process information to create and secure accounts, provide time tracking and invoicing features, send essential account emails, respond to support requests, prevent misuse, maintain backups, and improve reliability.</p><p>Depending on the context, our legal bases include performing our agreement with you, legitimate interests in operating and securing Tickd, compliance with legal obligations, and consent where the law requires it.</p></>,
  },
  {
    title: "How your workspace is protected",
    content: <><p>Workspace requests are scoped to the signed-in account so other Tickd users cannot access your data. Production database storage is encrypted at rest, browser traffic uses HTTPS, passwords are hashed, and account snapshots are encrypted with AES-256-GCM before private object storage.</p><p>Tickd is not a zero-knowledge service: its servers must process workspace data to create dashboards, reports, invoices, emails, and restorations. Authorised operational access may occur when necessary for security, support, legal compliance, or recovery and should be limited to what is needed.</p></>,
  },
  {
    title: "Service providers and transfers",
    content: <><p>We use carefully selected providers to run Tickd. These may include Hostinger for application infrastructure, Supabase for the production database, Brevo for transactional email, Google for optional sign-in, and Cloudflare R2 for encrypted backups.</p><p>Providers may process information in different countries. Where required, transfers are protected through recognised legal safeguards and provider contractual terms.</p></>,
  },
  {
    title: "Cookies and sessions",
    content: <p>Tickd uses essential cookies or similar storage to keep you signed in, protect account sessions, remember necessary preferences, and operate security features. Optional analytics or marketing technologies should not be enabled without the notice or consent required in your region.</p>,
  },
  {
    title: "Retention and deletion",
    content: <><p>We keep account and workspace information while your account is active and as reasonably needed to provide the service. Some records may be retained for security, fraud prevention, billing, dispute resolution, backups, or legal obligations.</p><p>When information is deleted, it may remain for a limited period in encrypted backups until those backups rotate or are securely removed.</p></>,
  },
  {
    title: "Your choices and rights",
    content: <p>Depending on where you live, you may request access, correction, deletion, restriction, portability, or objection to certain processing. You may also withdraw consent where processing relies on consent and complain to your local data-protection authority. We may need to verify your identity before completing a request.</p>,
  },
  {
    title: "Children",
    content: <p>Tickd is intended for professional use and is not directed to children under 16. If you believe a child has provided personal information, contact us so it can be reviewed and removed where appropriate.</p>,
  },
  {
    title: "Policy updates",
    content: <p>We may update this policy as the service, providers, or legal requirements change. Material changes will be highlighted in Tickd or sent by email, and the effective date above will be updated.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy Policy"
      title="Your work deserves careful handling."
      introduction="This policy explains what Tickd collects, why it is needed, how it is protected, and the choices available to you."
      version={CURRENT_PRIVACY_VERSION}
      sections={sections}
    />
  );
}

