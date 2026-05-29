import axios from "axios";

const BASE = import.meta.env.VITE_API_URL ?? "";
const api = axios.create({ baseURL: `${BASE}/api` });

api.interceptors.request.use(config => {
  const token = localStorage.getItem("fpm_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("fpm_token");
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export default api;
