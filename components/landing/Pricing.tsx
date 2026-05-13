import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free Trial",
    price: "$0",
    description: "Perfect for exploring the platform",
    features: ["1 AI Assistant", "50 messages/mo", "Website scraping", "Basic customization"],
    buttonText: "Start Trial",
    popular: false,
  },
  {
    name: "Starter",
    price: "$29",
    description: "Great for small businesses",
    features: ["1 AI Assistant", "500 messages/mo", "Lead capture", "Advanced customization", "Email support"],
    buttonText: "Get Started",
    popular: true,
  },
  {
    name: "Pro",
    price: "$79",
    description: "For growing companies",
    features: ["3 AI Assistants", "2,500 messages/mo", "Human fallback", "API Access", "Priority support"],
    buttonText: "Go Pro",
    popular: false,
  },
  {
    name: "Agency",
    price: "$199",
    description: "For agencies and enterprises",
    features: ["Unlimited Assistants", "10,000 messages/mo", "White-labeling", "Dedicated manager", "Custom training"],
    buttonText: "Contact Us",
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Choose the plan that best fits your business needs. No hidden fees.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative bg-white rounded-3xl p-8 border ${
                plan.popular ? 'border-indigo-600 ring-4 ring-indigo-50' : 'border-slate-200'
              } flex flex-col`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-500">/mo</span>
                </div>
                <p className="text-sm text-slate-500">{plan.description}</p>
              </div>
              
              <ul className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-center gap-3 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                variant={plan.popular ? "default" : "outline"} 
                className={`w-full rounded-full ${plan.popular ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
              >
                {plan.buttonText}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
