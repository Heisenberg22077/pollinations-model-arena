import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { MotionProvider } from "./components/MotionProvider";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element.");
createRoot(root).render(
  <StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </StrictMode>,
);
