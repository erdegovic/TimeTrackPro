import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PublicLayout from "@/components/marketing/PublicLayout";

export default function ContactPage() {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSending(true);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Message could not be sent.");
      form.reset();
      setSent(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Message could not be sent.");
    } finally {
      setIsSending(false);
    }
  };

  return <PublicLayout><section className="bg-[#f7f9fc] py-20 sm:py-24"><div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8"><div><p className="text-sm font-semibold text-blue-600">Contact Tickd</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Tell us what you need.</h1><p className="mt-5 text-base leading-7 text-gray-600">Questions, feedback, and support requests are welcome. Include the page and action involved when reporting a problem.</p><div className="mt-8 flex items-center gap-3 text-sm font-medium text-gray-700"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700"><Mail className="h-5 w-5" /></span>Tickd support</div></div><div className="rounded-lg border border-gray-200 bg-white p-6 sm:p-8">{sent ? <div className="flex min-h-[420px] flex-col items-center justify-center text-center"><CheckCircle2 className="h-12 w-12 text-green-600" /><h2 className="mt-5 text-2xl font-bold">Message sent</h2><p className="mt-3 max-w-md text-sm leading-6 text-gray-600">Thanks for getting in touch. Tickd support has received your message.</p><Button variant="outline" className="mt-6" onClick={() => setSent(false)}>Send another message</Button></div> : <form onSubmit={submit} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="name">Name</Label><Input id="name" name="name" required minLength={2} maxLength={100} className="mt-1.5" /></div><div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required maxLength={255} className="mt-1.5" /></div></div><div><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" required minLength={3} maxLength={140} className="mt-1.5" /></div><div><Label htmlFor="message">Message</Label><Textarea id="message" name="message" required minLength={10} maxLength={5000} rows={8} className="mt-1.5 resize-y" /></div><input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" /><div aria-live="polite">{error && <p className="text-sm text-red-600">{error}</p>}</div><Button type="submit" size="lg" disabled={isSending}>{isSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending</> : "Send message"}</Button></form>}</div></div></section></PublicLayout>;
}
