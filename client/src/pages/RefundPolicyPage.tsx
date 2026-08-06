import { Link } from "wouter";
import LegalPage from "@/components/marketing/LegalPage";

const sections = [
  {
    title: "Who sells Tickd subscriptions",
    content: <p>Tickd is operated by ATILA ERDEG PR POSTPRODUKCIONO UREĐIVANJE PIXELLAB NOVI SAD ("Pixellab"). Paid subscriptions are sold through Paddle, our merchant-of-record payment provider. Paddle processes payments, applicable taxes, receipts, and approved refunds.</p>,
  },
  {
    title: "Canceling a subscription",
    content: <p>You can cancel a paid subscription through the billing portal in your Tickd account. Unless checkout states otherwise, cancellation stops the next renewal and paid access continues until the end of the current billing period. Canceling does not normally create a partial refund for time already paid.</p>,
  },
  {
    title: "When a refund may be available",
    content: <><p>Please contact us promptly if you were charged more than once, charged after a confirmed cancellation, unable to use a paid feature because of a verified Tickd service failure, or believe a charge was made in error.</p><p>Refund requests are reviewed individually against the account, service usage, billing history, and applicable law. Approval is not automatic, except where consumer law requires it.</p></>,
  },
  {
    title: "How to request a refund",
    content: <p>Submit a request through the <Link href="/contact" className="font-semibold text-[#096cfb] hover:underline">Tickd contact form</Link> using the email address on your account. Include the charge date, amount, Paddle receipt or transaction reference, and a short explanation. Do not send complete card or bank details.</p>,
  },
  {
    title: "Processing an approved refund",
    content: <p>Approved refunds are returned through Paddle to the original payment method. The time required for funds to appear depends on the payment method and financial institution. Currency conversion or bank fees outside our control may affect the amount displayed by your provider.</p>,
  },
  {
    title: "Consumer rights",
    content: <p>This policy does not limit any refund, withdrawal, cancellation, or other rights that cannot legally be excluded in your country. Where mandatory law gives you stronger rights, those rights apply.</p>,
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Refund Policy"
      title="Straightforward subscription refunds."
      introduction="This policy explains how cancellations work, when a payment can be reviewed, and how to request help with a Tickd charge."
      version="2026-08-05"
      sections={sections}
    />
  );
}
