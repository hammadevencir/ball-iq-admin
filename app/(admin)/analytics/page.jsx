"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Rocket,
  UserPlus,
  UserCheck,
  Users,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";
import { collectionGroup, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Dropdown from "@/components/Dropdown";

const EVENT_LABELS = {
  first_open: "First Open",
  session_start: "Session Start",
  session_length: "Session Length",
  sign_up_started: "Sign-up Started",
  sign_up_completed: "Sign-up Completed",
  guest_play_started: "Guest Play Started",
  profile_completed: "Profile Completed",
  game_selected: "Game Selected",
  game_started: "Game Started",
  game_completed: "Game Completed",
  game_abandoned: "Game Abandoned",
};

const GAME_MODE_LABELS = {
  pub_quiz: "Pub Quiz",
  footle: "Footle",
  quick_fire: "Quick Fire",
  group_quiz: "Group Quiz",
  top_10: "Top 10",
  higher_lower: "Higher or Lower",
  darts: "Darts",
};

const GAME_MODES = Object.keys(GAME_MODE_LABELS);

// Cap the collection-group read so a runaway event volume can't blow up reads/memory.
const FETCH_LIMIT = 5000;

const PAGE_SIZE = 10;

// Firestore Timestamp, seconds epoch, ms epoch, or ISO string -> Date | null
const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "number") {
    return new Date(value < 10_000_000_000 ? value * 1000 : value);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const findTimestamp = (data) =>
  toDate(
    data.timestamp ??
      data.createdAt ??
      data.eventTime ??
      data.clientTimestamp ??
      data.ts,
  );

// Fields already surfaced as dedicated table columns — hidden from the
// expanded "Details" view so nothing is shown twice.
const DETAIL_HIDDEN_KEYS = new Set([
  "eventName",
  "gameMode",
  "userId",
  "timestamp",
  "createdAt",
  "eventTime",
  "clientTimestamp",
  "ts",
]);

// "sessionId" -> "Session ID", "signUpMethod" -> "Sign Up Method"
const formatFieldLabel = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim()
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1))
    .replace(/\bId\b/g, "ID")
    .replace(/\bUrl\b/g, "URL");

const formatFieldValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([k, v]) => `${formatFieldLabel(k)}: ${formatFieldValue(v)}`)
      .join(" · ");
  }
  if (typeof value === "string" && /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(value)) {
    return formatFieldLabel(value);
  }
  return String(value);
};

const KPI_CARDS = [
  {
    key: "first_open",
    label: "First Opens",
    icon: Rocket,
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-500",
    glow: "bg-blue-600/5",
  },
  {
    key: "sign_up_started",
    label: "Sign-ups Started",
    icon: UserPlus,
    iconBg: "bg-purple-500/10",
    iconText: "text-purple-500",
    glow: "bg-purple-600/5",
  },
  {
    key: "sign_up_completed",
    label: "Sign-ups Completed",
    icon: UserCheck,
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-500",
    glow: "bg-emerald-600/5",
  },
  {
    key: "guest_play_started",
    label: "Guest Plays",
    icon: Users,
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-500",
    glow: "bg-amber-600/5",
  },
];

export default function AnalyticsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [truncated, setTruncated] = useState(false);

  const [eventFilter, setEventFilter] = useState("all");
  const [gameModeFilter, setGameModeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);

  const loadEvents = async () => {
    if (!db) return;
    setError(null);
    try {
      const snap = await getDocs(
        query(collectionGroup(db, "events"), limit(FETCH_LIMIT)),
      );
      const rows = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: d.ref.parent.parent?.id ?? "unknown",
          eventName: data.eventName ?? "unknown",
          gameMode: data.gameMode ?? null,
          timestamp: findTimestamp(data),
          data,
        };
      });
      rows.sort(
        (a, b) => (b.timestamp?.getTime() ?? 0) - (a.timestamp?.getTime() ?? 0),
      );
      setEvents(rows);
      setTruncated(snap.size === FETCH_LIMIT);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to load analytics events. Check that the Analytics collection exists and Firestore rules allow admin reads.",
      );
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadEvents();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [eventFilter, gameModeFilter, userFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const counts = {};
    for (const name of Object.keys(EVENT_LABELS)) counts[name] = 0;
    const users = new Set();
    for (const e of events) {
      if (counts[e.eventName] !== undefined) counts[e.eventName] += 1;
      users.add(e.userId);
    }
    return { counts, totalUsers: users.size, totalEvents: events.length };
  }, [events]);

  const gameModeStats = useMemo(() => {
    const table = {};
    for (const mode of GAME_MODES) {
      table[mode] = { selected: 0, started: 0, completed: 0, abandoned: 0 };
    }
    for (const e of events) {
      if (!e.gameMode || !table[e.gameMode]) continue;
      if (e.eventName === "game_selected") table[e.gameMode].selected += 1;
      else if (e.eventName === "game_started") table[e.gameMode].started += 1;
      else if (e.eventName === "game_completed") table[e.gameMode].completed += 1;
      else if (e.eventName === "game_abandoned") table[e.gameMode].abandoned += 1;
    }
    return table;
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (eventFilter !== "all" && e.eventName !== eventFilter) return false;
      if (gameModeFilter !== "all" && e.gameMode !== gameModeFilter) return false;
      if (
        userFilter &&
        !e.userId.toLowerCase().includes(userFilter.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [events, eventFilter, gameModeFilter, userFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleEvents = filteredEvents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
            Analytics
          </h1>
          <p className="text-sm lg:text-base text-gray-400 mt-1">
            {stats.totalEvents} events across {stats.totalUsers} users.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 w-full sm:w-auto shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {truncated && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          Showing the first {FETCH_LIMIT.toLocaleString()} events. Totals below
          may not reflect the full dataset.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ key, label, icon: Icon, iconBg, iconText, glow }) => (
          <div
            key={key}
            className="p-5 rounded-2xl bg-[#0a0a0a] border border-white/5 relative overflow-hidden"
          >
            <div
              className={`absolute top-0 right-0 w-24 h-24 ${glow} blur-3xl rounded-full -mr-12 -mt-12`}
            />
            <div
              className={`p-3 rounded-xl ${iconBg} ${iconText} w-fit shadow-inner mb-4`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">
              {label}
            </p>
            <h2 className="text-3xl font-bold text-white mt-1">
              {stats.counts[key]}
            </h2>
          </div>
        ))}
      </div>

      {/* Onboarding funnel */}
      <div className="p-5 lg:p-6 rounded-2xl bg-[#0a0a0a] border border-white/5">
        <h3 className="text-lg font-bold text-white mb-4">
          Account &amp; Onboarding
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {["session_start", "session_length", "profile_completed"].map(
            (key) => (
              <div key={key} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  {EVENT_LABELS[key]}
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.counts[key]}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Game mode breakdown */}
      <div className="rounded-2xl bg-[#0a0a0a] border border-white/5 overflow-hidden">
        <div className="p-5 lg:p-6 pb-0">
          <h3 className="text-lg font-bold text-white">Game Mode Engagement</h3>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 uppercase text-xs tracking-wider bg-white/[0.02]">
                <th className="px-5 lg:px-6 py-3 font-medium">Game Mode</th>
                <th className="px-4 py-3 font-medium text-right">Selected</th>
                <th className="px-4 py-3 font-medium text-right">Started</th>
                <th className="px-4 py-3 font-medium text-right">Completed</th>
                <th className="px-4 py-3 font-medium text-right">Abandoned</th>
                <th className="px-5 lg:px-6 py-3 font-medium text-right">
                  Completion Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {GAME_MODES.map((mode) => {
                const row = gameModeStats[mode];
                const rate =
                  row.started > 0
                    ? `${Math.round((row.completed / row.started) * 100)}%`
                    : "—";
                return (
                  <tr key={mode} className="border-t border-white/5">
                    <td className="px-5 lg:px-6 py-3 font-medium text-white">
                      {GAME_MODE_LABELS[mode]}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {row.selected}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {row.started}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {row.completed}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {row.abandoned}
                    </td>
                    <td className="px-5 lg:px-6 py-3 text-right text-gray-300">
                      {rate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Events table */}
      <div className="rounded-2xl bg-[#0a0a0a] border border-white/5 overflow-hidden">
        <div className="p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-white">Recent Events</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <Dropdown
              className="w-full sm:w-52"
              value={eventFilter}
              onChange={setEventFilter}
              options={[
                { value: "all", label: "All Events" },
                ...Object.entries(EVENT_LABELS).map(([key, label]) => ({
                  value: key,
                  label,
                })),
              ]}
            />
            <Dropdown
              className="w-full sm:w-52"
              value={gameModeFilter}
              onChange={setGameModeFilter}
              options={[
                { value: "all", label: "All Game Modes" },
                ...GAME_MODES.map((mode) => ({
                  value: mode,
                  label: GAME_MODE_LABELS[mode],
                })),
              ]}
            />
            <input
              type="text"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="Search by User ID"
              className="w-full sm:w-52 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {visibleEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center border-t border-white/5">
            <p className="text-gray-400 font-medium">No events found</p>
            <p className="text-gray-600 text-sm mt-1">
              Try adjusting the filters above.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 uppercase text-xs tracking-wider bg-white/[0.02] border-t border-white/5">
                    <th className="px-5 lg:px-6 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Game Mode</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-5 lg:px-6 py-3 font-medium text-right">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEvents.map((e) => {
                    const rowKey = `${e.userId}-${e.id}`;
                    const isExpanded = expandedId === rowKey;
                    const detailEntries = [
                      ["userId", e.userId],
                      ...Object.entries(e.data).filter(
                        ([key]) => !DETAIL_HIDDEN_KEYS.has(key),
                      ),
                    ];
                    return (
                      <Fragment key={rowKey}>
                        <tr
                          onClick={() =>
                            setExpandedId(isExpanded ? null : rowKey)
                          }
                          className="border-t border-white/5 hover:bg-white/[0.02] cursor-pointer"
                        >
                          <td className="px-5 lg:px-6 py-3 text-white font-medium whitespace-nowrap">
                            {EVENT_LABELS[e.eventName] ?? e.eventName}
                          </td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                            {e.gameMode ? GAME_MODE_LABELS[e.gameMode] ?? e.gameMode : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                            {e.timestamp ? e.timestamp.toLocaleString() : "—"}
                          </td>
                          <td className="px-5 lg:px-6 py-3 text-right text-gray-500">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 inline" />
                            ) : (
                              <ChevronRight className="w-4 h-4 inline" />
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-white/[0.02]">
                            <td colSpan={4} className="px-5 lg:px-6 py-4">
                              {detailEntries.length === 0 ? (
                                <p className="text-sm text-gray-600">
                                  No additional details for this event.
                                </p>
                              ) : (
                                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
                                  {detailEntries.map(([key, value]) => (
                                    <div key={key} className="flex flex-col gap-0.5">
                                      <dt className="text-xs text-gray-500 uppercase tracking-wider">
                                        {formatFieldLabel(key)}
                                      </dt>
                                      <dd className="text-sm text-gray-200 font-medium break-all">
                                        {formatFieldValue(value)}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-5 border-t border-white/5">
              <p className="text-xs text-gray-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredEvents.length)} of{" "}
                {filteredEvents.length} events
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-sm text-gray-400 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
