// Single master sound preference: one control mutes/unmutes the background music.
import { useSyncExternalStore } from "react";
import { setMusicEnabled } from "./music";

const KEY = "model-table:music";

function read(): boolean {
  try {
    const value = localStorage.getItem(KEY);
    return value === null ? true : value === "true";
  } catch {
    return true;
  }
}

let on = read();
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

export function isSoundOn() {
  return on;
}

export function setSound(next: boolean) {
  if (next === on) return;
  on = next;
  try {
    localStorage.setItem(KEY, String(next));
  } catch {
    // The toggle still works when browser storage is unavailable.
  }
  setMusicEnabled(next);
  emit();
}

export function toggleSound() {
  setSound(!on);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useSound() {
  const soundOn = useSyncExternalStore(subscribe, isSoundOn);
  return { soundOn, toggleSound };
}

setMusicEnabled(on);
