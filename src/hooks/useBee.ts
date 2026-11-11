import { useEffect, useState } from "react";
import { setBeeEnabled } from "../lib/arena-motion";
import { useSound } from "../lib/sound";

const BEE_STORAGE = "model-table:bee";

function readPref(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // The toggle still works when browser storage is unavailable.
  }
}

export function useBee() {
  const [beeEnabled, setBee] = useState(() => readPref(BEE_STORAGE, true));
  const { soundOn, toggleSound } = useSound();

  useEffect(() => {
    setBeeEnabled(beeEnabled);
    writePref(BEE_STORAGE, beeEnabled);
  }, [beeEnabled]);

  return {
    beeEnabled,
    soundOn,
    toggleBee: () => setBee((value) => !value),
    toggleSound,
  };
}
