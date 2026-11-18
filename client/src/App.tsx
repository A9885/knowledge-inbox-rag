import { useRef, useState } from "react";
import { ApiError } from "./api/client";
import { useChats } from "./hooks/useChats";
import { useItems } from "./hooks/useItems";
import { ChatTabs } from "./components/ChatTabs";
import { ChatThread } from "./components/ChatThread";
import { AskBox, type Mode } from "./components/AskBox";
import { ChatNotices, type Chip, type Notice } from "./components/ChatNotices";
import { guessIntent, parseCommand } from "./lib/intent";
import { ErrorBanner } from "./components/ErrorBanner";
import { ItemPanel } from "./components/ItemPanel";
import { ItemList } from "./components/ItemList";

export default function App() {
  const { items, loading, error, addItem, pinMessage, editItem, removeItem } = useItems();
  const [panel, setPanel] = useState<{ id: string; edit: boolean } | null>(null);
  const chats = useChats();
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<Mode>("ask");
  const [view, setView] = useState<"chat" | "inbox">("chat"); // small screens show one panel at a time, chat first
  const [notices, setNotices] = useState<Notice[]>([]);
  const [chip, setChip] = useState<Chip | null>(null);
  const [saving, setSaving] = useState<"note" | "url" | null>(null);
  const run = (q: string) => {
    if (chats.loading) return; // suggestion chips stay visible while an answer streams
    setQuestion("");
    void chats.ask(q);
  };

  // Only explicit actions save: a mode, a /command, or a click on a chip. Uses the normal ingest endpoint.
  const timers = useRef(new Set<number>());
  const notify = (n: Notice) => {
    setNotices((all) => [...all, n]);
    if (n.kind !== "error") {
      // Successes tidy themselves away; errors stay until dismissed.
      const t = window.setTimeout(() => setNotices((all) => all.filter((x) => x.id !== n.id)), 5000);
      timers.current.add(t);
    }
  };
  const dismiss = (id: number) => setNotices((all) => all.filter((n) => n.id !== id));
  const startNote = () => {
    setMode("note");
    setView("chat");
    window.setTimeout(() => document.getElementById("askbox-input")?.focus(), 0);
  };

  const save = async (type: "note" | "url", content: string) => {
    setChip(null);
    setQuestion("");
    setMode("ask");
    setSaving(type);
    try {
      const item = await addItem(type, content);
      notify({ id: Date.now(), kind: "saved", item });
    } catch (e) {
      const dup = e instanceof ApiError && e.code === "ALREADY_SAVED" && e.itemId;
      if (dup) notify({ id: Date.now(), kind: "duplicate", itemId: dup, title: items.find((i) => i.id === dup)?.title ?? "this one" });
      else notify({ id: Date.now(), kind: "error", text: (e as Error).message });
    } finally {
      setSaving(null);
    }
  };
  const undo = async (n: Extract<Notice, { kind: "saved" }>) => {
    try {
      await removeItem(n.item.id);
      setNotices((all) => all.map((x) => (x === n ? { ...n, undone: true } : x)));
    } catch (e) {
      notify({ id: Date.now(), kind: "error", text: (e as Error).message });
    }
  };

  const submit = (text: string) => {
    const cmd = parseCommand(text);
    if (cmd) return void save(cmd.type, cmd.content);
    if (mode !== "ask") return void save(mode, text);
    const intent = guessIntent(text);
    if (intent === "url") {
      setQuestion("");
      return setChip({ kind: "url", text }); // wait for the user to pick Save link or Ask
    }
    setChip(intent === "note" ? { kind: "note", text } : null);
    run(text);
  };

  const tabBtn = (v: "chat" | "inbox", label: string) => (
    <button
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`min-h-10 whitespace-nowrap rounded-full px-4 text-sm font-medium ${view === v ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-200"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-dvh flex-col bg-slate-100 text-slate-900">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">AI Knowledge Inbox</h1>
            <p className="hidden text-xs text-slate-600 sm:block">Save notes and links. Ask questions. Get answers with sources.</p>
          </div>
          <nav aria-label="View" className="flex shrink-0 gap-1 rounded-full bg-slate-100 p-1 min-[900px]:hidden">
            {tabBtn("chat", "Chat")}
            {tabBtn("inbox", "Inbox")}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-4 p-3 min-[900px]:p-4">
        <aside
          className={`${view === "inbox" ? "flex" : "hidden"} min-h-0 w-full flex-col rounded-xl border border-slate-200 bg-slate-50 min-[900px]:flex min-[900px]:w-80 min-[900px]:shrink-0`}
        >
          <ErrorBanner message={error} />
          <ItemList items={items} loading={loading} selectedId={panel?.id ?? null} onOpen={(id, edit) => setPanel({ id, edit })} onDelete={removeItem} onStartNote={startNote} />
        </aside>
        <section
          aria-label="Chat"
          className={`${view === "chat" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 min-[900px]:flex`}
        >
          <div className="bg-white">
            <ChatTabs tabs={chats.tabs} activeId={chats.activeId} disabled={chats.loading} onOpen={(id) => { setNotices([]); setChip(null); chats.open(id); }} onClose={chats.close} />
          </div>
          <ErrorBanner message={chats.error} />
          <ChatThread messages={chats.messages} draft={chats.draft} onSuggest={run} items={items} onOpenItem={(id) => setPanel({ id, edit: false })} onPin={(mid, text) => pinMessage(chats.activeId!, mid, text)} onStartNote={startNote} />
          <ChatNotices
            notices={notices}
            chip={chip}
            saving={saving}
            onView={(id) => setPanel({ id, edit: false })}
            onUndo={undo}
            onDismiss={dismiss}
            onSave={save}
            onAskChip={(t) => { setChip(null); run(t); }}
            onDismissChip={() => setChip(null)}
          />
          <AskBox value={question} onChange={setQuestion} onSubmit={submit} mode={mode} onMode={setMode} loading={chats.loading} saving={saving} />
        </section>
      </main>
      {panel && (
        <ItemPanel key={panel.id} itemId={panel.id} startEditing={panel.edit} onClose={() => setPanel(null)} onEdit={editItem} onDelete={removeItem} />
      )}
    </div>
  );
}
