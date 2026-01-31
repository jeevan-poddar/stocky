import { createContext, useContext, useState, type ReactNode } from 'react';

// A lightweight context to signal that inventory data should be refreshed
interface InventoryContextType {
  lastUpdated: number;
  triggerRefresh: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const triggerRefresh = () => {
    setLastUpdated(Date.now());
  };

  return (
    <InventoryContext.Provider value={{ lastUpdated, triggerRefresh }}>
      {children}
    </InventoryContext.Provider>
  );
};
