import { createContext, useContext, useState, useEffect } from "react";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("civicai_token");
    const storedUser = localStorage.getItem("civicai_user");

    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      // Re-validate the token / refresh user data from the server.
      authService
        .getMe()
        .then((res) => {
          const freshUser = { ...JSON.parse(storedUser), ...res.data, id: res.data._id };
          setUser(freshUser);
          localStorage.setItem("civicai_user", JSON.stringify(freshUser));
        })
        .catch(() => {
          localStorage.removeItem("civicai_token");
          localStorage.removeItem("civicai_user");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    const { access_token, user: loggedInUser } = res.data;
    localStorage.setItem("civicai_token", access_token);
    localStorage.setItem("civicai_user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (data) => {
    return authService.register(data);
  };

  const logout = () => {
    localStorage.removeItem("civicai_token");
    localStorage.removeItem("civicai_user");
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("civicai_user", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated: !!user, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
export default AuthContext;
