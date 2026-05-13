import { Button } from "@/components/ui/button";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Send,
  User as UserIcon,
  Bot
} from "lucide-react";
import { recentConversations } from "@/lib/mock-data";

export default function ConversationsPage() {
  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Conversations</h1>
          <p className="text-slate-500">Monitor and participate in real-time chats with your visitors.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-2xl h-12 px-6 flex items-center gap-2 font-bold border-2 border-slate-200">
            <Filter className="w-4 h-4" />
            Filters
          </Button>
          <Button className="bg-slate-900 text-white rounded-2xl h-12 px-6 flex items-center gap-2 font-bold">
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border border-slate-200 rounded-3xl bg-white shadow-sm overflow-hidden h-[calc(100vh-280px)] min-h-[600px]">
        {/* Left: Chat List */}
        <div className="lg:col-span-4 border-r border-slate-100 flex flex-col h-full">
          <div className="p-6 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search chats..." 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-slate-50">
            {recentConversations.map((convo, i) => (
              <div key={convo.id} className={`p-6 hover:bg-slate-50 transition-all cursor-pointer group ${i === 0 ? 'bg-indigo-50/50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    {convo.visitor}
                    {convo.status === "Lead" && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{convo.time}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1 group-hover:text-slate-700 transition-colors">{convo.lastMessage}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-full uppercase tracking-widest">
                    {convo.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Chat Detail */}
        <div className="lg:col-span-8 flex flex-col h-full bg-slate-50/30">
          <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">John Doe</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">john@example.com</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Live Now</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-10 space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200">
                <Bot className="w-6 h-6" />
              </div>
              <div className="space-y-2 max-w-[70%]">
                <div className="bg-white p-4 rounded-3xl rounded-tl-none border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed">
                  Hello! How can I help you with Agentify today?
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assistant • 10:24 AM</span>
              </div>
            </div>

            <div className="flex items-start gap-4 flex-row-reverse">
              <div className="w-10 h-10 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="space-y-2 max-w-[70%] text-right">
                <div className="bg-indigo-600 p-4 rounded-3xl rounded-tr-none text-sm text-white shadow-lg shadow-indigo-100 leading-relaxed text-left">
                  Hi! I&apos;m interested in the Pro plan. Can you tell me if it includes multi-language support?
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Visitor • 10:25 AM</span>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200">
                <Bot className="w-6 h-6" />
              </div>
              <div className="space-y-2 max-w-[70%]">
                <div className="bg-white p-4 rounded-3xl rounded-tl-none border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed">
                  Yes, it does! The Pro plan supports up to 12 different languages and includes automatic translation features.
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assistant • 10:25 AM</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border-t border-slate-100">
            <div className="relative">
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Button variant="ghost" className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 rounded-xl px-3 py-1.5">
                  AI Suggestion
                </Button>
                <Button size="icon" className="h-10 w-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100">
                  <Send className="w-5 h-5" />
                </Button>
              </div>
              <input 
                type="text" 
                placeholder="Type your message to John Doe..." 
                className="w-full pl-6 pr-40 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
