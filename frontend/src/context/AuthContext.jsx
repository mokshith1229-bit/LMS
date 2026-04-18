import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('lms_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('lms_token') || null);

  const login = useCallback((userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('lms_user', JSON.stringify(userData));
    localStorage.setItem('lms_token', jwtToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('lms_user');
    localStorage.removeItem('lms_token');
  }, []);

  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
