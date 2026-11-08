import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { preloadSamples } from "./audio";
import "./app.css";
import "./desktop.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Fetch and decode the guitar recordings straight away (~2 MB, cached by the browser), so the first tap
// already sounds like a guitar.
void preloadSamples();
