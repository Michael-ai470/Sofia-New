import React from "react";
import ReactDOM from "react-dom/client";
import SofiaApp from "./SofiaApp.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SofiaApp backendUrl="http://localhost:5000" />
  </React.StrictMode>
);