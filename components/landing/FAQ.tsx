const faqs = [
  {
    question: "How does the AI learn about my business?",
    answer: "You can provide a URL to your website, and our system will automatically crawl and index the content. You can also upload PDF documents, spreadsheets, or manually enter FAQs.",
  },
  {
    question: "Is it difficult to install on my website?",
    answer: "Not at all. You just need to copy a small snippet of JavaScript code and paste it before the closing </body> tag of your website. We have guides for WordPress, Shopify, Wix, and more.",
  },
  {
    question: "Can I customize the look of the chat widget?",
    answer: "Yes, you can fully customize the colors, logo, assistant name, welcome message, and even the personality of the AI to match your brand.",
  },
  {
    question: "What happens if the AI doesn't know the answer?",
    answer: "You can set up a 'Human Fallback' where the conversation is redirected to your email or a live agent, or the AI can simply collect the visitor's contact information for you to follow up later.",
  },
];

export function FAQ() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>
        </div>
        
        <div className="max-w-3xl mx-auto space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-200 transition-colors">
              <h3 className="text-lg font-bold text-slate-900 mb-3">{faq.question}</h3>
              <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
