/// <reference types="vite/client" />

import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "polli-connect": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        "app-key"?: string;
        budget?: string;
        expiry?: string;
        models?: string;
        permissions?: string;
        "hide-buy-pollen"?: string;
        "menu-links"?: string;
        ref?: React.Ref<HTMLElement & { apiKey?: string | null }>;
        apiKey?: string | null;
      };
    }
  }
}
