import { createContext, useContext, useState, useEffect } from "react";
import * as authService from "../services/authService";
import { useDiagnostics } from "../hooks/useDiagnostics";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // capture is stable across renders, so the mount-only effect below can use it
  // without re-running.
  const { capture } = useDiagnostics();

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
        .catch((err) => {
          // A 401 is the only answer that means the token is genuinely dead.
          // (For that case the api interceptor has already cleared storage and
          // bounced to /login; we mirror it so context state stops disagreeing
          // with storage.)
          if (err?.response?.status === 401) {
            localStorage.removeItem("civicai_token");
            localStorage.removeItem("civicai_user");
            setUser(null);
            return;
          }
          // Offline / 5xx / timeout is a backend blip, not a sign-out: keep the
          // cached session so the user isn't ejected whenever the server wobbles,
          // and record it instead of swallowing it. The app's offline state and
          // the diagnostics dashboard both pick it up from here.
          capture(err, { feature: "auth" });
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
    } catch (err) {
      // The token is already valid; a failed profile refresh shouldn't strand
      // the user outside the app — but it is our failure, so record it rather
      // than swallowing it silently.
      capture(err, { feature: "auth" });
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
