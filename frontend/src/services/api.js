import axios from "axios";

// API base URL resolution, in order:
//  1. VITE_API_BASE_URL (set in .env.local for dev, or in the Vercel/Render
//     dashboard for production).
//  2. In a production *build* with no env var set, fall back to the deployed
//     Render backend. Falling back to localhost here was a real bug: Vercel
//     builds without the dashboard var silently pointed every visitor's
//     requests at their own machine, which presented as "login/register do
//     nothing".
//  3. In dev with no env var, localhost:8000.
const FALLBACK_PROD_URL = "https://civicai-nexus.onrender.com";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? FALLBACK_PROD_URL : "http://localhost:8000");

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  // A cold free-tier backend can hold a request open indefinitely instead of
  // refusing it. Without this, a sleeping API turns into a spinner that never
  // resolves rather than an error the user can retry.
  timeout: 25000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("civicai_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("civicai_token");
      localStorage.removeItem("civicai_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const uploadsBaseUrl = API_BASE_URL;

export default api;
