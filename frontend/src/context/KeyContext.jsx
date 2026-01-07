// frontend/src/context/KeyContext.jsx
import { createContext, useContext, useState } from "react";

const KeyContext = createContext(null);

export const KeyProvider = ({ children }) => {
  const [privateKey, setPrivateKey] = useState(null);

  const lock = () => setPrivateKey(null);

  return (
    <KeyContext.Provider
      value={{ privateKey, setPrivateKey, lock }}
    >
      {children}
    </KeyContext.Provider>
  );
};

export const useKey = () => useContext(KeyContext);
