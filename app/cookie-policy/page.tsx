import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Cookie Policy | Agentify",
  description: "Read our cookie policy to understand how we utilize cookies and tracking technologies to optimize your dashboard and widget experience.",
};

const cookieTypes = [
  {
    name: "sb-access-token",
    type: "Essential",
    purpose: "Stores secure session keys for Supabase authentication, keeping you logged in to your dashboard.",
    duration: "Session"
  },
  {
    name: "sb-refresh-token",
    type: "Essential",
    purpose: "Allows automated secure token refreshes during long-running vector training or scraping procedures.",
    duration: "7 Days"
  },
  {
    name: "agentify-widget-state",
    type: "Functional",
    purpose: "Preserves the open/closed state of the chat assistant and stores basic conversation ID during visitor navigation.",
    duration: "24 Hours"
  },
  {
    name: "agentify-theme-preference",
    type: "Preference",
    purpose: "Remembers customized layout preferences (e.g. sidebar collapse states and custom customizer colors).",
    duration: "1 Year"
  }
];

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header */}
      <section className="relative pt-32 pb-12 bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-50 overflow-hidden border-b border-slate-200/50">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.02),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <Shield className="w-4 h-4" />
            <span>Tracking Protocols</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 leading-tight mb-4">
            Cookie Policy
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
            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">1. What are Cookies?</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Cookies are small text strings saved inside your local browser storage when you visit a website. We use cookies, web beacons, and local storage keys to optimize access parameters, customize assistant widgets, verify transactions, and store dashboard preferences.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">2. Cookies We Place</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Below is a detailed classification of the specific cookies set by the Agentify core platform and chat scripts:
            </p>

            {/* Responsive Table Container */}
            <div className="overflow-x-auto my-8 border border-slate-200 rounded-2xl shadow-sm">
              <table className="w-full text-xs text-left border-collapse bg-white">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-widest text-[9px]">
                    <th className="px-6 py-4">Cookie Key</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Detailed Purpose</th>
                    <th className="px-6 py-4">Lifespan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {cookieTypes.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-slate-900 font-mono text-[10px]">{c.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          c.type === 'Essential' ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' :
                          c.type === 'Functional' ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' :
                          'text-slate-600 bg-slate-100 border border-slate-200'
                        }`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 leading-relaxed">{c.purpose}</td>
                      <td className="px-6 py-4 font-bold text-slate-500">{c.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">3. Third Party Services</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              When processing subscriptions or embedding interactive components, authorized third-party processors place cookies under strict safety guidelines. Paystack sets necessary security and fraud cookies to verify card transactions. Resend leverages tokens to format clean welcome mails. We never let marketing pixels crawl your visitor logs or scrape training sets.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">4. Disabling Cookies</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              You possess complete authority to disable, restrict, or wipe cookies directly within your internet browser settings. Please note that blocking essential cookies will break active user sessions, signups, and dashboard editing functionality.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 mt-10">5. Inquiries</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              For additional context on our tracking protocols or cookie classifications, please message <a href="mailto:support@agentify.app" className="text-indigo-600 hover:underline">support@agentify.app</a>.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
