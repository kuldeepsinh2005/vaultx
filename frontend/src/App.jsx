// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { KeyProvider } from "./context/KeyContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import MyFiles from "./pages/MyFiles";
// import TestKeyRestore from "./pages/TestKeyRestore";
import AccountSettings from "./pages/AccountSettings";
import UnlockVault from "./pages/UnlockVault";
import Trash from "./pages/Trash";
import Billing from "./pages/Billing";

import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import VaultGuard from "./components/VaultGuard";



function App() {
  return (
    <BrowserRouter>
      <KeyProvider>
        <AuthProvider>
            <Routes>
              {/* 🏠 Root Address Handling */}
              {/* Redirects "/" to "/dashboard". ProtectedRoute will handle the auth check. */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* 🚫 Public pages */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />

              {/* 🔐 Private pages */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/files"
                element={
                  <ProtectedRoute>
                    <MyFiles />
                  </ProtectedRoute>
                }
              />

              {/* <Route 
                path="/test-restore" 
                element={
                  <ProtectedRoute>
                      <TestKeyRestore />
                  </ProtectedRoute>
                } 
              /> */}
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <AccountSettings />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/my-files"
                element={
                  <ProtectedRoute>
                    <VaultGuard>
                      <MyFiles />
                    </VaultGuard>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/unlock"
                element={
                  <ProtectedRoute>
                    <UnlockVault />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/trash" 
                element={
                  <ProtectedRoute>
                    <Trash />
                  </ProtectedRoute>
                } 
              />

              <Route
                path="/billing"
                element={
                  <ProtectedRoute>
                    <Billing />
                  </ProtectedRoute>
                }
              />


              {/* 🛸 Catch-all Route */}
              {/* If the URL doesn't match anything, send them to dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
              
            </Routes>
          
        </AuthProvider>
      </KeyProvider>
    </BrowserRouter>
  );
}

export default App;