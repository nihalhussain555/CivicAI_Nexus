import { createContext, useContext, useState, useEffect } from "react";
import * as authService from "../services/authService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("civicai_token");
    const storedUser = localStorage.getItem("civicai_user");

    let parsedUser = null;
    if (token && storedUser) {
      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        // Corrupt localStorage entry would throw here and leave `loading`
        // true forever, pinning every protected route on a spinner.
        localStorage.removeItem("civicai_token");
        localStorage.removeItem("civicai_user");
      }
    }

    if (token && parsedUser) {
      setUser(parsedUser);
      // Re-validate the token / refresh user data from the server.
      authService
        .getMe()
        .then((res) => {
          const freshUser = { ...parsedUser, ...res.data, id: res.data._id };
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
    // /auth/login answers with a trimmed profile; district (which drives the
    // admin scope guard and sidebar) only arrives from /auth/me.
    let profile = loggedInUser;
    try {
      const me = await authService.getMe();
      profile = { ...loggedInUser, ...me.data, id: me.data._id };
    } catch {
      // The token is already valid; a failed profile refresh shouldn't
      // strand the user outside the app.
    }
    localStorage.setItem("civicai_user", JSON.stringify(profile));
    setUser(profile);
    return profile;
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
