"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { interpret, mutate } from "../../../lib/ai";
import { authHeader } from "../../../lib/supabase";

type EventItem = {
  id: string;
  title?: string | null;
  start?: string | null;
  end?: string | null;
  created_at?: string | null;
};

type ListPayload = { events?: EventItem[] } | { data?: EventItem[] } | EventItem[] | any;

function normalizeToArray(payload: ListPayload): EventItem[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray((payload as any).events)) return (payload as any).events;
  if (payload && Array.isArray((payload as any).data)) return (payload as any).data;
  return [];
}
function isoToDate(s?: string | null) { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
function startOfWeek(d: Date) { const x = new Date(d); const day = x.getDay(); x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; }
function endOfWeek(d: Date) { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate()+7); return e; }
function sameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtTime(d: Date | null) { if (!d) return ""; return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function within(d: Date, start: Date, end: Date) { return d.getTime()>=start.getTime() && d.getTime()<end.getTime(); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function localInputToISO(v: string): string | null { if (!v) return null; const dt = new Date(v); if (isNaN(dt.getTime())) return null; return dt.toISOString(); }

export default function EventsVisualPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<any>(null);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => startOfWeek(new Date()));
  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => endOfWeek(weekAnchor), [weekAnchor]);
  const days = useMemo(() => [...Array(7)].map((_, i) => addDays(weekStart, i)), [weekStart]);

  const [title, setTitle] = useState<string>("");
  const [startLocal, setStartLocal] = useState<string>("");
  const [endLocal, setEndLocal] = useState<string>("");

  const [micSupported, setMicSupported] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [lastCommand, setLastCommand] = useState<any>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      setMicSupported(true);
      const rec = new SR();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e: any) => {
        let t = "";
        for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
        setTranscript(t.trim());
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
    } else setMicSupported(false);
  }, []);

  async function refreshEvents() {
    setError(null);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/calendar/list", { method: "GET", headers, credentials: "include", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setRaw(json);
      if (!res.ok) { setEvents([]); setError(`list failed ${res.status}`); return; }
      setEvents(normalizeToArray(json));
    } catch { setError("list error"); setEvents([]); setRaw(null); }
  }

  // UPDATED: unwrap command before mutate
  async function runVoiceCommand(utterance: string) {
    if (!utterance) return;
    setLoading(true);
    setError(null);
    try {
      const interpreted = await interpret(utterance);
      const body = interpreted && typeof interpreted === "object" && "command" in (interpreted as any)
        ? (interpreted as any).command
        : interpreted;
      setLastCommand(body);
      await mutate(body);
      await refreshEvents();
    } catch { setError("voice command failed"); }
    finally { setLoading(false); }
  }

  function toggleMic() {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (!listening) { setTranscript(""); setListening(true); try { rec.start(); } catch { setListening(false); } }
    else { try { rec.stop(); } catch {} setListening(false); }
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const startISO = localInputToISO(startLocal);
      const endISO = localInputToISO(endLocal);
      if (!startISO || !endISO) { setError("Please provide valid start and end times."); setLoading(false); return; }
      await mutate({ type: "create_event", title: title || "(untitled)", start: startISO, end: endISO });
      setTitle(""); setStartLocal(""); setEndLocal("");
      await refreshEvents();
    } catch { setError("create failed"); }
    finally { setLoading(false); }
  }

  async function handleDeleteLast() {
    setLoading(true);
    setError(null);
    try { await mutate({ op: "delete_last" }); await refreshEvents(); }
    catch { setError("delete failed"); }
    finally { setLoading(false); }
  }

  useEffect(() => { refreshEvents(); }, []);

  const eventsByDay = useMemo(() => {
    const map: Record<number, EventItem[]> = {}; days.forEach((_, i) => (map[i] = []));
    for (const e of events) {
      const s = isoToDate(e.start) ?? isoToDate(e.created_at);
      const en = isoToDate(e.end) ?? s; if (!s) continue;
      const clipStart = new Date(Math.max(s.getTime(), weekStart.getTime()));
      const clipEnd = new Date(Math.min((en ?? s).getTime(), weekEnd.getTime()));
      for (let i = 0; i < days.length; i++) {
        const dayStart = new Date(days[i]); dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate()+1);
        if (within(clipStart, dayStart, dayEnd) || within(new Date(clipEnd.getTime()-1), dayStart, dayEnd)) {
          (map[i] ??= []).push(e);
        }
      }
    }
    Object.values(map).forEach(arr => arr.sort((a,b) => {
      const as = isoToDate(a.start) ?? isoToDate(a.created_at) ?? new Date(0);
      const bs = isoToDate(b.start) ?? isoToDate(b.created_at) ?? new Date(0);
      return as.getTime() - bs.getTime();
    }));
    return map;
  }, [events, days, weekStart, weekEnd]);

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(weekEnd,-1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-extrabold">Calendar</h1>
          <span className="text-xs opacity-70 border rounded px-2 py-[2px]">{tz}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setWeekAnchor(addDays(weekAnchor,-7))} className="rounded px-3 py-1 border shadow-sm active:scale-[0.99]" aria-label="Previous week">←</button>
          <button onClick={() => setWeekAnchor(startOfWeek(new Date()))} className="rounded px-3 py-1 border shadow-sm active:scale-[0.99]" aria-label="Jump to current week">Today</button>
          <button onClick={() => setWeekAnchor(addDays(weekAnchor,+7))} className="rounded px-3 py-1 border shadow-sm active:scale-[0.99]" aria-label="Next week">→</button>
          <button onClick={refreshEvents} className="rounded px-3 py-1 border shadow-sm active:scale-[0.99]">Refresh</button>
          <button onClick={handleDeleteLast} disabled={loading} className="rounded px-3 py-1 border shadow-sm active:scale-[0.99] disabled:opacity-50">{loading ? "Deleting…" : "Delete Last"}</button>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] items-center border rounded-xl p-3">
        <div className="text-sm font-semibold">🎙️ Voice</div>
        <div className="text-xs opacity-80 break-words">
          {transcript ? `“${transcript}”` : micSupported ? "Press Speak and start talking…" : "Mic not supported in this browser"}
        </div>
        <div className="flex gap-2">
          <button onClick={toggleMic} className={`rounded px-3 py-1 border shadow-sm active:scale-[0.99] ${listening ? "bg-gray-100" : ""}`} disabled={!micSupported}>
            {listening ? "Stop" : "Speak"}
          </button>
          <button onClick={() => runVoiceCommand(transcript)} className="rounded px-3 py-1 border shadow-sm active:scale-[0.99]" disabled={!transcript || loading}>
            Run
          </button>
        </div>
        {lastCommand && (
          <div className="sm:col-span-3 text-[11px] opacity-70">
            Last command: <code className="bg-gray-50 px-1 py-[1px] rounded">{JSON.stringify(lastCommand)}</code>
          </div>
        )}
      </div>

      <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-3 items-end border rounded-xl p-3">
        <div className="sm:col-span-3 text-sm font-semibold">+ New</div>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Title</span>
          <input className="border rounded px-2 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Team sync" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Start</span>
          <input type="datetime-local" className="border rounded px-2 py-1 text-sm" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">End</span>
          <input type="datetime-local" className="border rounded px-2 py-1 text-sm" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
        </label>
        <div className="sm:col-span-3">
          <button type="submit" disabled={loading} className="rounded px-3 py-1 border shadow-sm active:scale-[0.99] disabled:opacity-50">
            {loading ? "Creating…" : "Create Event"}
          </button>
        </div>
        {error && <div className="sm:col-span-3 text-red-700 bg-red-100 border border-red-300 rounded p-2 text-sm">{error}</div>}
      </form>

      <div className="text-sm opacity-80">
        {`${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(weekEnd,-1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
      </div>

      <div className="grid grid-cols-7 gap-2 text-sm">
        {days.map((d, i) => (
          <div key={i} className={`px-2 py-1 rounded border ${sameDay(d, new Date()) ? "bg-gray-100 font-semibold" : "bg-white"}`} title={d.toDateString()}>
            {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => (
          <div key={i} className="min-h-[220px] rounded-xl border p-2 bg-white">
            <ul className="space-y-1">
              {(eventsByDay[i] ?? []).map((e) => {
                const s = isoToDate(e.start) ?? isoToDate(e.created_at);
                const en = isoToDate(e.end);
                return (
                  <li key={e.id} className="text-xs border rounded px-2 py-1">
                    <div className="font-medium truncate">{e.title || "(no title)"}</div>
                    <div className="opacity-70">
                      {fmtTime(s)} {en ? <>→ {fmtTime(en)}</> : null}
                    </div>
                  </li>
                );
              })}
              {(eventsByDay[i] ?? []).length === 0 && <li className="text-xs opacity-50 italic">(no events)</li>}
            </ul>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Event List</h2>
        <ul className="space-y-1">
          {(events ?? []).map((e) => (
            <li key={e.id} className="text-sm border-b border-gray-200 pb-1">
              {e.title || "(no title)"} — {e.start} {e.end ? <>→ {e.end}</> : null}
            </li>
          ))}
          {(events ?? []).length === 0 && !error && <li className="text-sm text-gray-500">(no events)</li>}
        </ul>
        <details>
          <summary className="cursor-pointer text-sm text-gray-600">Raw list response</summary>
          <pre className="text-xs overflow-auto border rounded bg-gray-50 p-2">{JSON.stringify(raw, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}
