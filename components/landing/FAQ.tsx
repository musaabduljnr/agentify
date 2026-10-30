export function FAQ() {
  const faqs = [
    {
      question: "How does Agentify train on my business?",
      answer: "Simply input your website address. Our autonomous crawler parses your publicly available help centers, product catalog pages, and terms. You can also upload PDF manuals, Markdown files, or FAQ sheets directly."
    },
    {
      question: "Does the AI hallucinate or provide false company policies?",
      answer: "No. Agentify utilizes strict RAG (Retrieval-Augmented Generation) bounds with factual verification layers. If the agent cannot locate verifiable information in your sources, it gracefully falls back to human escalation."
    },
    {
      question: "Can I test my agent before installing it on my live site?",
      answer: "Yes! Upon entering your URL, you gain immediate access to an interactive test sandbox where you can question the agent, inspect sources, and fine-tune tone before publishing."
    }
  ];

  return (
    <section id="faq" className="w-full py-24 px-6 lg:px-12 bg-[#f7f9fd]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[11px] uppercase tracking-wider text-[#2a54c0] font-semibold block mb-2">
            Got Questions?
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#181c1f] tracking-tight">
            Frequently asked questions
          </h2>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className="bg-[#ffffff] rounded-xl p-6 border border-[#eceef2] shadow-sm hover:border-[#2a54c0]/30 transition-colors"
            >
              <h3 className="text-base sm:text-lg font-semibold text-[#181c1f] mb-2">
                {faq.question}
              </h3>
              <p className="text-sm text-[#575f6a] leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
