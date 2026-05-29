import { useState } from "react";
import { isLoggedIn, clearToken } from "./auth";
import LoginPage from "./LoginPage";
import App from "./App";

export default function Root() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return <App onLogout={() => { clearToken(); setLoggedIn(false); }} />;
}
