import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('flex_token');
    if (token) {
      api.me().then(res => { setUser(res.data); setLoading(false); }).catch(() => {
        localStorage.removeItem('flex_token');
        setLoading(false);
      });
    } else setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem('flex_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    localStorage.removeItem('flex_token');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
