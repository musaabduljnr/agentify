"use client";

import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  MapPin, 
  Clock, 
  Briefcase, 
  Heart, 
  Laptop, 
  Compass, 
  Award,
  ChevronRight,
  X
} from "lucide-react";
import { useState } from "react";

const departments = ["All", "Engineering", "Design", "Growth"];

const roles = [
  {
    title: "AI Research Engineer",
    department: "Engineering",
    location: "Remote (Global)",
    type: "Full-Time",
    description: "Design robust prompt embedding architectures, improve vector index searches with pgvector, and build safety barriers against prompt injection.",
    requirements: [
      "2+ years experience building production LLM applications.",
      "Expert knowledge of text-embeddings, vector search algorithms, and contextual prompt design.",
      "Strong proficiency in Node.js, Python, and SQL databases (specifically Supabase/PostgreSQL)."
    ]
  },
  {
    title: "Senior Frontend Engineer (React/Next.js)",
    department: "Engineering",
    location: "Remote (Global)",
    type: "Full-Time",
    description: "Own the development of our live widget builder customizer, focus on lightweight widget bundles (<20KB), and design responsive dashboard screens.",
    requirements: [
      "4+ years experience with modern React, Next.js (App Router), and CSS/Tailwind.",
      "Deep understanding of bundle size optimization, micro-interactions, and accessibility standards.",
      "Experience setting up high-performance embeddable script components."
    ]
  },
  {
    title: "UI/UX Product Designer",
    department: "Design",
    location: "Remote (Europe/Africa)",
    type: "Full-Time",
    description: "Oversee the end-to-end design of the Agentify customer dashboard, widget configurations, public chat pages, and brand assets.",
    requirements: [
      "Solid portfolio demonstrating visually stunning dashboard designs and web applications.",
      "Strong typography, layout, and visual design skills.",
      "Proficient in Figma, prototyping tools, and designing premium design systems."
    ]
  },
  {
    title: "Growth Marketer (TikTok & Social)",
    department: "Growth",
    location: "Remote / Hybrid",
    type: "Full-Time",
    description: "Lead our founder-led build in public campaigns, design viral, educational videos, and build custom positioning tracks targeting web agencies and store owners.",
    requirements: [
      "Proven track record growing organic TikTok, YouTube, or Twitter channels.",
      "Highly skilled at video recording, capcut editing, and hook writing.",
      "Deep familiarity with B2B SaaS, automation tools, and agency retainers."
    ]
  }
];

export default function CareersPage() {
  const [activeDept, setActiveDept] = useState("All");
  const [selectedRole, setSelectedRole] = useState<typeof roles[0] | null>(null);

  const filteredRoles = roles.filter(role => 
    activeDept === "All" || role.department === activeDept
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header */}
      <section className="relative pt-32 pb-20 bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-50 overflow-hidden border-b border-slate-200/50">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.03),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <Briefcase className="w-4 h-4" />
            <span>Join the Crew</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-tight mb-6">
            Build the Future of <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">Autonomous Web AI</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
            Agentify is remote-first, engineering-led, and obsessed with creating visual excellence and flawless reliability. Come help us build.
          </p>
        </div>
      </section>

      {/* Perks Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why you will love working here</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm">We provide everything you need to do your best work from anywhere in the world.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: "Remote First", desc: "Work from wherever you are most productive. We respect time zones.", icon: Laptop },
              { title: "Premium Gear", desc: "Get high-end MacBooks, 4K displays, and comfortable chair allowance.", icon: Heart },
              { title: "Annual Retreats", desc: "Bi-annual team trips to beautiful destinations to bond and brainstorm.", icon: Compass },
              { title: "Growth Budget", desc: "USD 1,500 yearly for courses, books, developer camps, or design assets.", icon: Award }
            ].map((perk, i) => (
              <div key={i} className="text-center border border-slate-100 p-6 rounded-3xl bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <perk.icon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 mb-2">{perk.title}</h4>
                <p className="text-slate-500 text-xs leading-relaxed">{perk.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Roles Directory */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Open Positions</h2>
            <p className="text-slate-500 text-sm">Find your path in engineering, design, or brand growth.</p>
          </div>

          {/* Dept Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm ${
                  activeDept === dept 
                    ? "bg-indigo-600 text-white" 
                    : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Roles List */}
          <div className="space-y-4">
            {filteredRoles.map((role, idx) => (
              <div 
                key={idx}
                onClick={() => setSelectedRole(role)}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group"
              >
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {role.title}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {role.department}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {role.location}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {role.type}</span>
                  </div>
                </div>

                <Button variant="outline" className="rounded-full border-slate-200 group-hover:border-indigo-600 group-hover:text-indigo-600 group-hover:bg-indigo-50/20 text-xs shrink-0 self-start sm:self-center">
                  Apply Now <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role Details Drawer/Modal */}
      {selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div 
            className="w-full max-w-2xl bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg leading-none">{selectedRole.title}</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">{selectedRole.department}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRole(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-left">
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Role Overview</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{selectedRole.description}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-4">Requirements</h4>
                <div className="space-y-4">
                  {selectedRole.requirements.map((req, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">{req}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form placeholder description */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600 leading-relaxed">
                <span className="font-bold text-indigo-600 block mb-1">To apply:</span>
                Send your CV and a link to your portfolio or github to <span className="font-bold text-slate-900">careers@agentify.app</span> with the subject line format: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-xs font-mono">[{selectedRole.title}] - [Your Name]</code>. We review applications within 72 hours.
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setSelectedRole(null)} className="rounded-full">
                Close
              </Button>
              <Button 
                onClick={() => { window.location.href = `mailto:careers@agentify.app?subject=[${encodeURIComponent(selectedRole.title)}] - Application`; }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6"
              >
                Email Application
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
