// frontend/src/context/AuthContext.jsx

import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { decryptPrivateKey } from "../utils/privateKeyBackup";
import { useKey } from "./KeyContext";

// 1. Create Axios instance globally
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true, 
});

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const { setPrivateKey, lock } = useKey();
  const navigate = useNavigate();

  const unlockVaultWithPassword = async (encryptedPrivateKey, password) => {
    if (!encryptedPrivateKey) return;
    const privateKey = await decryptPrivateKey(encryptedPrivateKey, password);
    setPrivateKey(privateKey);
  };

  // 2. ONLY ONE Interceptor, placed here so it can use setUser and logout()
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          
          // ✅ FIX 1: Add the recovery routes to the Ignore List!
          if (
            originalRequest.url.includes('/auth/refresh') || 
            originalRequest.url.includes('/auth/login') ||
            originalRequest.url.includes('/auth/logout') ||
            originalRequest.url.includes('/auth/recovery-key') || // ADDED
            originalRequest.url.includes('/auth/reset-password')  // ADDED
          ) {
             return Promise.reject(error);
          }

          originalRequest._retry = true;

          try {
            const res = await api.post("/auth/refresh"); 
            if (res.data?.user) {
              setUser(res.data.user);
              setIsAuthenticated(true);
            }
            return api(originalRequest); 
          } catch (err) {
            setUser(null);
            setIsAuthenticated(false);
            
            // Allow all public routes to bypass the forced redirect
            if (
              window.location.pathname !== "/login" && 
              window.location.pathname !== "/register" &&
              window.location.pathname !== "/forgot-password"
            ) {
              window.location.href = "/login"; 
            }
            
            // ✅ FIX 2: Return the ORIGINAL 'error', not the refresh 'err'!
            return Promise.reject(error); 
          }
        }
        return Promise.reject(error);
      }
    );

    return () => api.interceptors.response.eject(interceptor);
  }, []);
  // 3. Check user session on mount
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const res = await api.get("/auth/me");
        if (res.data?.user) {
          setUser(res.data.user);
          setIsAuthenticated(true);
        }
      } catch {
        // We do NOT need a manual refresh fallback here anymore, 
        // because the interceptor above will catch the 401 from '/auth/me' 
        // and automatically handle the refresh process for us!
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserSession();
  }, []);

  // --- Login ---
  const login = async (email, password, autoUnlock = false) => {
    try {
      const res = await api.post("/auth/login", { email, password });

      if (res.data.success && res.data.user) {
        setUser(res.data.user);
        setIsAuthenticated(true);

        if (autoUnlock) {
          await unlockVaultWithPassword(
            res.data.user.encryptedPrivateKey,
            password
          );
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // --- Register ---
  const register = async (username, email, password) => {
    try {
      const res = await api.post("/auth/register", { username, email, password });
      if (res.data.success) {
        return await login(email, password); 
      }
      return false;
    } catch (error) {
      console.log("Error:", error.response?.data?.message || "Registration failed");
      return false;
    }
  };

  // --- Logout ---
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    } finally {
      lock();   
      setUser(null);
      setIsAuthenticated(false);
      navigate("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
        api, 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);