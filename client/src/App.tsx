import { useState } from "react";
import { useChats } from "./hooks/useChats";
import { useItems } from "./hooks/useItems";
import { ChatTabs } from "./components/ChatTabs";
import { ChatThread } from "./components/ChatThread";
import { AskBox, type Mode } from "./components/AskBox";
import { ChatNotices, type Chip, type Notice } from "./components/ChatNotices";
import { guessIntent, parseCommand } from "./lib/intent";
import { ErrorBanner } from "./components/ErrorBanner";
import { IngestForm } from "./components/IngestForm";
import { ItemPanel } from "./components/ItemPanel";
import { ItemList } from "./components/ItemList";

export default function App() {
  const { items, loading, error, addItem, pinMessage, editItem, removeItem } = useItems();
  const [panel, setPanel] = useState<{ id: string; edit: boolean } | null>(null);
  const chats = useChats();
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<Mode>("ask");
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-3 text-lg font-bold">AI Knowledge Inbox</header>
      <main className="mx-auto grid max-w-5xl gap-8 p-6 md:grid-cols-2">
        <div className="space-y-6">
          <IngestForm onSave={addItem} />
          <ErrorBanner message={error} />
          <ItemList items={items} loading={loading} onOpen={(id, edit) => setPanel({ id, edit })} onDelete={removeItem} />
        </div>
        <div className="space-y-2">
          <ChatTabs tabs={chats.tabs} activeId={chats.activeId} disabled={chats.loading} onOpen={(id) => { setNotices([]); setChip(null); chats.open(id); }} onClose={chats.close} />
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
        </div>
      </main>
      {panel && (
        <ItemPanel key={panel.id} itemId={panel.id} startEditing={panel.edit} onClose={() => setPanel(null)} onEdit={editItem} onDelete={removeItem} />
      )}
    </div>
  );
}
