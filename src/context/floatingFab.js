import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const FloatingFabContext = createContext({
  setWhatsAppFabHidden: () => {},
  whatsAppFabHidden: false,
});

export const FloatingFabProvider = ({ children }) => {
  const [whatsAppFabHidden, setWhatsAppFabHiddenState] = useState(false);

  const setWhatsAppFabHidden = useCallback((hidden) => {
    setWhatsAppFabHiddenState(!!hidden);
  }, []);

  const value = useMemo(
    () => ({
      setWhatsAppFabHidden,
      whatsAppFabHidden,
    }),
    [setWhatsAppFabHidden, whatsAppFabHidden]
  );

  return <FloatingFabContext.Provider value={value}>{children}</FloatingFabContext.Provider>;
};

export const useFloatingFab = () => useContext(FloatingFabContext);
