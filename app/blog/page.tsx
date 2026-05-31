"use client";

import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  BookOpen, 
  Clock, 
  User, 
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const blogCategories = ["All", "AI Tactics", "Support Hacks", "Case Studies"];

const posts = [
  {
    title: "How to train an AI on your website in 30 seconds",
    category: "AI Tactics",
    excerpt: "Scraping is simple, but clean vector training is where the magic happens. Here is how Agentify indexes, embeds, and processes your site URL.",
    content: "Web scraping might seem like a solved problem, but training a customer support AI requires more than just extracting raw text. It demands content chunking, semantic vector embeddings, and contextual retrieval. In this article, we explain how Agentify's custom crawler isolates content fields, avoids indexing repetitive footer layouts, and formats data into clean embedding structures.",
    author: "Musa Abdul (Founder)",
    readTime: "4 min read",
    date: "May 28, 2026",
    popular: true,
    color: "from-indigo-600 to-indigo-700"
  },
  {
    title: "The secret to 24/7 lead generation without human support",
    category: "Support Hacks",
    excerpt: "Your chat widget is more than a passive Q&A tool. Learn how to configure active lead forms that capture visitor details mid-chat.",
    content: "Most businesses treat website chat widgets as passive directories. But when a visitor asks a high-intent question (e.g. 'Is there a discount?' or 'Do you integrate with Shopify?'), that represents a peak buying window. Agentify allows you to trigger automated lead capture forms right inside the conversation thread, capturing verified emails and phone numbers while they are actively engaged.",
    author: "Aisha Bello (Growth)",
    readTime: "6 min read",
    date: "May 19, 2026",
    popular: false,
    color: "from-emerald-600 to-emerald-700"
  },
  {
    title: "Case Study: How a web agency closed $15K in recurring retainer upsells",
    category: "Case Studies",
    excerpt: "Web design client retainers are getting harder to sell. Here is how one agency bundled Agentify AI widgets as a premium growth add-on.",
    content: "Web agencies face intense competition. Offering just HTML/CSS designs or basic WordPress templates is no longer enough. This case study details how a local design agency set up custom-trained Agentify assistants for their e-commerce clients, charging a monthly retainer for continuous training optimizations, analytical audits, and lead capture management.",
    author: "John Doe (Partnerships)",
    readTime: "8 min read",
    date: "May 12, 2026",
    popular: false,
    color: "from-blue-600 to-blue-700"
  },
  {
    title: "Avoid the generic trap: Why prompt grounding saves your brand reputation",
    category: "AI Tactics",
    excerpt: "Untrained LLMs hallucinate pricing and terms. Here is how restricted vector embedding spaces keep your bot responses accurate and professional.",
    content: "A generic LLM prompted with general instructions is a liability for a real business. It will gladly make up return policies, apologize excessively, or praise competitors. Grounded AI models restrict their search scopes entirely to your uploaded knowledge base. If an answer isn't in your document, the assistant safely invokes standard fallback scripts or requests human help, ensuring pristine brand safety.",
    author: "Musa Abdul (Founder)",
    readTime: "5 min read",
    date: "April 29, 2026",
    popular: false,
    color: "from-cyan-600 to-cyan-700"
  }
];

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [expandedPost, setExpandedPost] = useState<number | null>(null);

  const filteredPosts = posts.filter(post => 
    activeCategory === "All" || post.category === activeCategory
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Header */}
      <section className="relative pt-32 pb-16 bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-50 overflow-hidden border-b border-slate-200/50">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.03),transparent)] pointer-events-none"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold mb-6">
            <BookOpen className="w-4 h-4" />
            <span>Agentify Library</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-tight mb-6">
            The Support <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">Growth Hub</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
            Read actionable strategies, guides, and engineering logs on training custom AI, capturing leads, and optimizing customer support pipelines.
          </p>
        </div>
      </section>

      {/* Blog Directory */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          
          {/* Category Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-12 border-b border-slate-200 pb-8">
            {blogCategories.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setExpandedPost(null); }}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm ${
                  activeCategory === cat 
                    ? "bg-indigo-600 text-white" 
                    : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Main Column: Posts (takes 2 cols on lg screens if there's no selection, else takes 3) */}
            <div className="lg:col-span-2 space-y-8">
              {filteredPosts.map((post, idx) => (
                <article 
                  key={idx}
                  className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider">
                        {post.category}
                      </span>
                      <div className="flex items-center gap-3 text-slate-400 text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-slate-900 mb-3 hover:text-indigo-600 transition-colors">
                      {post.title}
                    </h3>
                    
                    <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
                      {post.excerpt}
                    </p>

                    {expandedPost === idx && (
                      <div className="mt-4 pt-6 border-t border-slate-100 text-slate-600 text-sm leading-relaxed space-y-4 animate-in fade-in duration-200">
                        <p>{post.content}</p>
                        <p className="font-semibold text-indigo-600">
                          Looking for the full breakdown? Sign up for our Agentify sandbox to test vector grounding live on your own pages!
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                      <User className="w-4 h-4 text-indigo-500" />
                      <span>{post.author}</span>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => setExpandedPost(expandedPost === idx ? null : idx)}
                      className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold text-xs flex items-center gap-1 p-0 px-3 h-8 rounded-full"
                    >
                      {expandedPost === idx ? "Read Less" : "Read Full Post"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            {/* Sidebar Column: Highlight Card */}
            <div className="lg:col-span-1 space-y-8">
              {/* Featured / Popular Post */}
              <div className="bg-slate-900 rounded-[2.2rem] border border-slate-800 p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(circle_at_100%_0%,rgba(99,102,241,0.2),transparent)] pointer-events-none"></div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-6">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Trending Topic
                </div>
                <h4 className="text-xl font-bold mb-4 text-white leading-snug">
                  The AI-Support Landscape: Where generic bots fail real customers
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed mb-6 font-medium">
                  We compiled findings from over 5,000 active customer-facing widgets. Check out why grounding models on your core FAQs yields a 4x conversion boost in under 7 days.
                </p>
                <Link href="/signup">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-11 font-bold shadow-lg shadow-indigo-900/30 text-xs">
                    Start Learning Free
                  </Button>
                </Link>
              </div>

              {/* Tag Cloud */}
              <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                <h4 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider">Search Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {["#PromptGrounding", "#SupabaseVector", "#PaystackIntegration", "#WidgetStyling", "#LeadScrapers", "#AISupport", "#AgencyHacks", "#TikTokLaunch"].map(tag => (
                    <span key={tag} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-500 hover:border-indigo-200 hover:text-indigo-600 cursor-default transition-all">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
