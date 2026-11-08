import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { preloadSamples } from "./audio";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Fetch the guitar recordings in the background once the page has settled (~2 MB, cached by the browser).
setTimeout(preloadSamples, 1500);
