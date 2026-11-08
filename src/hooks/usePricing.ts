import { useEffect, useState } from "react";
import { MODELS_URL } from "../config";
import { EMPTY_CATALOG, type ModelCatalog, parseCatalog } from "../lib/catalog";

// Share one request across StrictMode's development remount.
let catalogPromise: Promise<ModelCatalog> | undefined;
function loadCatalog(): Promise<ModelCatalog> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(MODELS_URL, { signal: controller.signal });
      return response.ok ? parseCatalog(await response.json()) : EMPTY_CATALOG;
    } catch {
      return EMPTY_CATALOG;
    } finally {
      clearTimeout(timer);
    }
  })();
  return catalogPromise;
}

export function usePricing(): ModelCatalog {
  const [catalog, setCatalog] = useState(EMPTY_CATALOG);
  useEffect(() => {
    let active = true;
    void loadCatalog().then((next) => {
      if (active) setCatalog(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return catalog;
}
