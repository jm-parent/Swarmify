import { useEffect } from "react";
import { Panel } from "@xyflow/react";
import { create } from "zustand";

const NOTICE_DURATION_MS = 4000;

interface ImportNoticeState {
  messages: string[];
  show: (messages: string[]) => void;
  hide: () => void;
}

// Une nouvelle liste remplace la précédente et relance le délai d'affichage.
export const useImportNotice = create<ImportNoticeState>()((set) => ({
  messages: [],
  show: (messages) => set({ messages }),
  hide: () => set({ messages: [] }),
}));

export function ImportNotice() {
  const messages = useImportNotice((s) => s.messages);
  const hide = useImportNotice((s) => s.hide);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(hide, NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [messages, hide]);

  return (
    <Panel position="top-center">
      <div role="status" aria-live="polite" className={messages.length > 0 ? "import-notice" : undefined}>
        {messages.map((message, index) => (
          <p key={index}>{message}</p>
        ))}
      </div>
    </Panel>
  );
}
