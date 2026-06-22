"use client";

import { motion } from "framer-motion";
import { Gamepad2, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function DashboardPage() {
  const [gamesCount, setGamesCount] = useState(0);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "games"), (snap) => {
      setGamesCount(snap.size);
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
          Dashboard Overview
        </h1>
        <p className="text-sm lg:text-base text-gray-400 mt-1">
          Welcome back! Here's what's happening today.
        </p>
      </div>

      {/* Single KPI — Games */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        <Link
          href="/games"
          className="block p-5 lg:p-6 rounded-2xl bg-[#0a0a0a] border border-white/5 hover:border-blue-500/50 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-blue-600/10 transition-all" />

          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 shadow-inner">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-sm text-blue-400 opacity-0 group-hover:opacity-100 transition-all">
              View All
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div>
            <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">
              Total Games
            </p>
            <h2 className="text-4xl font-bold text-white mt-1">{gamesCount}</h2>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}
