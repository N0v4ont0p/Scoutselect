"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Globe, Menu, X } from "lucide-react";
import { useI18n } from "@/context/LanguageContext";

export default function Navbar() {
  const { t, toggle } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NAV_LINKS = [
    { href: "/teams", label: t.nav.teams },
    { href: "/events", label: t.nav.events },
    { href: "/compare", label: t.nav.compare },
    { href: "/methodology", label: t.nav.methodology },
  ];

  return (
    <nav
      className="glass sticky top-0 z-50 border-b animate-slide-down"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-black text-lg tracking-tight select-none"
        >
          <Image
            src="/logo.png"
            alt="ScoutSelect logo"
            width={764}
            height={338}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <div
          className="hidden sm:flex items-center gap-6 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-white transition-colors duration-200 relative group"
            >
              {l.label}
              <span
                className="absolute -bottom-0.5 left-0 w-0 h-px group-hover:w-full transition-all duration-300"
                style={{ background: "var(--accent)" }}
              />
            </Link>
          ))}
          <button
            onClick={toggle}
            className="lang-btn flex items-center gap-1.5 ml-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors min-h-[36px]"
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            {t.nav.toggleLang}
          </button>
        </div>

        {/* Mobile controls */}
        <div className="sm:hidden flex items-center gap-2">
          <button
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="sm:hidden border-t px-4 py-3 flex flex-col gap-3 text-sm animate-slide-down"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-white transition-colors py-1"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={toggle}
            className="lang-btn flex items-center gap-1.5 w-fit px-2 py-2 rounded-lg hover:bg-white/5 transition-colors min-h-[44px]"
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            {t.nav.toggleLang}
          </button>
        </div>
      )}
    </nav>
  );
}
