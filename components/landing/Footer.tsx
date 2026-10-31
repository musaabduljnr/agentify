import Link from "next/link";
import Image from "next/image";
import { Globe, Terminal, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full bg-[#ffffff] border-t border-[#eceef2]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          
          {/* Col 1: Brand & Status */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 group">
              <div className="w-6 h-6 rounded bg-[#2a54c0] flex items-center justify-center text-white shadow-xs">
                <Image 
                  src="/icon.svg" 
                  alt="Agentify" 
                  width={14} 
                  height={14} 
                  className="w-3.5 h-3.5 invert brightness-0"
                />
              </div>
              <span className="text-lg font-bold text-[#181c1f] tracking-tight">
                Agentify
              </span>
            </Link>
            <p className="text-xs text-[#575f6a] leading-relaxed mb-6">
              Autonomous AI agents for round-the-clock customer support, intelligent routing, and pipeline generation.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f2f4f8] border border-[#eceef2]">
              <span className="h-2 w-2 rounded-full bg-[#027A48] animate-pulse"></span>
              <span className="text-xs font-medium text-[#181c1f]">All systems normal</span>
            </div>
          </div>

          {/* Col 2: Platform */}
          <div>
            <h4 className="text-[11px] font-semibold text-[#575f6a] uppercase tracking-wider mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-[13px]">
              <li>
                <Link href="#capabilities" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Agent Engine
                </Link>
              </li>
              <li>
                <Link href="#capabilities" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Omnichannel Inbox
                </Link>
              </li>
              <li>
                <Link href="#capabilities" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Knowledge Synapse
                </Link>
              </li>
              <li>
                <Link href="#capabilities" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Integrations & API
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Solutions */}
          <div>
            <h4 className="text-[11px] font-semibold text-[#575f6a] uppercase tracking-wider mb-4">
              Solutions
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-[13px]">
              <li>
                <Link href="#solutions" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  B2B SaaS Support
                </Link>
              </li>
              <li>
                <Link href="#solutions" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  E-Commerce Growth
                </Link>
              </li>
              <li>
                <Link href="#solutions" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Fintech Compliance
                </Link>
              </li>
              <li>
                <Link href="#solutions" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Lead Qualification
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Resources */}
          <div>
            <h4 className="text-[11px] font-semibold text-[#575f6a] uppercase tracking-wider mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-[13px]">
              <li>
                <Link href="/demo" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Pricing & Plans
                </Link>
              </li>
              <li>
                <Link href="#faq" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Security & Trust
                </Link>
              </li>
              <li>
                <Link href="/demo" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Customer Stories
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: Company */}
          <div>
            <h4 className="text-[11px] font-semibold text-[#575f6a] uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-[13px]">
              <li>
                <Link href="/about" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/careers" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[#575f6a] hover:text-[#181c1f] transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright and metadata */}
        <div className="border-t border-[#eceef2] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#575f6a]">
          <p>© {new Date().getFullYear()} Agentify Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link aria-label="Global Network" className="hover:text-[#181c1f] transition-colors" href="/">
              <Globe className="w-4 h-4" />
            </Link>
            <Link aria-label="Developer Portal" className="hover:text-[#181c1f] transition-colors" href="/demo">
              <Terminal className="w-4 h-4" />
            </Link>
            <Link aria-label="Contact Mail" className="hover:text-[#181c1f] transition-colors" href="mailto:support@agentify.app">
              <Mail className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
