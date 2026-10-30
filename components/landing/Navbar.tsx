"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import Image from "next/image";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#ffffff]/90 backdrop-blur-xl border-b border-[#eceef2] shadow-[0_1px_8px_rgba(0,0,0,0.03)]"
          : "bg-[#ffffff]/80 backdrop-blur-md border-b border-[#eceef2]"
      }`}
    >
      <div className="h-16 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between relative">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <Image
            src="/icon.svg"
            alt="Agentify"
            width={32}
            height={32}
            className="w-8 h-8 rounded-lg transition-transform group-hover:scale-105"
          />
          <span className="text-xl font-bold tracking-tight text-[#181c1f]">
            Agentify
          </span>
        </Link>

        {/* Desktop Nav Links — absolutely centered */}
        <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          <Link
            href="#how-it-works"
            className="text-[13px] font-medium text-[#434653] hover:text-[#181c1f] transition-colors py-1"
          >
            Platform
          </Link>
          <Link
            href="#capabilities"
            className="text-[13px] font-medium text-[#434653] hover:text-[#181c1f] transition-colors py-1"
          >
            Capabilities
          </Link>
          <Link
            href="#solutions"
            className="text-[13px] font-medium text-[#434653] hover:text-[#181c1f] transition-colors py-1"
          >
            Solutions
          </Link>
          <Link
            href="#faq"
            className="text-[13px] font-medium text-[#434653] hover:text-[#181c1f] transition-colors py-1"
          >
            Resources
          </Link>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          <Link
            href="/login"
            className="text-[13px] font-medium text-[#434653] hover:text-[#181c1f] px-3 py-2 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-[13px] font-semibold bg-[#181c1f] text-white hover:bg-[#2d3134] px-4 py-2 rounded-full transition-all shadow-[0_1px_3px_rgba(17,19,24,0.08)] flex items-center gap-1.5 active:scale-95"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-[#434653] hover:text-[#181c1f] p-2 transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#ffffff] border-b border-[#eceef2] px-6 py-5 space-y-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-3 text-sm font-medium text-[#434653]">
            <Link
              href="#how-it-works"
              onClick={() => setMenuOpen(false)}
              className="hover:text-[#181c1f] py-1"
            >
              Platform
            </Link>
            <Link
              href="#capabilities"
              onClick={() => setMenuOpen(false)}
              className="hover:text-[#181c1f] py-1"
            >
              Capabilities
            </Link>
            <Link
              href="#solutions"
              onClick={() => setMenuOpen(false)}
              className="hover:text-[#181c1f] py-1"
            >
              Solutions
            </Link>
            <Link
              href="#faq"
              onClick={() => setMenuOpen(false)}
              className="hover:text-[#181c1f] py-1"
            >
              Resources
            </Link>
          </nav>
          <div className="pt-3 border-t border-[#eceef2] flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="w-full text-center py-2 text-sm font-medium text-[#434653] hover:text-[#181c1f]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={() => setMenuOpen(false)}
              className="w-full text-center py-2.5 bg-[#181c1f] text-white rounded-xl text-sm font-semibold shadow-sm"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
