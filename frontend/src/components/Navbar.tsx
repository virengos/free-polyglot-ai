"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, Dumbbell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/training", icon: Dumbbell, label: "Training" },
  { href: "/vocabulary", icon: BookOpen, label: "Vocabulary" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-900/95 backdrop-blur md:static md:border-t-0 md:border-r md:w-64 md:min-h-screen md:flex-col">
      {/* Logo (desktop) */}
      <div className="hidden md:flex items-center gap-3 p-6 border-b border-slate-800">
        <span className="text-2xl">🌍</span>
        <div>
          <h1 className="font-bold text-white text-sm leading-tight">Polyglot AI</h1>
          <p className="text-xs text-slate-400">Vocabulary Trainer</p>
        </div>
      </div>

      {/* Nav links */}
      <ul className="flex md:flex-col gap-1 p-2 md:p-4">
        {navItems.map(({ href, icon: Icon, label }) => (
          <li key={href} className="flex-1 md:flex-none">
            <Link
              href={href}
              className={cn(
                "flex flex-col md:flex-row items-center gap-1 md:gap-3 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
