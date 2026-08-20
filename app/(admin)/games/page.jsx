"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Gamepad2,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { parseExcelAllSheets } from "@/lib/excel";
import SheetPreview from "@/components/SheetPreview";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

// Sort by the leading number in the game name ("1. Pub Quiz" -> 1,
// "4.5 Top10 (v2)" -> 4.5); names with no leading number (e.g.
// "Nationality Image") sort last.
const getOrderKey = (name) => {
  const match = /^(\d+(?:\.\d+)?)/.exec(name?.trim() ?? "");
  return match ? parseFloat(match[1]) : Infinity;
};

// Fixed display order for the known game types. Checked in order, so the
// "upload" patterns exclude their own sub-variant (e.g. Top 10 base vs. Top
// 10 Dropdown) to land in the right slot.
const FIXED_GAME_ORDER = [
  /baller\s*pub\s*quiz/i,
  /footle/i,
  /quick\s*fire\s*quiz/i,
  /group\s*quiz/i,
  /top\s*10(?!.*dropdown)/i,
  /top\s*10.*dropdown/i,
  /higher\s*or\s*lower/i,
  /football\s*darts(?!.*categor)/i,
  /football\s*darts.*categor/i,
];

const getFixedOrderIndex = (name) => {
  const trimmed = name?.trim() ?? "";
  const idx = FIXED_GAME_ORDER.findIndex((pattern) => pattern.test(trimmed));
  return idx === -1 ? Infinity : idx;
};

const sortGames = (data) =>
  [...data].sort((a, b) => {
    const fa = getFixedOrderIndex(a.name);
    const fb = getFixedOrderIndex(b.name);
    if (fa !== fb) return fa - fb;
    if (fa !== Infinity) return 0;
    const ka = getOrderKey(a.name);
    const kb = getOrderKey(b.name);
    if (ka !== kb) return ka - kb;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

export default function GamesPage() {
  const [games, setGames] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Upload form state
  const [excelFile, setExcelFile] = useState(null);
  const [parsedSheets, setParsedSheets] = useState(null); // [{ sheetName, data, gameName }]
  const [parsing, setParsing] = useState(false);

  // Fetch games in real time
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "games"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGames(sortGames(data));
    });
    return () => unsub();
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Unix timestamp (seconds) or ISO string → Date
  const toDate = (ts) =>
    typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);

  // Parse Excel when file is selected
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setParsing(true);
    setParsedSheets(null);
    try {
      const sheets = await parseExcelAllSheets(file);
      if (!sheets.length) {
        showToast("No sheets found in Excel file.", "error");
        setExcelFile(null);
        return;
      }
      setParsedSheets(
        sheets.map(({ sheetName, columns, data }) => ({
          sheetName,
          columns,
          data,
          gameName: sheetName,
          selected: true,
        })),
      );
    } catch (err) {
      console.error(err);
      showToast("Failed to parse Excel file.", "error");
      setExcelFile(null);
    } finally {
      setParsing(false);
    }
  };

  const updateSheetName = (index, gameName) => {
    setParsedSheets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, gameName } : s)),
    );
  };

  const toggleSheetSelected = (index) => {
    setParsedSheets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s)),
    );
  };

  const resetUploadModal = () => {
    setExcelFile(null);
    setParsedSheets(null);
    setShowUploadModal(false);
  };

  // Create games from parsed sheets with user-provided names
  const handleCreateGames = async (e) => {
    e.preventDefault();
    if (!parsedSheets?.length || !storage) return;

    const selectedSheets = parsedSheets.filter((s) => s.selected);
    if (!selectedSheets.length) {
      showToast("Select at least one sheet to add.", "error");
      return;
    }

    const invalid = selectedSheets.filter((s) => !s.gameName?.trim());
    if (invalid.length) {
      showToast("Please name every selected sheet.", "error");
      return;
    }

    setUploading(true);
    try {
      for (const { gameName, columns, data } of selectedSheets) {
        const safeName = gameName.trim().replace(/[^a-zA-Z0-9-_]/g, "_");
        const storagePath = `games/${Date.now()}-${safeName}.json`;
        const storageRef = ref(storage, storagePath);

        // Store the JSON as a plain array of row objects.
        const jsonBlob = new Blob([JSON.stringify(data)], {
          type: "application/json",
        });
        await uploadBytes(storageRef, jsonBlob);
        const downloadUrl = await getDownloadURL(storageRef);

        const now = Math.floor(Date.now() / 1000);
        await addDoc(collection(db, "games"), {
          name: gameName.trim(),
          dataPath: storagePath,
          dataUrl: downloadUrl,
          columns,
          columnCount: columns.length,
          rowCount: data.length,
          createdAt: now,
          updatedAt: now,
        });
      }

      showToast(
        selectedSheets.length > 1
          ? `${selectedSheets.length} games created!`
          : `"${selectedSheets[0].gameName}" created successfully!`,
      );
      resetUploadModal();
    } catch (err) {
      console.error(err);
      showToast("Failed to create games.", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
            Games
          </h1>
          <p className="text-sm lg:text-base text-gray-400 mt-1 max-w-2xl">
            Upload Excel files, convert to JSON, and manage game data.
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-semibold transition-all shrink-0 shadow-lg shadow-blue-600/10 active:scale-95 w-full sm:w-auto"
        >
          <Upload className="w-5 h-5" />
          Upload Game
        </button>
      </div>

      {/* Games Grid */}
      {games.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center p-16 rounded-2xl bg-[#0a0a0a] border border-white/5 text-center"
        >
          <Gamepad2 className="w-16 h-16 text-gray-700 mb-4" />
          <h3 className="text-xl font-semibold text-gray-400">No games yet</h3>
          <p className="text-gray-600 mt-2 max-w-sm">
            Upload your first game Excel file to get started.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {games.map((game, idx) => {
              return (
                <Link key={game.id} href={`/games/${game.id}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/5 hover:border-white/10 transition-all group relative overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-all" />

                    {/* Game Info */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/10">
                          <Gamepad2 className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-lg">
                            {game.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {game.rowCount} rows •{" "}
                            {toDate(game.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ==================== UPLOAD MODAL ==================== */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={resetUploadModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 lg:p-8 w-full max-w-lg shadow-2xl mx-2 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {parsedSheets
                    ? parsedSheets.length > 1
                      ? "Select Sheets"
                      : "Name Game"
                    : "Upload Excel"}
                </h2>
                <button
                  onClick={resetUploadModal}
                  className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!parsedSheets ? (
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-2">
                      Excel File (.xlsx, .xls)
                    </label>
                    <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-blue-500/50 transition-all bg-white/[0.02]">
                      <FileSpreadsheet className="w-10 h-10 text-gray-600 mb-3" />
                      <p className="text-sm text-gray-400">
                        {parsing
                          ? "Parsing..."
                          : excelFile
                            ? excelFile.name
                            : "Click to select Excel file"}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Multiple sheets = multiple games (one per sheet)
                      </p>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={parsing}
                      />
                    </label>
                    {parsing && (
                      <div className="flex justify-center mt-3">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateGames} className="space-y-5">
                  {(() => {
                    const multi = parsedSheets.length > 1;
                    const selectedCount = parsedSheets.filter(
                      (s) => s.selected,
                    ).length;
                    return (
                      <p className="text-sm text-gray-400 mb-4">
                        Found {parsedSheets.length} sheet
                        {multi ? "s" : ""}.{" "}
                        {multi
                          ? `Select the sheets to add (${selectedCount} selected) and name each game:`
                          : "Name the game:"}
                      </p>
                    );
                  })()}
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {parsedSheets.map((sheet, index) => {
                      const multi = parsedSheets.length > 1;
                      const dim = multi && !sheet.selected;
                      return (
                        <div
                          key={sheet.sheetName}
                          className={`p-4 rounded-xl border transition-all ${
                            dim
                              ? "bg-white/[0.02] border-white/5 opacity-60"
                              : "bg-white/5 border-white/10"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {multi && (
                              <input
                                type="checkbox"
                                checked={sheet.selected}
                                onChange={() => toggleSheetSelected(index)}
                                className="mt-1 w-4 h-4 accent-blue-600 shrink-0 cursor-pointer"
                                aria-label={`Add sheet ${sheet.sheetName}`}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <label className="text-xs text-gray-500 block mb-2">
                                Sheet "{sheet.sheetName}" ({sheet.data.length}{" "}
                                rows • {sheet.columns.length} columns)
                              </label>
                              <input
                                type="text"
                                value={sheet.gameName}
                                onChange={(e) =>
                                  updateSheetName(index, e.target.value)
                                }
                                required={sheet.selected}
                                disabled={dim}
                                placeholder={`Name for ${sheet.sheetName}`}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:cursor-not-allowed"
                              />
                              {!dim && (
                                <SheetPreview
                                  columns={sheet.columns}
                                  data={sheet.data}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setParsedSheets(null);
                        setExcelFile(null);
                      }}
                      className="px-4 py-3 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-all"
                    >
                      Change File
                    </button>
                    {(() => {
                      const selectedCount = parsedSheets.filter(
                        (s) => s.selected,
                      ).length;
                      return (
                        <button
                          type="submit"
                          disabled={uploading || selectedCount === 0}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                          {uploading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Upload className="w-5 h-5" />
                              Create {selectedCount} Game
                              {selectedCount === 1 ? "" : "s"}
                            </>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== TOAST ==================== */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${
              toast.type === "error"
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}
          >
            {toast.type === "error" ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <span className="font-medium text-sm">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
