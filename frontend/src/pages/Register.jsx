// frontend/src/pages/Register.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";

const Register = () => {
  const { isAuthenticated, api, login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // Step 1: send code, Step 2: verify code
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    code: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Step 1: Request verification code
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!formData.username || !formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      if (res.data.success) {
        setStep(2);
        setMessage("Verification code sent to your email");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and complete registration
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!formData.code) {
      setError("Please enter the verification code");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/verify-email", {
        email: formData.email,
        code: formData.code,
      });
      if (res.data.success) {
        setMessage("Email verified and registration complete!");
        // Auto-login
        await login(formData.email, formData.password);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <h2>Register</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {step === 1 && (
        <form onSubmit={handleSendCode}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleChange}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send Verification Code"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyCode}>
          <input
            type="text"
            name="code"
            placeholder="Enter Verification Code"
            value={formData.code}
            onChange={handleChange}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify & Complete Registration"}
          </button>
        </form>
      )}
    </div>
  );
};

export default Register;
