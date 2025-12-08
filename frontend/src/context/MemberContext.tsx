import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

interface MemberInfo {
  member_id: number;
  name: string;
  phone: string;
}

interface MemberContextValue {
  memberId: number | null;
  memberInfo: MemberInfo | null;
  setMemberId: (id: number | null) => void;
  setMemberInfo: (info: MemberInfo | null) => void;
}

const MemberContext = createContext<MemberContextValue | undefined>(undefined);

export const MemberProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [memberId, setMemberIdState] = useState<number | null>(null);
  const [memberInfo, setMemberInfoState] = useState<MemberInfo | null>(null);

  useEffect(() => {
    const storedId = window.localStorage.getItem('memberId');
    const storedInfo = window.localStorage.getItem('memberInfo');
    
    if (storedId) {
      const id = Number(storedId);
      if (Number.isFinite(id)) {
        setMemberIdState(id);
      }
    }
    
    if (storedInfo) {
      try {
        const info = JSON.parse(storedInfo) as MemberInfo;
        setMemberInfoState(info);
      } catch {
        // ignore invalid stored data
        window.localStorage.removeItem('memberInfo');
      }
    }
  }, []);

  // Use useCallback to stabilize the setMemberId function reference
  const setMemberId = useCallback((id: number | null) => {
    setMemberIdState(id);
    if (id == null) {
      window.localStorage.removeItem('memberId');
      setMemberInfoState(null);
      window.localStorage.removeItem('memberInfo');
    } else {
      window.localStorage.setItem('memberId', String(id));
    }
  }, []);

  // Use useCallback to stabilize the setMemberInfo function reference
  const setMemberInfo = useCallback((info: MemberInfo | null) => {
    setMemberInfoState(info);
    if (info == null) {
      window.localStorage.removeItem('memberInfo');
    } else {
      window.localStorage.setItem('memberInfo', JSON.stringify(info));
      setMemberIdState(info.member_id);
      window.localStorage.setItem('memberId', String(info.member_id));
    }
  }, []);

  // Use useMemo to stabilize the context value object reference
  const value = useMemo(() => ({ memberId, memberInfo, setMemberId, setMemberInfo }), [memberId, memberInfo, setMemberId, setMemberInfo]);

  return (
    <MemberContext.Provider value={value}>{children}</MemberContext.Provider>
  );
};

export function useMember() {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error('useMember must be used within MemberProvider');
  return ctx;
}


