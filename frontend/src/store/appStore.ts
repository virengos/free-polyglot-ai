import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AppState {
  currentUserId: number;
  user: User | null;
  /** Language code locked for the current training session (e.g. "en", "fr").
   *  null means no session is active – user must pick a language first.
   *  This value is intentionally NOT persisted so it resets on page refresh. */
  sessionLanguage: string | null;
  setUser: (user: User) => void;
  setCurrentUserId: (id: number) => void;
  setSessionLanguage: (lang: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUserId: 1,
      user: null,
      sessionLanguage: null,
      setUser: (user) => set({ user, currentUserId: user.id }),
      setCurrentUserId: (id) => set({ currentUserId: id }),
      setSessionLanguage: (lang) => set({ sessionLanguage: lang }),
    }),
    {
      name: "polyglot-store",
      // sessionLanguage is ephemeral – exclude it from localStorage persistence
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        user: state.user,
      }),
    }
  )
);
