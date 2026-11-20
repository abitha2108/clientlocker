
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ShieldCheck, ArrowRight, CheckCircle } from "lucide-react";

import { requestMagicLink } from "../../services/api";
import "./ClientMagicLogin.css";

function ClientMagicLogin() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);

      const response = await requestMagicLink(normalizedEmail);

      setMessage(
        response.message ||
        "If an active client account exists, a login link will be sent."
      );

      setSent(true);
    } catch (err) {
      setError(
        err.message || "Unable to send login link. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="magic-login-page">
      <motion.section
        className="magic-login-card"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >

        <div className="magic-login-logo">
          <ShieldCheck size={34} />
          <h1>ClientLocker</h1>
        </div>

        {!sent ? (
          <>
            <div className="magic-login-heading">
              <h2>Client Login</h2>
              <p>
                Enter your registered email address.
                We'll send you a secure login link.
              </p>
            </div>

            <form onSubmit={handleSubmit}>

              <label htmlFor="magic-email">
                Email address
              </label>

              <div className="magic-input-wrapper">
                <Mail size={19} />

                <input
                  id="magic-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <p className="magic-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="magic-submit-button"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Login Link"}
                {!loading && <ArrowRight size={18} />}
              </button>

            </form>
          </>
        ) : (
          <div className="magic-success">
            <CheckCircle size={52} />

            <h2>Check your email</h2>

            <p>{message}</p>

            <p className="magic-email-display">
              {email}
            </p>

            <button
              type="button"
              className="magic-resend-button"
              onClick={() => {
                setSent(false);
                setMessage("");
                setError("");
              }}
            >
              Try another email
            </button>
          </div>
        )}

        <div className="magic-login-footer">
          <p>Secure passwordless authentication</p>
          <Link to="/login">Back to regular login</Link>
        </div>

      </motion.section>
    </main>
  );
}

export default ClientMagicLogin;
