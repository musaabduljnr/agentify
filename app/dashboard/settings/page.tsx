import { Button } from "@/components/ui/button";
import { 
  User, 
  Building2, 
  Mail, 
  Globe, 
  MapPin, 
  Phone,
  Save,
  Shield,
  Bell,
  Lock
} from "lucide-react";

export default function SettingsPage() {
  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Settings</h1>
          <p className="text-slate-500">Manage your account and business profile.</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 px-8 flex items-center gap-2 font-bold shadow-lg shadow-indigo-100">
          <Save className="w-4 h-4" />
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Navigation */}
        <div className="lg:col-span-1 space-y-2">
          {[
            { icon: Building2, label: "Business Profile", active: true },
            { icon: User, label: "Personal Info", active: false },
            { icon: Bell, label: "Notifications", active: false },
            { icon: Shield, label: "Security", active: false },
            { icon: Lock, label: "Privacy", active: false },
          ].map((item) => (
            <button 
              key={item.label}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${
                item.active 
                  ? "bg-white border border-slate-200 text-indigo-600 shadow-sm" 
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100/50"
              }`}
            >
              <item.icon className={`w-5 h-5 ${item.active ? "text-indigo-600" : "text-slate-300"}`} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 md:p-10">
            <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              Business Profile
            </h3>
            
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Business Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      defaultValue="Agentify AI Inc." 
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Website URL</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="url" 
                      defaultValue="https://agentify.ai" 
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Contact Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      defaultValue="hello@agentify.ai" 
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Phone Number (WhatsApp)</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="tel" 
                      defaultValue="+1 (555) 123-4567" 
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Business Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                  <textarea 
                    rows={3}
                    defaultValue="123 AI Boulevard, Silicon Valley, CA 94025, United States" 
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 rounded-3xl border border-red-100 p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="text-red-900 font-extrabold text-lg mb-1">Danger Zone</h4>
              <p className="text-red-700 text-sm font-medium">Permanently delete your business account and all associated data.</p>
            </div>
            <Button className="bg-white text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded-2xl h-12 px-8 font-bold transition-all shrink-0">
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
