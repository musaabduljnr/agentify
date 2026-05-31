import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Agentify",
  description: "Read our privacy policy to understand how Agentify collects, manages, uses, and secures your business and visitor data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header */}
      <section className="relative pt-32 pb-12 bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-50 overflow-hidden border-b border-slate-200/50">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.02),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <Shield className="w-4 h-4" />
            <span>Trust & Compliance</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 leading-tight mb-4">
            Privacy Policy
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
            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">1. Overview</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              At Agentify, we take your trust and the security of your business and customer data extremely seriously. This Privacy Policy describes how Agentify AI Inc. (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, processes, and protects your information when you subscribe to our SaaS, integrate our chat widgets, or access our dashboards.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">2. Data We Collect</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              To provide our autonomous assistant and dashboard services, we collect:
            </p>
            <ul className="list-disc pl-6 text-slate-600 text-sm space-y-3 mb-6">
              <li>
                <strong className="text-slate-900">Account Details:</strong> Personal identifiers such as name, email, billing address, and transaction histories when checking out through Paystack.
              </li>
              <li>
                <strong className="text-slate-900">Knowledge Base Materials:</strong> Website URLs, documents, FAQs, and files you explicitly submit to train your custom AI assistant.
              </li>
              <li>
                <strong className="text-slate-900">Conversation Transcripts & Leads:</strong> Message histories, visitor names, phone numbers, and emails captured during active chat interactions for dashboard displays and lead routing.
              </li>
              <li>
                <strong className="text-slate-900">Usage Analytics:</strong> IP addresses, browser dimensions, referral parameters, and widget load times to calculate server capacity and performance metrics.
              </li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">3. How We Process Knowledge Data</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              We employ highly sandboxed vector databases (utilizing Supabase pgvector) to process knowledge material:
            </p>
            <ul className="list-disc pl-6 text-slate-600 text-sm space-y-3 mb-6">
              <li>Your scrapers execute within polite constraints and respect robots.txt instructions.</li>
              <li>Trained indices are isolated by account and are never mixed with other organization clusters.</li>
              <li>We never use your custom business materials or captured lead transcripts to train public or foundational baseline models without your express authorization.</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">4. Sharing of Data</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              We do not sell, rent, or trade your organization data, lead lists, or chat histories to third parties. We share data only with authorized processors necessary for SaaS delivery: cloud hosting databases, email networks (e.g. Resend), and local payments services (e.g. Paystack).
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">5. Security Standards</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Agentify maintains strict safety protocols. All active connections utilize TLS encryption. Database access conforms to strict Row Level Security (RLS) policies, preventing unauthorized queries. Passwords and credentials remain fully protected behind Supabase Authentication.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">6. User Rights</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Under relevant global compliance guidelines (e.g., GDPR, CCPA), you reserve complete rights to inspect, update, or completely delete your account data, knowledge logs, and captured lead logs from our servers. Feel free to contact our support team at <a href="mailto:support@agentify.app" className="text-indigo-600 hover:underline">support@agentify.app</a> to submit requests.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
