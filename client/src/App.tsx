import { useState } from "react";
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
  const run = (q: string) => {
    if (chats.loading) return; // suggestion chips stay visible while an answer streams
    setQuestion("");
    void chats.ask(q);
  };

  // Only explicit actions save: a mode, a /command, or a click on a chip. Uses the normal ingest endpoint.
  const save = async (type: "note" | "url", content: string) => {
    setChip(null);
    setQuestion("");
    setMode("ask");
    try {
      const item = await addItem(type, content);
      setNotices((n) => [...n, { id: Date.now(), kind: "saved", item }]);
    } catch (e) {
      setNotices((n) => [...n, { id: Date.now(), kind: "error", text: (e as Error).message }]);
    }
  };
  const undo = async (n: Extract<Notice, { kind: "saved" }>) => {
    try {
      await removeItem(n.item.id);
      setNotices((all) => all.map((x) => (x === n ? { ...n, undone: true } : x)));
    } catch (e) {
      setNotices((all) => [...all, { id: Date.now(), kind: "error", text: (e as Error).message }]);
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
      className={`min-h-10 rounded-full px-4 text-sm font-medium ${view === v ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-dvh flex-col bg-slate-100 text-slate-900">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div>
          <h1 className="text-lg font-bold leading-tight">AI Knowledge Inbox</h1>
          <p className="text-xs text-slate-600">Save notes and links. Ask questions. Get answers with sources.</p>
        </div>
        <nav aria-label="View" className="flex gap-1 rounded-full bg-slate-100 p-1 lg:hidden">
          {tabBtn("chat", "Chat")}
          {tabBtn("inbox", `Inbox (${items.length})`)}
        </nav>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-4 p-3 lg:p-4">
        <aside
          className={`${view === "inbox" ? "flex" : "hidden"} min-h-0 w-full flex-col rounded-2xl border border-slate-200 bg-slate-50 lg:flex lg:w-80 lg:shrink-0`}
        >
          <ErrorBanner message={error} />
          <ItemList items={items} loading={loading} onOpen={(id, edit) => setPanel({ id, edit })} onDelete={removeItem} />
        </aside>
        <section
          aria-label="Chat"
          className={`${view === "chat" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 lg:flex`}
        >
          <div className="bg-white">
            <ChatTabs tabs={chats.tabs} activeId={chats.activeId} disabled={chats.loading} onOpen={(id) => { setNotices([]); setChip(null); chats.open(id); }} onClose={chats.close} />
          </div>
          <ErrorBanner message={chats.error} />
          <ChatThread messages={chats.messages} draft={chats.draft} onSuggest={run} items={items} onOpenItem={(id) => setPanel({ id, edit: false })} onPin={(mid, text) => pinMessage(chats.activeId!, mid, text)} />
          <ChatNotices
            notices={notices}
            chip={chip}
            onView={(id) => setPanel({ id, edit: false })}
            onUndo={undo}
            onSave={save}
            onAskChip={(t) => { setChip(null); run(t); }}
            onDismissChip={() => setChip(null)}
          />
          <AskBox value={question} onChange={setQuestion} onSubmit={submit} mode={mode} onMode={setMode} loading={chats.loading} />
        </section>
      </main>
      {panel && (
        <ItemPanel key={panel.id} itemId={panel.id} startEditing={panel.edit} onClose={() => setPanel(null)} onEdit={editItem} onDelete={removeItem} />
      )}
    </div>
  );
}
