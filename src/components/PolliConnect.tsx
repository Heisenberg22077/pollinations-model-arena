import { useEffect, useRef } from "react";
import { APP_KEY, CONNECT_BUDGET, CONNECT_EXPIRY, REPO_URL } from "../config";

type ConnectElement = HTMLElement & { apiKey?: string | null };

export function PolliConnect({ onKey }: { onKey: (key: string | null) => void }) {
  const ref = useRef<ConnectElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let active = true;
    const handler = () => {
      if (active && el.apiKey !== undefined) onKey(el.apiKey);
    };
    el.addEventListener("change", handler);
    if (customElements.get("polli-connect")) handler();
    else
      void customElements
        .whenDefined("polli-connect")
        .then(handler)
        .catch(() => {
          // Keep the stored connection until the official element has upgraded.
        });
    return () => {
      active = false;
      el.removeEventListener("change", handler);
    };
  }, [onKey]);

  const menuLinks = JSON.stringify([{ label: "Source on GitHub", href: REPO_URL, icon: "app" }]);

  return (
    <polli-connect
      ref={ref}
      app-key={APP_KEY}
      budget={CONNECT_BUDGET}
      expiry={CONNECT_EXPIRY}
      models="text,image"
      menu-links={menuLinks}
    />
  );
}
