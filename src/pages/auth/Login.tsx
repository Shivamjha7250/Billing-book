import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import "./login.css";

import logo from "../../assets/images/jhatech-logo.png";
import googleIcon from "../../assets/icons/google.png";
import whatsappIcon from "../../assets/icons/whatsapp.png";
import emailIcon from "../../assets/icons/email.png";
import upiIcon from "../../assets/icons/upi.png";
import billingMockupImg from "../../assets/images/hero.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Supabase Native Google Login
  const handleGoogleLogin = async () => {
    try {
      setErrorMessage(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to sign in with Google.");
    }
  };

  // 2. Real Supabase Email/Password Login
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      console.log("Logged in successfully:", data.user);
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">

        {/* ================= LEFT BRAND PANEL ================= */}
        <section className="login-brand-panel">
          <div className="brand-content">
            
            {/* Logo Box */}
            <div className="company-logo-box">
              <img
                src={logo}
                alt="JhaTech Solution"
                className="login-company-logo"
              />
            </div>

            {/* Brand Title */}
            <h1 className="brand-title">
              JhaTech <span>Billing</span>
            </h1>

            <h3 className="brand-subtitle">
              Smart Billing &amp; Invoice Management
            </h3>

            <p className="brand-desc">
              Create invoices, manage clients, track payments and grow your business — all in one place.
            </p>

            {/* Middle Section: Features List + 3D Hero Mockup */}
            <div className="brand-middle-area">
              
              <div className="brand-features">
                <div className="brand-feature">
                  <div className="feature-icon icon-purple">📄</div>
                  <div className="feature-text">
                    <h4>Professional Invoices</h4>
                    <p>Create &amp; share in seconds</p>
                  </div>
                </div>

                <div className="brand-feature">
                  <div className="feature-icon">
                    <img src={whatsappIcon} alt="WhatsApp" />
                  </div>
                  <div className="feature-text">
                    <h4>WhatsApp Integration</h4>
                    <p>Send invoices instantly</p>
                  </div>
                </div>

                <div className="brand-feature">
                  <div className="feature-icon">
                    <img src={emailIcon} alt="Email" />
                  </div>
                  <div className="feature-text">
                    <h4>Email Support</h4>
                    <p>Automatic invoice delivery</p>
                  </div>
                </div>

                <div className="brand-feature">
                  <div className="feature-icon">
                    <img src={upiIcon} alt="UPI" />
                  </div>
                  <div className="feature-text">
                    <h4>UPI QR Payments</h4>
                    <p>Accept payments easily</p>
                  </div>
                </div>
              </div>

              {/* 3D Mockup Graphic Box */}
              <div className="brand-mockup-wrap">
                <img
                  src={billingMockupImg}
                  alt="Billing Devices Mockup"
                  className="billing-3d-mockup"
                />
              </div>

            </div>
          </div>

          {/* Stats Bar */}
          <div className="brand-stats">
            <div className="stat-box">
              <span className="stat-icon">👥</span>
              <div>
                <strong>500+</strong>
                <p>Happy Clients</p>
              </div>
            </div>

            <div className="stat-box">
              <span className="stat-icon">📑</span>
              <div>
                <strong>10K+</strong>
                <p>Invoices Generated</p>
              </div>
            </div>

            <div className="stat-box">
              <span className="stat-icon">🛡️</span>
              <div>
                <strong>99.9%</strong>
                <p>Uptime &amp; Security</p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= RIGHT LOGIN PANEL ================= */}
        <section className="login-form-panel">
          
          <div className="security-tag-wrapper">
            <div className="security-badge">
              <span className="badge-icon">🛡️</span>
              <div>
                <strong>Secure &amp; Encrypted</strong>
                <p>Your data is always safe</p>
              </div>
            </div>
          </div>

          <div className="login-form-wrapper">
            <div className="login-heading">
              <h2>Welcome <span>back</span></h2>
              <p>Sign in to manage your billing.</p>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                marginBottom: "16px",
                fontWeight: 500
              }}>
                {errorMessage}
              </div>
            )}

            {/* Google Login Button */}
            <button
              type="button"
              className="google-login-button"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <img src={googleIcon} alt="Google" className="google-icon" />
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="login-divider">
              <span />
              <p>OR</p>
              <span />
            </div>

            {/* Credentials Form */}
            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="email">Email Address</label>
                <div className="input-box">
                  <span className="input-icon">✉️</span>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password">Password</label>
                <div className="input-box">
                  <span className="input-icon">🔒</span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "👁️️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  className="forgot-password"
                  onClick={() => alert("Password reset link will be sent to your registered email.")}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="sign-in-button" disabled={loading}>
                <span>{loading ? "Signing in..." : "Sign In"}</span>
                <span className="arrow">→</span>
              </button>
            </form>

            <div className="secure-login">
              <span>🔒</span>
              <span>Secure company billing workspace</span>
            </div>

            <p className="copyright">
              © 2026 JhaTech Billing. All rights reserved.
            </p>
          </div>

        </section>

      </div>
    </div>
  );
}