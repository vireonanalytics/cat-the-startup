"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MascotPose } from "@/components/mascot";

export interface MascotActivityEntry {
  id: number;
  pose: MascotPose;
  message: string;
  /** When this activity started (Date.now()) - lets the single companion
   * cat (see MascotCompanion) work out how long the current activity has
   * been running and switch to an apologetic pose + "cute cats meanwhile"
   * fallback if it's taking a while, without every feature that calls
   * pushActivity needing its own long-wait timer. */
  startedAt: number;
}

interface MascotContextValue {
  /** Every activity currently in flight, oldest first. The companion only
   * ever shows the most recent one (see MascotCompanion) - if two things
   * happen at once, the newest wins until it finishes, then the previous
   * one reappears. */
  activities: MascotActivityEntry[];
  /**
   * Announces that some async work is happening and a cat should act it
   * out. Returns a cleanup function - call it when the work finishes
   * (success or error) to remove that cat once its job is done.
   */
  pushActivity: (pose: MascotPose, message: string) => () => void;
  /**
   * Set by AnalystCatChat (see analyst-cat-chat.tsx) while it's mounted -
   * only true on a startup page. The companion (mascot-companion.tsx) reads
   * this to know whether it's currently living on a startup page at all:
   * when set, clicking the cat opens the AI chat instead of the shy easter
   * egg, and the idle caption invites petting for answers instead of
   * showing flavor quips. There is only ever one startup page mounted at a
   * time, so a single slot (not a stack) is enough.
   */
  analystChatHandler: (() => void) | null;
  setAnalystChatHandler: (handler: (() => void) | null) => void;
  /**
   * Also set by AnalystCatChat, tracking whether its panel is currently
   * open. The companion uses this to hide the "pet me for answers" caption
   * while the chat is open - once the analyst has actually opened it, the
   * chat panel appearing right below is the real estate that caption text
   * was pointing at, so leaving both up at once just repeats the same
   * invitation the analyst already acted on.
   */
  isAnalystChatOpen: boolean;
  setIsAnalystChatOpen: (open: boolean) => void;
}

const MascotContext = createContext<MascotContextValue | null>(null);

let nextId = 0;

export function MascotProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<MascotActivityEntry[]>([]);
  const [activities, setActivities] = useState<MascotActivityEntry[]>([]);
  const [analystChatHandler, setAnalystChatHandler] = useState<
    (() => void) | null
  >(null);
  const [isAnalystChatOpen, setIsAnalystChatOpen] = useState(false);

  const pushActivity = useCallback((pose: MascotPose, message: string) => {
    const id = nextId++;
    stackRef.current = [
      ...stackRef.current,
      { id, pose, message, startedAt: Date.now() },
    ];
    setActivities(stackRef.current);

    return () => {
      stackRef.current = stackRef.current.filter((entry) => entry.id !== id);
      setActivities(stackRef.current);
    };
  }, []);

  return (
    <MascotContext.Provider
      value={{
        activities,
        pushActivity,
        analystChatHandler,
        setAnalystChatHandler,
        isAnalystChatOpen,
        setIsAnalystChatOpen,
      }}
    >
      {children}
    </MascotContext.Provider>
  );
}

export function useMascot() {
  const ctx = useContext(MascotContext);
  if (!ctx) {
    throw new Error("useMascot must be used within a MascotProvider");
  }
  return ctx;
}
