"use client";

import { useState } from "react";
import { Gamepad2, Brain, Network, Layers } from "lucide-react";
import MemoryGame from "@/components/games/MemoryGame";
import MindmapGame from "@/components/games/MindmapGame";
import TetrisGame from "@/components/games/TetrisGame";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

export default function GamesPage() {
  const [activeTab, setActiveTab] = useState("memory");

  const tabs: Tab[] = [
    {
      id: "memory",
      label: "Memory",
      icon: <Brain className="h-4 w-4" />,
      component: <MemoryGame />,
    },
    {
      id: "mindmap",
      label: "Mind Map",
      icon: <Network className="h-4 w-4" />,
      component: <MindmapGame />,
    },
    {
      id: "tetris",
      label: "Tetris",
      icon: <Layers className="h-4 w-4" />,
      component: <TetrisGame />,
    },
  ];

  const active = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="max-w-4xl mx-auto p-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Gamepad2 className="h-7 w-7 text-indigo-400" />
          Games
        </h1>
        <p className="mt-2 text-slate-400 text-sm">
          Train your vocabulary through interactive games.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-indigo-500 text-white bg-slate-800/60"
                : "border-transparent text-slate-400 hover:text-white hover:bg-slate-800/30"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active game */}
      <div>{active.component}</div>
    </div>
  );
}
