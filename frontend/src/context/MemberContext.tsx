import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

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

  // Use useCallback to stabilize the setMemberId function reference
  const setMemberId = useCallback((id: number | null) => {
    setMemberIdState(id);
    if (id == null) {
      window.localStorage.removeItem('memberId');
    } else {
      window.localStorage.setItem('memberId', String(id));
    }
  }, []);

  // Use useMemo to stabilize the context value object reference
  const value = useMemo(() => ({ memberId, setMemberId }), [memberId, setMemberId]);

  return (
    <MemberContext.Provider value={value}>{children}</MemberContext.Provider>
  );
};

export function useMember() {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error('useMember must be used within MemberProvider');
  return ctx;
}


