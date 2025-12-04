import React, { createContext, useContext, useEffect, useState } from 'react';

interface MemberContextValue {
  memberId: number | null;
  setMemberId: (id: number | null) => void;
}

const MemberContext = createContext<MemberContextValue | undefined>(undefined);

export const MemberProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [memberId, setMemberIdState] = useState<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('memberId');
    if (stored) {
      const id = Number(stored);
      if (Number.isFinite(id)) setMemberIdState(id);
    }
  }, []);

  const setMemberId = (id: number | null) => {
    setMemberIdState(id);
    if (id == null) {
      window.localStorage.removeItem('memberId');
    } else {
      window.localStorage.setItem('memberId', String(id));
    }
  };

  return (
    <MemberContext.Provider value={{ memberId, setMemberId }}>{children}</MemberContext.Provider>
  );
};

export function useMember() {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error('useMember must be used within MemberProvider');
  return ctx;
}


