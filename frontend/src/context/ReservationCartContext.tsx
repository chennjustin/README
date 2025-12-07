import { createContext, useContext, useState, ReactNode } from 'react';

interface ReservationCartItem {
  book_id: number;
  book_name: string;
  estimated_rental: number;
  available_count: number; // 可借數量，用於驗證
}

interface ReservationCartContextType {
  items: ReservationCartItem[];
  addItem: (item: ReservationCartItem) => void;
  removeItem: (bookId: number) => void;
  clearCart: () => void;
  hasItem: (bookId: number) => boolean;
  totalEstimatedRental: number;
}

const ReservationCartContext = createContext<ReservationCartContextType | undefined>(undefined);

export function ReservationCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ReservationCartItem[]>([]);

  const addItem = (item: ReservationCartItem) => {
    // 檢查是否有可借的複本
    if (item.available_count <= 0) {
      throw new Error('該書籍目前無可借複本，無法加入預約購物車');
    }
    
    setItems((prev) => {
      // 檢查是否已經存在
      if (prev.some((i) => i.book_id === item.book_id)) {
        return prev;
      }
      return [...prev, item];
    });
  };

  const removeItem = (bookId: number) => {
    setItems((prev) => prev.filter((i) => i.book_id !== bookId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const hasItem = (bookId: number) => {
    return items.some((i) => i.book_id === bookId);
  };

  const totalEstimatedRental = items.reduce((sum, item) => sum + item.estimated_rental, 0);

  return (
    <ReservationCartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearCart,
        hasItem,
        totalEstimatedRental,
      }}
    >
      {children}
    </ReservationCartContext.Provider>
  );
}

export function useReservationCart() {
  const context = useContext(ReservationCartContext);
  if (context === undefined) {
    throw new Error('useReservationCart must be used within a ReservationCartProvider');
  }
  return context;
}

