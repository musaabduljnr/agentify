import { Bell, Search, Menu, User, Bot, Building2 } from "lucide-react";

interface TopbarProps {
  onMenuClick: () => void;
  user: any;
  profile: any;
  business: any;
  assistant: any;
}

export function Topbar({ onMenuClick, user, profile, business, assistant }: TopbarProps) {
  const displayName = profile?.full_name || user?.email || "User";

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10">
      <div className="flex items-center gap-4">
        <button 
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl"
          onClick={onMenuClick}
        >
          <Menu className="w-6 h-6" />
        </button>
        
        {/* Business Info Display */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">
              {business?.name || "No Business"}
            </span>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
            <Bot className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-indigo-700 truncate max-w-[150px]">
              {assistant?.name || "No Assistant"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2.5 text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-10 w-[1px] bg-slate-200 mx-2"></div>
        
        <div className="flex items-center gap-3 pl-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-900">{displayName}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {user?.email}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <User className="w-6 h-6" />
          </div>
        </div>
      </div>
    </header>
  );
}
