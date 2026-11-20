
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  LockKeyhole
} from "lucide-react";

import { verifyMagicLink } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function MagicLinkVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { loginWithMagicLink } = useAuth();

  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");

  const verificationStarted = useRef(false);

  useEffect(() => {
    if (verificationStarted.current) return;

    verificationStarted.current = true;

    const verifyToken = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("invalid");
        return;
      }

      try {
        const response = await verifyMagicLink(token);

        loginWithMagicLink(response);

        setStatus("success");

        // Remove the token from the browser URL.
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );

        navigate("/client/dashboard", { replace: true });

      } catch (error) {
        console.error("Magic link verification failed:", error);

        setMessage(
          "This login link has expired or already been used."
        );

        setStatus("invalid");
      }
    };

    verifyToken();
  }, [searchParams, loginWithMagicLink, navigate]);

  return (
    <main className="magic-result-page">
      <motion.div
        className="magic-result-card"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >

        <div className="magic-result-logo">
          <ShieldCheck size={27} />
          <span>ClientLocker</span>
        </div>

        {status === "verifying" && (
          <div className="magic-result-content">
            <div className="magic-result-spinner"></div>

            <h2>Verifying your login link</h2>

            <p>
              Please wait while we securely verify your account.
            </p>
          </div>
        )}

        {status === "invalid" && (
          <div className="magic-result-content">

            <div className="magic-result-error-icon">
              <AlertCircle size={34} />
            </div>

            <h2>Login link unavailable</h2>

            <p className="magic-result-error-message">
              {message ||
                "This login link has expired or already been used."}
            </p>

            <p>
              Don't worry! Your ClientLocker account is still available.
              You can sign in using the Google account registered
              with your ClientLocker account.
            </p>

            <button
              type="button"
              className="magic-result-login-button"
              onClick={() => navigate("/login")}
            >
              Go to Login with Google
              <ArrowRight size={18} />
            </button>

            <div className="magic-result-note">
              <LockKeyhole size={15} />
              <span>
                Use the Google account registered with ClientLocker.
              </span>
            </div>

          </div>
        )}

      </motion.div>

      <p className="magic-result-footer">
        © {new Date().getFullYear()} ClientLocker. Secure client access.
      </p>
    </main>
  );
}

export default MagicLinkVerify;
