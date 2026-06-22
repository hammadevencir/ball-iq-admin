"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export default function SetupPage() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const seedAdmin = async () => {
    if (!auth || !db) {
      setError("Firebase not initialized. Check environment variables.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      // 1. Create in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        "admin@balliq.com",
        "password",
      );

      const user = userCredential.user;

      // 2. Create in adminuser collection
      await setDoc(doc(db, "adminuser", user.uid), {
        email: user.email,
        role: "admin",
        createdAt: Math.floor(Date.now() / 1000),
        isSuperAdmin: true,
      });

      setStatus("success");
    } catch (err) {
      console.error(err);
      setError(err.message);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white/5 border border-white/10 p-6 lg:p-8 rounded-3xl backdrop-blur-xl text-center"
      >
        <ShieldCheck className="w-16 h-16 text-blue-500 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">Admin Seeder</h1>
        <p className="text-gray-400 mb-8">
          This will create the initial admin account: <br />
          <span className="text-blue-400 font-mono">admin@balliq.com</span>
        </p>

        {status === "idle" && (
          <button
            onClick={seedAdmin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all"
          >
            Create Admin Account
          </button>
        )}

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-gray-400">Communicating with Firebase...</p>
          </div>
        )}

        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl"
          >
            <p className="text-emerald-500 font-medium mb-4">
              Admin created successfully!
            </p>
            <a
              href="/login"
              className="inline-block bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-600 transition-all"
            >
              Go to Login
            </a>
          </motion.div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setStatus("idle")}
              className="text-gray-400 hover:text-white text-sm underline"
            >
              Try again
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
