// frontend/src/context/AuthContext.jsx
// import React, { createContext, useState, useEffect, useContext } from "react";
// import axios from "axios";

// // Axios instance with credentials
// const api = axios.create({
//   baseURL: import.meta.env.VITE_API_URL,
//   withCredentials: true,
// });

// const AuthContext = createContext(null);

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [loading, setLoading] = useState(true);

//   // --- Axios interceptor for automatic refresh ---
//   useEffect(() => {
//   const interceptor = api.interceptors.response.use(
//     (response) => response,
//     async (error) => {
//       const originalRequest = error.config;

//       // Only try refresh once
//       if (error.response?.status === 401 && !originalRequest._retry) {
//         // Check if refreshToken cookie exists
//         const hasRefreshToken = document.cookie
//           .split("; ")
//           .some((c) => c.startsWith("refreshToken="));

//         if (!hasRefreshToken) {
//           console.log("No refresh token, skipping refresh attempt.");
//           return Promise.reject(error); // exit early
//         }

//         originalRequest._retry = true;

//         try {
//           await api.post("/auth/refresh");
//           return api(originalRequest); // retry original request
//         } catch (err) {
//           console.log("Refresh token invalid or missing, logging out.");
//           logout(); // log out user
//           return Promise.reject(err);
//         }
//       }

//       return Promise.reject(error);
//     }
//   );

//   return () => api.interceptors.response.eject(interceptor);
// }, []);


//   // --- Check user session on app mount ---
//   useEffect(() => {
//     const checkUserSession = async () => {
//       try {
//         const res = await api.get("/auth/me");
//         if (res.data?.user) {
//           setUser(res.data.user);
//           setIsAuthenticated(true);
//         } else {
//           setUser(null);
//           setIsAuthenticated(false);
//         }
//       } catch (err) {
//         console.error("Session check failed:", err);
//         setUser(null);
//         setIsAuthenticated(false);
//       } finally {
//         setLoading(false);
//       }
//     };
//     checkUserSession();
//   }, []);

//   // --- Login ---
//   const login = async (email, password) => {
//     try {
//       const res = await api.post("/auth/login", { email, password });
//       if (res.data.success) {
//         setUser(res.data.user);
//         setIsAuthenticated(true);
//         return true;
//       }
//       return false;
//     } catch (err) {
//       console.error("Login failed:", err);
//       return false;
//     }
//   };

//   // --- Register ---
//   const register = async (username, email, password) => {
//     try {
//       const res = await api.post("/auth/register", {
//         username,
//         email,
//         password,
//       });
//       if (res.data.success) {
//         return await login(email, password); // auto-login after registration
//       }
//       return false;
//     } catch (err) {
//       console.error("Registration failed:", err);
//       return false;
//     }
//   };

//   // --- Logout ---
//   const logout = async () => {
//     try {
//       await api.post("/auth/logout");
//     } catch (err) {
//       console.error("Logout failed:", err);
//     } finally {
//       setUser(null);
//       setIsAuthenticated(false);
//     }
//   };

//   return (
//     <AuthContext.Provider
//       value={{ user, isAuthenticated, loading, login, register, logout }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => useContext(AuthContext);



import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // Important for cookies
});

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // --- Axios response interceptor for automatic refresh ---
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Only try refresh once
        if (error.response?.status === 401 && !originalRequest._retry) {
          const hasRefreshToken = document.cookie
            .split("; ")
            .some((c) => c.startsWith("refreshToken="));

          if (!hasRefreshToken) return Promise.reject(error);

          originalRequest._retry = true;

          try {
            const res = await api.post("/auth/refresh");
            if (res.data?.user) {
              setUser(res.data.user);
              setIsAuthenticated(true);
            }
            return api(originalRequest); // retry original request
          } catch (err) {
            logout(); // clear state
            return Promise.reject(err);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => api.interceptors.response.eject(interceptor);
  }, []);

  // --- Check user session on mount ---
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const res = await api.get("/auth/me");
        if (res.data?.user) {
          setUser(res.data.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch {
        // Try refresh token if access token expired
        try {
          const res = await api.post("/auth/refresh");
          if (res.data?.user) {
            setUser(res.data.user);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        setLoading(false);
      }
    };

    checkUserSession();
  }, []);

  // --- Login ---
  const login = async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      if (res.data.success && res.data.user) {
        setUser(res.data.user);
        setIsAuthenticated(true);
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

      // 1. Success path
      if (res.data.success) {
        console.log("Success:", res.data.message);
        // If you need verification, you'd usually redirect here 
        // instead of logging in immediately.
        return await login(email, password); 
      }

      // 2. Fallback if success is false but no error was thrown
      console.log("Response failed:", res.data.message);
      return false;

    } catch (error) {
      // 3. Error path (e.g., 400 Bad Request, 500 Server Error)
      // Axios attaches the server response to error.response
      const errorMessage = error.response?.data?.message || "Registration failed";
      
      console.log("Error:", errorMessage);
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
      setUser(null);
      setIsAuthenticated(false);
      navigate("/login"); // redirect to login page
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
        api, // expose Axios instance for other requests
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
