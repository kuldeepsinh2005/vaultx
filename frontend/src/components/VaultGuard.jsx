// frontend/src/components/VaultGuard.jsx
import { Navigate } from "react-router-dom";
import { useKey } from "../context/KeyContext";

const VaultGuard = ({ children }) => {
  const { privateKey } = useKey();

  if (!privateKey) {
    return <Navigate to="/unlock" replace />;
  }

  return children;
};

export default VaultGuard;
