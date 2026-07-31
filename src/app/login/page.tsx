"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import DriverRegisterForm from "@/components/auth/DriverRegisterForm";

type Mode = "login" | "register";
type Role = "passenger" | "driver";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/create";

  const [role, setRole] = useState<Role>("passenger");
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  // Fields — controlled + shared across role/mode switches so nothing is wiped.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { phone: phone.trim(), password, role }
          : {
              name: name.trim(),
              phone: phone.trim(),
              password,
              email: email.trim(),
            };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      if (mode === "login" && role === "driver") {
        router.replace(
          data.verificationStatus === "verified" ? "/my-trips" : "/profile",
        );
        return;
      }
      router.replace(redirect);
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    fontSize: 15,
    fontFamily: "inherit",
    color: "#0B1E3D",
    minWidth: 0,
  };

  const fieldStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    height: 52,
    background: "#f8f9fa",
    borderRadius: 12,
    border: "1.5px solid #e8edf0",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const focusField = (el: HTMLDivElement) => {
    el.style.borderColor = "#00C2A8";
    el.style.boxShadow = "0 0 0 3px rgba(0,194,168,0.12)";
  };
  const blurField = (el: HTMLDivElement) => {
    el.style.borderColor = "#e8edf0";
    el.style.boxShadow = "none";
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(140deg, #0B1E3D 0%, #1C3557 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      {/* Back to home */}
      <div style={{ width: "100%", maxWidth: 440, marginBottom: 16 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "rgba(255,255,255,0.6)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to home
        </Link>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#ffffff",
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link
            href="/"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Image
              src="/assets/images/commuterLogo.png"
              alt="Commuter logo"
              width={50}
              height={50}
            />
            <span
              style={{
                fontWeight: 900,
                fontSize: 22,
                color: "#0B1E3D",
                letterSpacing: "-0.03em",
              }}
            >
              Commuter
            </span>
          </Link>
        </div>

        {/* Role switcher */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#eef2f5",
            borderRadius: 12,
            padding: 4,
            marginBottom: 12,
          }}
          role="tablist"
          aria-label="Passenger or driver"
        >
          {(["passenger", "driver"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={role === r}
              onClick={() => {
                setRole(r);
                setMode("login");
                setError("");
              }}
              style={{
                padding: "10px 16px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
                fontFamily: "inherit",
                background: role === r ? "#0B1E3D" : "transparent",
                color: role === r ? "#ffffff" : "#5A6A7A",
                transition: "all 0.2s",
                minHeight: 44,
              }}
            >
              {r === "passenger" ? "Passenger" : "Driver"}
            </button>
          ))}
        </div>

        {/* Mode tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#f8f9fa",
            borderRadius: 12,
            padding: 4,
            marginBottom: 28,
          }}
          role="tablist"
          aria-label="Login or register"
        >
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              style={{
                padding: "10px 16px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
                fontFamily: "inherit",
                background: mode === m ? "#ffffff" : "transparent",
                color: mode === m ? "#0B1E3D" : "#5A6A7A",
                boxShadow: mode === m ? "0 1px 6px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.2s",
                minHeight: 44,
              }}
            >
              {m === "login" ? "Log in" : "Register"}
            </button>
          ))}
        </div>

        {role === "driver" && mode === "register" ? (
          <DriverRegisterForm
            name={name}
            setName={setName}
            phone={phone}
            setPhone={setPhone}
            password={password}
            setPassword={setPassword}
            email={email}
            setEmail={setEmail}
            gender={gender}
            setGender={setGender}
            onSuccess={() => router.replace("/profile")}
          />
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Name (register only) */}
              {mode === "register" && (
                <div>
                  <label
                    htmlFor="name"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0B1E3D",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Full name{" "}
                    <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                      *
                    </span>
                  </label>
                  <div
                    style={fieldStyle}
                    onFocusCapture={(e) =>
                      focusField(e.currentTarget as HTMLDivElement)
                    }
                    onBlurCapture={(e) =>
                      blurField(e.currentTarget as HTMLDivElement)
                    }
                  >
                    <User
                      size={17}
                      style={{ color: "#5A6A7A", flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <input
                      id="name"
                      type="text"
                      autoComplete="name" 
                      placeholder="Mohamed Ahmed"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {/* Phone (primary) */}
              <div>
                <label
                  htmlFor="phone"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0B1E3D",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Phone{" "}
                  <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                    *
                  </span>
                </label>
                <div
                  style={{ ...fieldStyle, padding: 0, overflow: "hidden" }}
                  onFocusCapture={(e) =>
                    focusField(e.currentTarget as HTMLDivElement)
                  }
                  onBlurCapture={(e) =>
                    blurField(e.currentTarget as HTMLDivElement)
                  }
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      height: "100%",
                      padding: "0 12px",
                      background: "#eef1f3",
                      borderRight: "1.5px solid #e8edf0",
                      fontWeight: 600,
                      color: "#0B1E3D",
                      flexShrink: 0,
                    }}
                  >
                    <Phone
                      size={17}
                      style={{ color: "#5A6A7A" }}
                      aria-hidden="true"
                    />
                    +20
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="1XXXXXXXXX"
                    required
                    maxLength={10}
                    value={phone.replace(/^\+?20/, "")}
                    onChange={(e) => {
                      const digits = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                      setPhone(digits ? `+20${digits}` : "");
                    }}
                    style={{ ...inputStyle, padding: "0 14px" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0B1E3D",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Password{" "}
                  <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                    *
                  </span>
                </label>
                <div
                  style={fieldStyle}
                  onFocusCapture={(e) =>
                    focusField(e.currentTarget as HTMLDivElement)
                  }
                  onBlurCapture={(e) =>
                    blurField(e.currentTarget as HTMLDivElement)
                  }
                >
                  <Lock
                    size={17}
                    style={{ color: "#5A6A7A", flexShrink: 0 }}
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "register" ? "Min. 8 characters" : "••••••••"
                    }
                    required
                    minLength={mode === "register" ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#5A6A7A",
                      padding: 4,
                      flexShrink: 0,
                      minWidth: 32,
                      minHeight: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === "register" && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#5A6A7A",
                      marginTop: 5,
                      marginBottom: 0,
                    }}
                  >
                    Must be at least 8 characters.
                  </p>
                )}
              </div>

              {/* Email (register only, optional, last) */}
              {mode === "register" && (
                <div>
                  <label
                    htmlFor="email"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0B1E3D",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Email address{" "}
                    <span style={{ fontWeight: 400, color: "#5A6A7A" }}>
                      (optional)
                    </span>
                  </label>
                  <div
                    style={fieldStyle}
                    onFocusCapture={(e) =>
                      focusField(e.currentTarget as HTMLDivElement)
                    }
                    onBlurCapture={(e) =>
                      blurField(e.currentTarget as HTMLDivElement)
                    }
                  >
                    <Mail
                      size={17}
                      style={{ color: "#5A6A7A", flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <p
                role="alert"
                aria-live="assertive"
                style={{
                  fontSize: 13,
                  color: "#e74c3c",
                  background: "rgba(231,76,60,0.07)",
                  border: "1px solid rgba(231,76,60,0.2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginTop: 14,
                  marginBottom: 0,
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 20,
                width: "100%",
                height: 52,
                background: loading ? "#5A6A7A" : "#0B1E3D",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 15,
                border: "none",
                borderRadius: 12,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "inherit",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = "#00C2A8";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.background = "#0B1E3D";
              }}
            >
              {loading && (
                <Loader2 size={18} className="spin" aria-hidden="true" />
              )}
              {loading
                ? "Please wait…"
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>
        )}

        {/* Switch mode */}
        <p
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "#5A6A7A",
            marginTop: 20,
            marginBottom: 0,
          }}
        >
          {mode === "login"
            ? "Don't have an account? "
            : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#00C2A8",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "inherit",
              padding: 0,
            }}
          >
            {mode === "login" ? "Register" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
