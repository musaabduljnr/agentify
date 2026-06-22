"use client";

import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Mail, 
  MapPin, 
  Clock, 
  Bot, 
  MessageSquare, 
  Loader2, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useState } from "react";

import Link from "next/link";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("Support");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic Validation
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    // Simulate API Submission
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 1200);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header */}
      <section className="relative pt-32 pb-16 bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-50 overflow-hidden border-b border-slate-200/50">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.03),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <MessageSquare className="w-4 h-4" />
            <span>Support Desk</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-tight mb-6">
            We are here to <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">Help You</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
            Have questions about vector setups, pricing, custom branding, or agency APIs? Reach out and our team will get back to you in minutes.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Left Column: Info & Details (5 cols) */}
            <div className="lg:col-span-5 space-y-8">
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm space-y-8">
                <h3 className="text-2xl font-bold text-slate-900">Direct Support Channels</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                  We aim to respond to all dashboard queries and emails in under 2 hours, Monday through Sunday.
                </p>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Email Support</h4>
                      <p className="text-indigo-600 font-semibold text-xs mt-1">
                        <a href="mailto:support@agentify.app" className="hover:underline">support@agentify.app</a>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Response Hours</h4>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Monday - Friday: 8:00 AM - 10:00 PM (GMT+1)<br />
                        Saturday - Sunday: 10:00 AM - 6:00 PM (GMT+1)
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Headquarters</h4>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Lagos, Nigeria
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mini FAQ Box */}
              <div className="bg-slate-900 text-white rounded-[2rem] border border-slate-800 p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                    <Bot className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm">Looking for instant answers?</h4>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-6 font-medium">
                  Try viewing our interactive demo to test how Agentify responds to questions in real time. We built it using our own website scrapers!
                </p>
                <Link href="/demo" passHref legacyBehavior>
                  <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-2xl h-11 text-xs">
                    View Live Demo
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column: Interactive Form (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[2.2rem] p-8 sm:p-10 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Send us a message</h3>
              <p className="text-slate-500 text-sm mb-8 font-medium">Complete the form below and we will contact you immediately.</p>

              {success ? (
                <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/50 p-8 text-center animate-in fade-in duration-300">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-6">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-bold text-emerald-950 mb-3">Message Sent Successfully!</h4>
                  <p className="text-emerald-700 text-sm leading-relaxed max-w-md mx-auto mb-8 font-medium">
                    Thank you, <span className="font-bold">{name}</span>! Your message has been routed to our support team. A representative will contact you at <span className="font-bold">{email}</span> shortly.
                  </p>
                  <Button 
                    onClick={() => { setSuccess(false); setName(""); setEmail(""); setMessage(""); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-semibold border border-red-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 ml-1">Your Name *</label>
                      <input 
                        type="text" 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe" 
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 ml-1">Your Email *</label>
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com" 
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Topic</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold transition-all text-slate-700 bg-white"
                    >
                      <option value="Support">Technical Support</option>
                      <option value="Billing">Billing & Subscription</option>
                      <option value="Partnerships">Agencies & Partnerships</option>
                      <option value="General">General Inquiry</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Your Message *</label>
                    <textarea 
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help your business succeed today?" 
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all resize-none"
                    />
                  </div>

                  <Button 
                    disabled={loading}
                    className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-md mt-2 shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Sending message...</span>
                      </>
                    ) : (
                      <span>Submit Message</span>
                    )}
                  </Button>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
