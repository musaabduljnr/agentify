import Link from "next/link";
import { Bot, Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#050608] text-slate-400 py-20 border-t border-white/[0.08]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                <Bot className="w-5 h-5" />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">Agentify</span>
            </Link>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Autonomous AI sales and support agents trained directly on your business knowledge. Deployed in seconds.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Link href="https://x.com/agentify" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all">
                <Twitter className="w-4 h-4" />
              </Link>
              <Link href="https://github.com/musaabduljnr/agentify" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all">
                <Github className="w-4 h-4" />
              </Link>
              <Link href="https://linkedin.com/company/agentify" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-all">
                <Linkedin className="w-4 h-4" />
              </Link>
            </div>
          </div>
          
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-5">Product</h4>
            <ul className="space-y-3 text-xs sm:text-sm">
              <li><Link href="/#features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/demo" className="hover:text-white transition-colors">Interactive Demo</Link></li>
              <li><Link href="/integrations" className="hover:text-white transition-colors">Supported Platforms</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-5">Resources</h4>
            <ul className="space-y-3 text-xs sm:text-sm">
              <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Product Blog</Link></li>
              <li><Link href="/changelog" className="hover:text-white transition-colors">Changelog</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Support</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-5">Compliance & Legal</h4>
            <ul className="space-y-3 text-xs sm:text-sm">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/security" className="hover:text-white transition-colors">Data Security</Link></li>
              <li><Link href="/cookie-policy" className="hover:text-white transition-colors">Cookie Preferences</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} Agentify AI Inc. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 font-medium">All systems normal</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
