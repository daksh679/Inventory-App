"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

const initialForms = {
  signin: {
    email: "",
    password: "",
  },
  signup: {
    name: "",
    email: "",
    password: "",
  },
};

export default function AuthScreen({ initialMode }) {
  const [mode, setMode] = useState(initialMode);
  const [forms, setForms] = useState(initialForms);
  const [feedback, setFeedback] = useState({ error: "", success: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMode(initialMode);
    setFeedback({ error: "", success: "" });
  }, [initialMode]);

  function updateField(formMode, field, value) {
    setForms((current) => ({
      ...current,
      [formMode]: {
        ...current[formMode],
        [field]: value,
      },
    }));
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setFeedback({ error: "", success: "" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setFeedback({ error: "", success: "" });
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const payload = forms.signup;
        const { error } = await authClient.signUp.email({
          name: payload.name,
          email: payload.email,
          password: payload.password,
        });

        if (error) {
          setFeedback({ error: error.message || "Unable to create your account.", success: "" });
          return;
        }

        router.push("/dashboard");
        router.refresh();
        return;
      }

      const payload = forms.signin;
      const { error } = await authClient.signIn.email({
        email: payload.email,
        password: payload.password,
      });

      if (error) {
        setFeedback({ error: error.message || "Unable to sign you in.", success: "" });
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setFeedback({
        error: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        success: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-spotlight">
        <p className="kicker">Closet Daily</p>
        <h1>Private wardrobe access with a sharper interface.</h1>
        <p className="lede">
          Sign in to manage your wardrobe, capture store-style clothing photos, and build your outfit from a protected
          dashboard.
        </p>
        <div className="spotlight-points">
          <article>
            <strong>Personal sessions</strong>
            <p>Email and password authentication is powered by Better Auth.</p>
          </article>
          <article>
            <strong>App-router ready</strong>
            <p>The app now runs on Next.js with server-side route protection.</p>
          </article>
          <article>
            <strong>Phone-first UX</strong>
            <p>Every panel is tuned for quick use on a narrow screen.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="mode-switch">
          <button
            className={`mode-pill${mode === "signin" ? " active" : ""}`}
            onClick={() => switchMode("signin")}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`mode-pill${mode === "signup" ? " active" : ""}`}
            onClick={() => switchMode("signup")}
            type="button"
          >
            Create Account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Name
              <input
                autoComplete="name"
                onChange={(event) => updateField("signup", "name", event.target.value)}
                placeholder="Prerna Sharma"
                required
                type="text"
                value={forms.signup.name}
              />
            </label>
          )}

          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => updateField(mode, "email", event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={forms[mode].email}
            />
          </label>

          <label>
            Password
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              onChange={(event) => updateField(mode, "password", event.target.value)}
              placeholder="Minimum 8 characters"
              required
              type="password"
              value={forms[mode].password}
            />
          </label>

          <button className="button primary wide" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
          </button>

          {feedback.error ? <p className="form-feedback error">{feedback.error}</p> : null}
        </form>

        <p className="tiny-note">
          By continuing, your session is stored with Better Auth on this app’s local SQLite database.
        </p>
        <Link className="text-link" href="/">
          Back to home
        </Link>
      </section>
    </main>
  );
}
