import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log('main.tsx: Starting React app');
const rootElement = document.getElementById("root");
console.log('main.tsx: Root element found:', !!rootElement);

if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  console.error('main.tsx: Root element not found!');
}
