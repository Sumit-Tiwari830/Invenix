import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Database, MessageSquare, Menu, BookOpen, Layers } from "lucide-react";

export default function DashboardLayout({ children }) {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    {
      name: "Chats",
      path: "/",
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      name: "Knowledge Bases",
      path: "/knowledge",
      icon: <Database className="w-5 h-5" />,
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 flex-col glass-panel border-r border-white/5 h-full z-20">
        {/* App Logo */}
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-wider bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
            INVENIX
          </span>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 text-white font-medium shadow-md shadow-indigo-500/5"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 text-center">
          <p className="text-xs text-zinc-500 flex items-center justify-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Local Ollama Mode</span>
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 glass-panel border-r border-white/5 z-40 transition-transform duration-300 md:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-lg text-white">INVENIX</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-500/20 border border-indigo-500/30 text-white font-medium"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 glass-panel border-b border-white/5">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 text-zinc-300 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white tracking-wider">INVENIX</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto relative h-full">
          {children}
        </main>
      </div>
    </div>
  );
}
