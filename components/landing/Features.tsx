import { 
  Globe, 
  MessageSquare, 
  Users, 
  BarChart3, 
  Palette, 
  Headset 
} from "lucide-react";

const features = [
  {
    title: "Website-trained AI",
    description: "Just paste your URL and our AI will scrape your content to learn everything about your business.",
    icon: Globe,
    className: "md:col-span-2 md:row-span-2 bg-indigo-600 text-white",
  },
  {
    title: "Widget and hosted chat",
    description: "Embed the assistant on your website or share a hosted chat link anywhere you sell.",
    icon: MessageSquare,
    className: "bg-white",
  },
  {
    title: "Lead Capture",
    description: "Automatically collect visitor emails and phone numbers during conversations.",
    icon: Users,
    className: "bg-white",
  },
  {
    title: "Analytics",
    description: "Deep insights into visitor behavior and common questions asked.",
    icon: BarChart3,
    className: "bg-white",
  },
  {
    title: "Custom Branding",
    description: "Match the widget colors and personality to your brand perfectly.",
    icon: Palette,
    className: "bg-white",
  },
  {
    title: "Human Fallback",
    description: "Seamlessly handover to a human agent when the AI needs help.",
    icon: Headset,
    className: "md:col-span-2 bg-slate-900 text-white",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
            Everything you need to automate support
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Agentify provides a complete suite of tools to build, train, and deploy your business AI assistant.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:auto-rows-[250px]">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${feature.className}`}
            >
              <div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                  feature.className.includes('bg-white') ? 'bg-indigo-50 text-indigo-600' : 'bg-white/10 text-white'
                }`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className={feature.className.includes('bg-white') ? 'text-slate-600' : 'text-indigo-100'}>
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
