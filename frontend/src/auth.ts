import axios from "axios";

const BASE = import.meta.env.VITE_API_URL ?? "";
const KEY = "fpm_token";

export function getToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
}

export function clearToken() {
  localStorage.removeItem(KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export async function login(username: string, password: string): Promise<string> {
  const res = await axios.post(`${BASE}/api/auth/login`, { username, password });
  const token = res.data.token;
  setToken(token);
  return token;
}

// Agrega el token a todas las requests de axios automáticamente
axios.interceptors.request.use(config => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Si el servidor devuelve 401, limpia el token y recarga al login
axios.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);
