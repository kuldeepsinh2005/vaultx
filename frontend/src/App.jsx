// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { KeyProvider } from "./context/KeyContext";
import { TransferProvider } from "./context/TransferContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import MyFiles from "./pages/MyFiles";
import TransferWidget from "./components/TransferWidget"; // ✅ Already imported
import AccountSettings from "./pages/AccountSettings";
import UnlockVault from "./pages/UnlockVault";
import Trash from "./pages/Trash";
import Billing from "./pages/Billing";
import SharedWithMe from "./pages/SharedWithMe";
import ForgotPassword from "./pages/ForgotPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import VaultGuard from "./components/VaultGuard";

function App() {
  return (
    <BrowserRouter>
      <KeyProvider>
        <AuthProvider>
          <TransferProvider>
            
            {/* The Routes handle which page is visible, 
               but everything inside the Provider stays alive! 
            */}
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />  

              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/files" element={<ProtectedRoute><MyFiles /></ProtectedRoute>} />
              <Route path="/account" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
              
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

              <Route path="/unlock" element={<ProtectedRoute><UnlockVault /></ProtectedRoute>} />
              <Route path="/trash" element={<ProtectedRoute><Trash /></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
              <Route path="/shared" element={<ProtectedRoute><SharedWithMe /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>

            {/* ✅ PASTE HERE: This renders the progress bar in the bottom corner GLOBALLY */}
            <TransferWidget />

          </TransferProvider>
        </AuthProvider>
      </KeyProvider>
    </BrowserRouter>
  );
}

export default App;