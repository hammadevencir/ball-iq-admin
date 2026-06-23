"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Gamepad2,
  CheckCircle2,
  XCircle,
  Upload,
  X,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { db, storage } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

export default function GameDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceFile, setReplaceFile] = useState(null);
  const [parsedSheets, setParsedSheets] = useState(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!params?.id || !db) return;

    const loadGame = async () => {
      setLoading(true);
      setError(null);
      try {
        const gameSnap = await getDoc(doc(db, "games", params.id));
        if (!gameSnap.exists()) {
          setError("Game not found");
          setLoading(false);
          return;
        }
        setGame({ id: gameSnap.id, ...gameSnap.data() });
      } catch (err) {
        console.error(err);
        setError("Failed to load game");
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [params?.id]);

  const toDate = (ts) =>
    typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const isUploaded = game?.dataUrl || game?.dataPath || game?.data;

  const parseExcelAllSheets = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheets = workbook.SheetNames.map((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            return { sheetName, data: json };
          });
          resolve(sheets);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReplaceFile(file);
    setParsing(true);
    setParsedSheets(null);
    setSelectedSheetIndex(0);
    try {
      const sheets = await parseExcelAllSheets(file);
      if (!sheets.length) {
        showToast("No sheets found in Excel file.", "error");
        setReplaceFile(null);
        return;
      }
      setParsedSheets(sheets);
    } catch (err) {
      console.error(err);
      showToast("Failed to parse Excel file.", "error");
      setReplaceFile(null);
    } finally {
      setParsing(false);
    }
  };

  const resetReplaceModal = () => {
    setReplaceFile(null);
    setParsedSheets(null);
    setSelectedSheetIndex(0);
    setShowReplaceModal(false);
  };

  const applyGameData = async (jsonData) => {
    const now = Math.floor(Date.now() / 1000);

    if (storage) {
      let dataPath = game.dataPath;
      let dataUrl = game.dataUrl;

      if (dataPath) {
        const storageRef = ref(storage, dataPath);
        const jsonBlob = new Blob([JSON.stringify(jsonData)], {
          type: "application/json",
        });
        await uploadBytes(storageRef, jsonBlob);
        dataUrl = await getDownloadURL(storageRef);
      } else {
        const safeName = game.name.replace(/[^a-zA-Z0-9-_]/g, "_");
        dataPath = `games/${Date.now()}-${safeName}.json`;
        const storageRef = ref(storage, dataPath);
        const jsonBlob = new Blob([JSON.stringify(jsonData)], {
          type: "application/json",
        });
        await uploadBytes(storageRef, jsonBlob);
        dataUrl = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, "games", game.id), {
        dataPath,
        dataUrl,
        rowCount: jsonData.length,
        updatedAt: now,
        data: deleteField(),
      });

      setGame({
        ...game,
        dataPath,
        dataUrl,
        rowCount: jsonData.length,
        updatedAt: now,
        data: undefined,
      });
    } else {
      await updateDoc(doc(db, "games", game.id), {
        data: jsonData,
        rowCount: jsonData.length,
        updatedAt: now,
        dataPath: deleteField(),
        dataUrl: deleteField(),
      });

      setGame({
        ...game,
        data: jsonData,
        rowCount: jsonData.length,
        updatedAt: now,
        dataPath: undefined,
        dataUrl: undefined,
      });
    }
  };

  const handleReplaceFile = async (e) => {
    e.preventDefault();
    if (!game || !parsedSheets?.length) return;

    const selectedSheet = parsedSheets[selectedSheetIndex];
    if (!selectedSheet) return;

    setUploading(true);
    try {
      await applyGameData(selectedSheet.data);
      showToast(`File replaced for "${game.name}"`);
      resetReplaceModal();
    } catch (err) {
      console.error(err);
      showToast("Failed to replace file.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteGame = async () => {
    if (!game || !confirm(`Delete "${game.name}"? This cannot be undone.`))
      return;
    try {
      if (storage && game.dataPath) {
        await deleteObject(ref(storage, game.dataPath));
      }
      await deleteDoc(doc(db, "games", game.id));
      showToast(`"${game.name}" deleted.`);
      router.replace("/games");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete game.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-400">Loading game...</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="space-y-6">
        <Link
          href="/games"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Games
        </Link>
        <div className="p-8 rounded-2xl bg-[#0a0a0a] border border-white/5 text-center">
          <p className="text-red-400">{error || "Game not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/games"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <Gamepad2 className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                {game.name}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {game.rowCount} rows
                {game.createdAt && (
                  <> • {toDate(game.createdAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleDeleteGame}
          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all"
          title="Delete game"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Upload Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-[#0a0a0a] border border-white/5"
      >
        <div className="flex items-center gap-4">
          {isUploaded ? (
            <>
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">File uploaded</h3>
                <p className="text-sm text-gray-500">
                  JSON data is stored and ready to use
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-amber-500/10">
                <XCircle className="w-8 h-8 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">No file uploaded</h3>
                <p className="text-sm text-gray-500">
                  Game record exists but no data file is linked
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Replace File */}
      <button
        onClick={() => setShowReplaceModal(true)}
        className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-semibold transition-all border border-blue-500/20"
      >
        <Upload className="w-5 h-5" />
        Replace File
      </button>

      {/* Replace Modal */}
      <AnimatePresence>
        {showReplaceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={resetReplaceModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 lg:p-8 w-full max-w-lg shadow-2xl mx-2 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {parsedSheets
                      ? parsedSheets.length > 1
                        ? "Select Sheet"
                        : "Replace File"
                      : "Replace File"}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    For: <span className="text-blue-400">{game.name}</span>
                  </p>
                </div>
                <button
                  onClick={resetReplaceModal}
                  className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!parsedSheets ? (
                <div className="space-y-5">
                  <p className="text-sm text-gray-400 bg-white/5 rounded-xl p-4 border border-white/5">
                    The new file will replace the current data immediately.
                  </p>

                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-2">
                      Replacement Excel File
                    </label>
                    <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-blue-500/50 transition-all bg-white/[0.02]">
                      <FileSpreadsheet className="w-10 h-10 text-gray-600 mb-3" />
                      <p className="text-sm text-gray-400">
                        {parsing
                          ? "Parsing..."
                          : replaceFile
                            ? replaceFile.name
                            : "Click to select replacement file"}
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
                <form onSubmit={handleReplaceFile} className="space-y-5">
                  {parsedSheets.length > 1 ? (
                    <>
                      <p className="text-sm text-gray-400">
                        Found {parsedSheets.length} sheets. Select one to use
                        for this game:
                      </p>
                      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                        {parsedSheets.map((sheet, index) => (
                          <label
                            key={sheet.sheetName}
                            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                              selectedSheetIndex === index
                                ? "bg-blue-500/10 border-blue-500/30"
                                : "bg-white/5 border-white/10 hover:border-white/20"
                            }`}
                          >
                            <input
                              type="radio"
                              name="sheet"
                              checked={selectedSheetIndex === index}
                              onChange={() => setSelectedSheetIndex(index)}
                              className="mt-1"
                            />
                            <div>
                              <p className="font-medium text-white">
                                {sheet.sheetName}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {sheet.data.length} rows
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 bg-white/5 rounded-xl p-4 border border-white/5">
                      Using sheet &quot;{parsedSheets[0].sheetName}&quot; (
                      {parsedSheets[0].data.length} rows). The new data will
                      replace the current file immediately.
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setParsedSheets(null);
                        setReplaceFile(null);
                        setSelectedSheetIndex(0);
                      }}
                      className="px-4 py-3 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 transition-all"
                    >
                      Change File
                    </button>
                    <button
                      type="submit"
                      disabled={uploading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          Replace File
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
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
            <span className="font-medium text-sm">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
