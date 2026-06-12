import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css"; // <-- This imports your entire master design sheet!

createRoot(document.getElementById("root")!).render(<App />);