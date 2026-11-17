import { useCallback, useEffect, useState } from "react";
import * as api from "../api/client";
import type { Item } from "../types";

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listItems());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void refresh(), [refresh]);

  // Throws on failure so the form can show the error and keep the input.
  const addItem = async (type: Item["type"], content: string) => {
    const item = await api.ingest(type, content);
    setItems((prev) => [item, ...prev]);
  };

  const editItem = async (id: string, content: string) => {
    const item = await api.editItem(id, content);
    setItems((prev) => prev.map((i) => (i.id === id ? item : i)));
  };

  const removeItem = async (id: string) => {
    await api.deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return { items, loading, error, refresh, addItem, editItem, removeItem };
}
