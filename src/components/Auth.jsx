import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [role, setRole] = useState("Developer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const resetFields = () => {
    setName("");
    setRole("Developer");
    setEmail("");
    setPassword("");
    setError("");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password) {
      setError("Please fill all fields.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Signup failed");
        return;
      }

      const user = await res.json();
      onLogin(user); // auto-login after signup
      resetFields();
    } catch (err) {
      console.error("Signup error:", err);
      setError("Signup failed");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        return;
      }

      const user = await res.json();
      onLogin(user);
      resetFields();
    } catch (err) {
      console.error("Login error:", err);
      setError("Login failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-toggle">
        <button
          type="button"
          className={mode === "login" ? "auth-tab active" : "auth-tab"}
          onClick={() => setMode("login")}
        >
          Login
        </button>
        <button
          type="button"
          className={mode === "signup" ? "auth-tab active" : "auth-tab"}
          onClick={() => setMode("signup")}
        >
          Sign Up
        </button>
      </div>

      <form
        className="auth-form"
        onSubmit={mode === "login" ? handleLogin : handleSignup}
      >
        {mode === "signup" && (
          <>
            <div className="auth-field">
              <label>Name</label>
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label>Role</label>
              <input
                type="text"
                placeholder="e.g. Developer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="auth-field">
          <label>Email</label>
          <input
            type="email"
            placeholder="employee@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <div className="auth-actions">
          <button type="submit" className="btn-primary">
            {mode === "login" ? "Login" : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
}
