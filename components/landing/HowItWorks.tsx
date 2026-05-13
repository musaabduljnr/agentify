import { Link2, BrainCircuit, Code2, Rocket } from "lucide-react";

const steps = [
  {
    title: "Add your website",
    description: "Provide your URL or upload documents to provide the knowledge base.",
    icon: Link2,
  },
  {
    title: "Train your assistant",
    description: "Our AI processes your data and learns how to answer questions correctly.",
    icon: BrainCircuit,
  },
  {
    title: "Copy embed code",
    description: "Get your unique script tag and paste it into your website's header.",
    icon: Code2,
  },
  {
    title: "Start answering",
    description: "Your assistant is live and ready to help visitors 24/7.",
    icon: Rocket,
  },
];

export function HowItWorks() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
            Get started in 4 simple steps
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            You don&apos;t need to be a developer to build a world-class AI assistant for your business.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {steps.map((step, index) => (
            <div key={index} className="relative group text-center">
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-1/2 w-full h-[2px] bg-slate-100 -z-10 group-hover:bg-indigo-200 transition-colors"></div>
              )}
              <div className="w-24 h-24 rounded-full bg-white border-4 border-slate-50 shadow-sm flex items-center justify-center mx-auto mb-6 group-hover:border-indigo-100 transition-all">
                <step.icon className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
