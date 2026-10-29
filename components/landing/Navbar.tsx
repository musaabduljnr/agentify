"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Bot, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

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
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/8 shadow-xl shadow-black/30"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">
            Agentify
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <Link href="#features" className="hover:text-white transition-colors">
            Features
          </Link>
          <Link href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/demo" className="hover:text-white transition-colors">
            Demo
          </Link>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white hover:bg-white/8 text-sm"
            >
              Login
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 text-sm shadow-lg shadow-indigo-600/30 transition-all">
              Get Started Free
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-slate-400 hover:text-white p-2 transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/8 px-4 pb-6 pt-2 space-y-4">
          <nav className="flex flex-col gap-3 text-sm font-medium text-slate-400">
            <Link
              href="#features"
              onClick={() => setMenuOpen(false)}
              className="hover:text-white transition-colors py-1"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              onClick={() => setMenuOpen(false)}
              className="hover:text-white transition-colors py-1"
            >
              Pricing
            </Link>
            <Link
              href="/demo"
              onClick={() => setMenuOpen(false)}
              className="hover:text-white transition-colors py-1"
            >
              Demo
            </Link>
          </nav>
          <div className="flex flex-col gap-2 pt-2 border-t border-white/8">
            <Link href="/login" className="w-full">
              <Button variant="ghost" className="w-full text-slate-400 hover:text-white justify-start">
                Login
              </Button>
            </Link>
            <Link href="/signup" className="w-full">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
