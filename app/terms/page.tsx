import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Terms of Service | Agentify",
  description: "Read our terms of service to understand the rules, guidelines, subscriptions, and conditions for using the Agentify platform.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header */}
      <section className="relative pt-32 pb-12 bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-50 overflow-hidden border-b border-slate-200/50">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.02),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <Shield className="w-4 h-4" />
            <span>Platform Guidelines</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 leading-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-slate-500 text-sm font-semibold">
            Last Updated: June 1, 2026
          </p>
        </div>
      </section>

      {/* Typographic Content */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-8 sm:p-12 shadow-sm text-left prose prose-slate">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">1. Agreement to Terms</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              By registering an account with Agentify AI Inc. (&quot;Agentify&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;), subscribing to our plans, or integrating our website widgets, you agree to be bound by these Terms of Service. If you do not agree to these rules, you are prohibited from using the platform.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">2. Account Terms & Access</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              To utilize our dashboard customizers, scrapers, and embedding tables, you must create an account. You represent that all details provided are complete and correct. You are responsible for preserving credentials and password keys. We reserve the absolute right to terminate accounts that violate security or provide fraudulent information.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">3. Subscription, Payments, & Refunds</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Agentify operates subscription packages (Starter, Growth, Enterprise).
            </p>
            <ul className="list-disc pl-6 text-slate-600 text-sm space-y-3 mb-6">
              <li>Payments are processed securely via card, bank transfer, or USSD using our merchant gateway integration (Paystack).</li>
              <li>Charges occur monthly based on the active tier. You can upgrade, downgrade, or cancel your renewal at any time directly through the Billing dashboard.</li>
              <li>Subscriptions are subject to monthly message or assistant quotas. Excess allocations require tier upgrades.</li>
              <li>Refunds are reviewed individually. Cancelled subscriptions remain active until the close of the current billing timeline.</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">4. Prohibited Uses</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              You agree not to utilize our web scraping, embeddings, or widget delivery engines to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 text-sm space-y-3 mb-6">
              <li>Build assistants that promote illegal activity, hate speech, or financial scams.</li>
              <li>Scrape websites without ownership or explicit indexing permission, violating target server terms.</li>
              <li>Attempt SQL injection, bypass Row Level Security policies, or extract training datasets belonging to other organizations.</li>
              <li>Reverse engineer the widget.js delivery scripts or compromise Supabase auth tables.</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">5. Limitation of Liability</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Agentify provides services &quot;as is&quot; without guarantees. We do not accept liability for business disruptions, loss of revenue, or incorrect information (hallucinations) supplied by your trained AI assistant to visitors on your site. You bear full responsibility for editing and auditing AI training materials.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">6. Amendments & Contact</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              We update these terms occasionally to reflect changes in our legal guidelines or features. Continued usage represents acceptance of the active terms. For inquiries, email <a href="mailto:support@agentify.app" className="text-indigo-600 hover:underline">support@agentify.app</a>.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
