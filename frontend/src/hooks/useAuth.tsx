import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { authLogin, authLogout, authMe, authSignup, ServerUser } from '../lib/api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  plan?: string;
}

interface AuthContextProps {
  token: string | null; // truthy while signed in (kept for older callers); the real session is an httpOnly cookie
  user: User | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  token: null, user: null, loading: true,
  setToken: () => {}, setUser: () => {},
  login: async () => {}, signup: async () => {}, logout: async () => {},
});

const toUser = (u: ServerUser): User => ({ ...u, plan: u.role === 'admin' ? 'Admin' : 'Member' });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    authMe().then((r) => alive && setUser(toUser(r.user))).catch(() => alive && setUser(null)).finally(() => alive && setLoading(false));
    const onUnauth = () => setUser(null); // any API call answered 401: the session ended
    window.addEventListener('imagineai:unauth', onUnauth);
    return () => { alive = false; window.removeEventListener('imagineai:unauth', onUnauth); };
  }, []);

  const login = useCallback(async (email: string, password: string) => { setUser(toUser((await authLogin(email, password)).user)); }, []);
  const signup = useCallback(async (name: string, email: string, password: string) => { setUser(toUser((await authSignup(name, email, password)).user)); }, []);
  const logout = useCallback(async () => { try { await authLogout(); } finally { setUser(null); } }, []);

  return (
    <AuthContext.Provider value={{ token: user ? 'session' : null, user, loading, setToken: () => {}, setUser, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
