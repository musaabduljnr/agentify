import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  Check, 
  Zap, 
  ArrowUpRight,
  Clock,
  Download
} from "lucide-react";

export default function BillingPage() {
  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Billing & Plans</h1>
        <p className="text-slate-500">Manage your subscription, usage, and billing history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-10">
        {/* Current Plan */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-slate-900">Starter Plan</h3>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-full uppercase tracking-widest">Active</span>
                </div>
                <p className="text-slate-500 text-sm">Your next billing date is <span className="font-bold text-slate-700">June 12, 2026</span>.</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-slate-900">$29.00</div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">per month</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">Message Usage</span>
                    <span className="text-xs text-slate-500 font-medium">412 / 500</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-[82%]" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">82% of your monthly limit used.</p>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">AI Assistants</span>
                    <span className="text-xs text-slate-500 font-medium">1 / 1</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-900 w-full" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">You have reached the limit for your current plan.</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Payment Method</h4>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center">
                    <div className="flex gap-0.5">
                      <div className="w-4 h-4 rounded-full bg-red-500 opacity-80"></div>
                      <div className="w-4 h-4 rounded-full bg-orange-400 opacity-80 -ml-2"></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Mastercard •••• 4242</p>
                    <p className="text-xs text-slate-500">Expires 12/28</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full rounded-xl h-10 text-xs font-bold border-2 border-slate-200 hover:bg-white">
                  Update Payment
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Billing History</h3>
              <Button variant="ghost" className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">See All</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-8 py-4">Invoice ID</th>
                    <th className="px-8 py-4">Date</th>
                    <th className="px-8 py-4">Amount</th>
                    <th className="px-8 py-4">Status</th>
                    <th className="px-8 py-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { id: "INV-2026-001", date: "May 12, 2026", amount: "$29.00", status: "Paid" },
                    { id: "INV-2026-002", date: "Apr 12, 2026", amount: "$29.00", status: "Paid" },
                    { id: "INV-2026-003", date: "Mar 12, 2026", amount: "$29.00", status: "Paid" },
                  ].map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-5 text-sm font-bold text-slate-900">{inv.id}</td>
                      <td className="px-8 py-5 text-sm text-slate-500 font-medium">{inv.date}</td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-900">{inv.amount}</td>
                      <td className="px-8 py-5">
                        <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-lg uppercase tracking-widest">
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 rounded-lg">
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Upgrade Card */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Upgrade to Pro</h3>
              <p className="text-slate-400 text-sm mb-8">
                Get more messages, more assistants, and unlock advanced features like human fallback and API access.
              </p>
              
              <ul className="space-y-4 mb-10">
                {[
                  "2,500 messages/mo",
                  "3 AI Assistants",
                  "Human fallback",
                  "Remove Agentify branding",
                  "Priority support"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs font-medium text-slate-300">
                    <Check className="w-4 h-4 text-indigo-400" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 font-bold flex items-center justify-center gap-2">
                Upgrade Now <ArrowUpRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Support
            </h4>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Have questions about your plan or need a custom enterprise solution?
            </p>
            <Button variant="outline" className="w-full rounded-2xl h-12 border-2 border-slate-100 font-bold hover:bg-slate-50 transition-all">
              Contact Billing Support
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
