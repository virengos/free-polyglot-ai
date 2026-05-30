import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AppState {
  currentUserId: number;
  user: User | null;
  setUser: (user: User) => void;
  setCurrentUserId: (id: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUserId: 1,
      user: null,
      setUser: (user) => set({ user, currentUserId: user.id }),
      setCurrentUserId: (id) => set({ currentUserId: id }),
    }),
    { name: "polyglot-store" }
  )
);
