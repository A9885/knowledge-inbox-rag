import { useState } from "react";
import { useChats } from "./hooks/useChats";
import { useItems } from "./hooks/useItems";
import { ChatTabs } from "./components/ChatTabs";
import { ChatThread } from "./components/ChatThread";
import { AskBox } from "./components/AskBox";
import { ErrorBanner } from "./components/ErrorBanner";
import { IngestForm } from "./components/IngestForm";
import { ItemPanel } from "./components/ItemPanel";
import { ItemList } from "./components/ItemList";

export default function App() {
  const { items, loading, error, addItem, editItem, removeItem } = useItems();
  const [panel, setPanel] = useState<{ id: string; edit: boolean } | null>(null);
  const chats = useChats();
  const [question, setQuestion] = useState("");
  const run = (q: string) => {
    if (chats.loading) return; // suggestion chips stay visible while an answer streams
    setQuestion("");
    void chats.ask(q);
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
          <ChatTabs tabs={chats.tabs} activeId={chats.activeId} disabled={chats.loading} onOpen={chats.open} onClose={chats.close} />
          <ErrorBanner message={chats.error} />
          <ChatThread messages={chats.messages} draft={chats.draft} onSuggest={run} items={items} onOpenItem={(id) => setPanel({ id, edit: false })} />
          <AskBox value={question} onChange={setQuestion} onAsk={run} loading={chats.loading} />
        </div>
      </main>
      {panel && (
        <ItemPanel key={panel.id} itemId={panel.id} startEditing={panel.edit} onClose={() => setPanel(null)} onEdit={editItem} onDelete={removeItem} />
      )}
    </div>
  );
}
