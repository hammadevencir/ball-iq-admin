"use client";

import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard,
  Gamepad2,
  LogOut,
  Menu,
  X,
  Trophy,
  Bell,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayoutShell({ children }) {
  const { logout, user } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  // Sidebar visibility logic
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { name: "Games", icon: Gamepad2, href: "/games" },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex overflow-x-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 260 : isMobile ? 0 : 80,
          x: isMobile && !isSidebarOpen ? -260 : 0,
        }}
        className={`bg-[#0a0a0a] border-r border-white/5 flex flex-col z-50 fixed top-0 h-screen transition-all duration-300 ease-in-out ${
          isMobile ? "shadow-2xl shadow-black" : ""
        }`}
        style={{
          overflow: isMobile && !isSidebarOpen ? "hidden" : "visible",
        }}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/20">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            {(isSidebarOpen || isMobile) && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-bold text-lg tracking-tight whitespace-nowrap"
              >
                Ball IQ
              </motion.span>
            )}
          </div>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-gray-400 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => isMobile && setSidebarOpen(false)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
                  isActive
                    ? "bg-blue-600/10 text-blue-500"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 shrink-0 ${isActive ? "text-blue-500" : ""}`}
                />
                {(isSidebarOpen || (isMobile && isSidebarOpen)) && (
                  <span className="whitespace-nowrap">{item.name}</span>
                )}
                {isActive && isSidebarOpen && (
                  <motion.div
                    layoutId="active"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={logout}
            className="flex items-center gap-3 p-3 w-full rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all group"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && (
              <span className="whitespace-nowrap">Logout</span>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen relative w-full overflow-x-hidden">
        {/* Header */}
        <header className="h-16 lg:h-20 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-xl flex items-center justify-end px-4 lg:px-8 lg:pl-72 sticky top-0 z-40">
            <div className="flex items-center gap-2 lg:gap-3 lg:pl-6 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white max-w-[120px] truncate">
                  {user?.email?.split("@")[0]}
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Super Admin
                </p>
              </div>
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-[#0a0a0a] flex items-center justify-center font-bold text-blue-500 text-xs lg:text-base">
                  {user?.email?.[0].toUpperCase()}
                </div>
              </div>
            </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-8 lg:pl-72 w-full max-w-[100vw]">{children}</div>
      </main>
    </div>
  );
}
