import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "How does the AI train on my business content?",
    answer: "Simply submit your website domain. Our crawler systematically extracts page content, FAQs, product catalogs, and policies, translating them into dense semantic vectors so your assistant only answers with verifiable brand facts.",
  },
  {
    question: "How complex is the website installation?",
    answer: "Zero technical friction. You receive a single JavaScript embed tag to paste before your site's </body> tag. We provide 1-click plugins and tutorials for WordPress, Shopify, Webflow, Squarespace, and Wix.",
  },
  {
    question: "Can I customize the visual identity and response tone?",
    answer: "Absolutely. You have granular control over accent colors, logo, agent persona, greeting messages, suggested quick-reply buttons, and whether the assistant responds formally or playfully.",
  },
  {
    question: "What safeguards exist when the AI encounters unknown topics?",
    answer: "The assistant never invents facts. When a question exceeds its trained knowledge boundaries, it cleanly offers human agent escalation, logs an email ticket, or politely captures the visitor's contact information.",
  },
];

export function FAQ() {
  return (
    <section className="py-28 bg-[#07080c] relative overflow-hidden border-t border-white/[0.06]">
      <div className="container mx-auto px-4 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-slate-400 text-xs font-semibold tracking-wider uppercase">
            <span>Knowledge Base</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Frequently answered questions
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Everything you need to know about setting up, deploying, and training your business AI agent.
          </p>
        </div>
        
        {/* FAQ Grid */}
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className="rounded-2xl p-6 bg-[#0b0c13] border border-white/[0.08] hover:border-white/[0.15] transition-all"
            >
              <h3 className="text-base sm:text-lg font-bold text-white mb-2.5 flex items-start gap-2.5">
                <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <span>{faq.question}</span>
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed pl-7.5">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
