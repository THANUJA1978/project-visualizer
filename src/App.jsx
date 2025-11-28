


import { useState } from "react";
import Auth from "./components/Auth";
import Home from "./pages/Home";

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = localStorage.getItem("currentUser");
    return stored ? JSON.parse(stored) : null;
  });

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem("currentUser", JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
  };

  return (
    <div className="app-root">
      <div className="app-card">
        <header className="app-header">
          <h1 className="app-title">Project Management Visualizer</h1>
          <p className="app-subtitle">
          </p>
        </header>

        <main className="app-main">
          {!currentUser ? (
            <Auth onLogin={handleLogin} />
          ) : (
            <Home currentUser={currentUser} onLogout={handleLogout} />
          )}
        </main>
      </div>
    </div>
  );
}
