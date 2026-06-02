"use client";

import { useEffect, useState, useTransition, use } from "react";
import { 
  getDemoBusinessDetail, 
  updateDemoCRM, 
  extendDemoBusiness, 
  pauseDemoBusiness, 
  archiveDemoBusiness, 
  deleteDemoBusiness 
} from "@/lib/actions/demo-generator";
import { 
  Sparkles, Globe, User, Mail, Phone, Calendar, ArrowLeft, 
  BarChart3, MessageCircle, Contact2, KeyRound, Copy, 
  ExternalLink, Pause, Play, Archive, Trash2, CheckCircle2, 
  Save, AlertCircle, Bot, Send, ClipboardCheck, Loader2 
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/service";

export default function DemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // CRM edit states
  const [salesNotes, setSalesNotes] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("not_contacted");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");

  // Conversation logs viewer state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Pitch generation state
  const [pitchText, setPitchText] = useState("");

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await getDemoBusinessDetail(id);
      setData(res);
      setSalesNotes(res.demo.sales_notes || "");
      setFollowUpStatus(res.demo.follow_up_status || "not_contacted");
      if (res.demo.next_follow_up_at) {
        setNextFollowUpAt(new Date(res.demo.next_follow_up_at).toISOString().split("T")[0]);
      } else {
        setNextFollowUpAt("");
      }
      
      // Auto-select first conversation if available
      if (res.conversations.length > 0) {
        setSelectedConvId(res.conversations[0].id);
        fetchMessages(res.conversations[0].id, res.demo.placeholder_business_id);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load demo business details.");
      router.push("/admin/demos");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string, placeholderBusinessId: string) => {
    setMessagesLoading(true);
    try {
      // Fetch via supabase browser or standard server side query
      // For simplicity and admin security, we can run a fetch from supabase client
      const supabase = createServiceClient();
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .eq("business_id", placeholderBusinessId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(msgs || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
      toast.error("Failed to load conversation messages.");
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSelectConversation = (convId: string) => {
    setSelectedConvId(convId);
    fetchMessages(convId, data.demo.placeholder_business_id);
  };

  const handleSaveCRM = () => {
    startTransition(async () => {
      const res = await updateDemoCRM(id, {
        sales_notes: salesNotes,
        follow_up_status: followUpStatus,
        next_follow_up_at: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("CRM details saved successfully!");
        fetchDetail();
      }
    });
  };

  const handleQuickStatus = (status: string) => {
    setFollowUpStatus(status);
    startTransition(async () => {
      const res = await updateDemoCRM(id, {
        follow_up_status: status,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Marked as ${status.replace("_", " ")}.`);
        fetchDetail();
      }
    });
  };

  const handleExtend = async () => {
    const res = await extendDemoBusiness(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Demo extended by 14 days!");
      fetchDetail();
    }
  };

  const handleTogglePause = async (isCurrentlyPaused: boolean) => {
    const res = await pauseDemoBusiness(id, !isCurrentlyPaused);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(isCurrentlyPaused ? "Demo reactivated!" : "Demo assistant paused.");
      fetchDetail();
    }
  };

  const handleArchive = async () => {
    const res = await archiveDemoBusiness(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Demo archived.");
      fetchDetail();
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this demo? This action is irreversible.")) return;
    const res = await deleteDemoBusiness(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Demo deleted successfully.");
      router.push("/admin/demos");
    }
  };

  const generateSalesPitch = () => {
    const demoUrl = `${window.location.origin}${data.demo.demo_url}`;
    const nameStr = data.demo.contact_name ? ` ${data.demo.contact_name}` : "";
    const descriptionStr = data.demo.industry ? ` designed for the ${data.demo.industry} industry` : "";
    
    let suggestedQ = "";
    if (data.assistant?.welcome_message) {
      suggestedQ = "\nTry asking it something like: \n- \"How do your bookings work?\"\n- \"What are your pricing packages?\"";
    }

    const pitch = `Hi${nameStr},\n\nI visited your website recently and built a custom AI-powered assistant for your business${descriptionStr}.\n\nIt is fully trained on your actual website content and can answer customer queries about your products, pricing, delivery, bookings, and contact details 24/7.\n\nYou can test it live right now at this link: ${demoUrl}\n${suggestedQ}\n\nLet me know if you would like to claim this assistant for your site! It only takes 2 minutes to embed.\n\nBest regards,\n[Your Name]\nAgentify Team`;
    
    setPitchText(pitch);
    toast.success("Pitch generated! Copy it below.");
  };

  const copyPitch = () => {
    navigator.clipboard.writeText(pitchText);
    toast.success("Sales pitch copied to clipboard!");
  };

  const copyDemoLink = () => {
    const link = `${window.location.origin}${data.demo.demo_url}`;
    navigator.clipboard.writeText(link);
    toast.success("Demo link copied!");
  };

  if (loading || !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
        <p className="text-slate-400 font-semibold">Loading prospect file details...</p>
      </div>
    );
  }

  const { demo, conversations, leads, events, assistant } = data;
  const isPaused = demo.status === "paused";
  const isExpired = new Date(demo.expires_at) < new Date() || demo.status === "expired";

  return (
    <div className="space-y-8">
      {/* Back navigation */}
      <Link href="/admin/demos">
        <button className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" />
          Back to Pipeline
        </button>
      </Link>

      {/* Main Row: Header Actions */}
      <div className="bg-slate-950/65 border border-slate-850 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white">{demo.business_name}</h1>
            {demo.converted && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Claimed
              </span>
            )}
            {isExpired && !demo.converted && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                Expired
              </span>
            )}
            {isPaused && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Paused
              </span>
            )}
            {!isPaused && !isExpired && !demo.converted && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400 font-semibold">
            <a href={demo.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              {demo.website_url}
            </a>
            <span>•</span>
            <span>Created {new Date(demo.created_at).toLocaleDateString()}</span>
            <span>•</span>
            <span>Expires {new Date(demo.expires_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            onClick={copyDemoLink}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Demo Link
          </button>
          <a href={demo.demo_url} target="_blank" rel="noopener noreferrer">
            <button className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 hover:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer">
              <ExternalLink className="w-3.5 h-3.5" />
              Test Chatbot
            </button>
          </a>
          
          {demo.status !== "converted" && (
            <>
              <button
                onClick={() => handleTogglePause(isPaused)}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {isPaused ? "Resume Demo" : "Pause Demo"}
              </button>
              <button
                onClick={handleExtend}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                Extend 14 Days
              </button>
              <button
                onClick={handleArchive}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            </>
          )}
          
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:text-white hover:bg-red-500 transition cursor-pointer text-xs font-bold flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Grid: CRM Dashboard Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: CRM Controls & Leads */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Sales Follow-up CRM Card */}
          <div className="bg-slate-950/65 border border-slate-850 p-6 rounded-2xl space-y-5">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Sales CRM Follow-up
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Follow-Up Status</label>
                <select
                  value={followUpStatus}
                  onChange={(e) => setFollowUpStatus(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-350 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="not_contacted">Not Contacted</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="not_interested">Not Interested</option>
                  <option value="follow_up_later">Follow Up Later</option>
                  <option value="converted">Converted</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Next Follow-Up Date</label>
                <input
                  type="date"
                  value={nextFollowUpAt}
                  onChange={(e) => setNextFollowUpAt(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-350 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Sales Notes</label>
                <textarea
                  rows={4}
                  value={salesNotes}
                  onChange={(e) => setSalesNotes(e.target.value)}
                  placeholder="Record call logs, emails sent, prospect feedback..."
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              <button
                onClick={handleSaveCRM}
                disabled={isPending}
                className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save CRM updates
              </button>
            </div>

            {/* Quick action badges */}
            <div className="border-t border-slate-900 pt-4">
              <label className="text-[9px] font-bold text-slate-650 uppercase tracking-widest mb-2 block">Quick mark status</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Contacted", val: "contacted" },
                  { label: "Interested", val: "interested" },
                  { label: "Follow Up", val: "follow_up_later" },
                  { label: "Not Interested", val: "not_interested" }
                ].map((btn) => (
                  <button
                    key={btn.val}
                    onClick={() => handleQuickStatus(btn.val)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Details Card */}
          <div className="bg-slate-950/65 border border-slate-850 p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              Contact Information
            </h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-slate-900">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Decision Maker</span>
                <span className="text-white font-semibold">{demo.contact_name || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-900">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Contact Email</span>
                <span className="text-white font-semibold">{demo.contact_email || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Contact Phone</span>
                <span className="text-white font-semibold">{demo.contact_phone || "-"}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Middle/Right Column: Conversations & Pitch */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Analytics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Visits", value: demo.page_view_count || 0 },
              { label: "Unique visitors", value: demo.unique_visitor_count || 0 },
              { label: "Conversations", value: demo.conversation_count || 0 },
              { label: "Leads Captured", value: demo.lead_count || 0 },
            ].map((card, i) => (
              <div key={i} className="bg-slate-950/65 border border-slate-850 p-4 rounded-xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{card.label}</div>
                <div className="text-xl font-black text-white mt-1">{card.value}</div>
              </div>
            ))}
          </div>

          {/* Sales Pitch Generator Card */}
          <div className="bg-slate-950/65 border border-slate-850 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-400" />
                Generate Sales Pitch Summary
              </h3>
              <button
                onClick={generateSalesPitch}
                className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Generate Pitch
              </button>
            </div>

            {pitchText ? (
              <div className="space-y-3">
                <textarea
                  readOnly
                  rows={8}
                  value={pitchText}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-xl p-4 text-xs font-semibold focus:outline-none resize-none leading-relaxed"
                />
                <button
                  onClick={copyPitch}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 hover:text-white text-slate-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                  Copy Pitch Template
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed py-2">
                Click generate to create a personalized, copy-paste prospecting email containing their unique demo link and custom suggested questions.
              </p>
            )}
          </div>

          {/* Captured Leads list */}
          <div className="bg-slate-950/65 border border-slate-850 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Contact2 className="w-4 h-4 text-indigo-400" />
              Captured Leads ({leads.length})
            </h3>
            
            {leads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-950/40 border-b border-slate-900 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      <th className="px-4 py-2">Visitor Details</th>
                      <th className="px-4 py-2">Interest Context</th>
                      <th className="px-4 py-2 text-right">Captured Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {leads.map((lead: any) => (
                      <tr key={lead.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-4 py-3 text-xs">
                          <div className="font-bold text-white">{lead.name || "Anonymous Visitor"}</div>
                          <div className="text-slate-400 flex flex-wrap gap-2 mt-0.5">
                            {lead.email && <span className="underline">{lead.email}</span>}
                            {lead.phone && <span>{lead.phone}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-350 max-w-[200px] truncate">
                          {lead.interest || "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500 font-semibold whitespace-nowrap">
                          {new Date(lead.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-850 rounded-xl">
                No visitor contact details captured during this demo yet.
              </p>
            )}
          </div>

          {/* Conversation History & Log Viewer */}
          <div className="grid grid-cols-1 md:grid-cols-12 border border-slate-850 rounded-2xl bg-slate-950/65 overflow-hidden">
            
            {/* Conversation List Sidebar */}
            <div className="md:col-span-4 border-r border-slate-850 flex flex-col min-w-0">
              <div className="p-4 border-b border-slate-850 bg-slate-950">
                <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-indigo-400" />
                  Chat Sessions
                </h4>
              </div>
              <div className="flex-1 max-h-[400px] overflow-y-auto divide-y divide-slate-900">
                {conversations.length > 0 ? (
                  conversations.map((conv: any) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`w-full text-left p-4 transition-colors flex flex-col gap-1.5 focus:outline-none ${
                        selectedConvId === conv.id ? "bg-slate-900" : "hover:bg-slate-900/40"
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-extrabold text-white truncate max-w-[120px]">
                          {conv.visitor_id.slice(0, 12)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">
                          {new Date(conv.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 truncate w-full">
                        {conv.last_message || "No messages"}
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          {conv.message_count || 0} messages
                        </span>
                        {conv.lead_captured && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-bold uppercase tracking-wider">
                            Lead
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-10">No chats recorded.</p>
                )}
              </div>
            </div>

            {/* Conversation Log Transcript Panel */}
            <div className="md:col-span-8 flex flex-col min-w-0">
              <div className="p-4 border-b border-slate-850 bg-slate-950 flex justify-between items-center shrink-0">
                <span className="text-xs font-bold text-white uppercase tracking-widest">
                  Transcript Log
                </span>
              </div>
              <div className="flex-1 p-4 max-h-[400px] overflow-y-auto space-y-4 min-h-[300px] bg-slate-900/10">
                {messagesLoading ? (
                  <div className="h-full flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((msg: any) => {
                    const isUser = msg.role === "user";
                    return (
                      <div key={msg.id} className={`flex items-start gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
                        {!isUser && (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-slate-500 border border-slate-800">
                            <Bot className="h-3.5 w-3.5 text-indigo-450" />
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-xl px-3.5 py-2 text-xs leading-relaxed ${
                          isUser ? "bg-indigo-650 text-white rounded-tr-none" : "bg-slate-950 border border-slate-850 text-slate-300 rounded-tl-none"
                        }`}>
                          <div className="break-words">{msg.content}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex items-center justify-center py-20 text-xs text-slate-500">
                    Select a chat session to view the transcript logs.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
