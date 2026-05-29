import React from "react";
import ReactDOM from "react-dom/client";
import Root from "./Root";
import "./index.css";
import "./auth"; // activa los interceptors de axios

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
