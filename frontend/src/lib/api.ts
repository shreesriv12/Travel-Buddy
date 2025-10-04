import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api", // must match backend
});

// Attach Authorization header if token exists
API.interceptors.request.use((req) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export const registerUser = (data) => API.post("/auth/register", data);
export const loginUser = (data) => API.post("/auth/login", data);
export const fetchCurrentUser = () => API.get("/auth/me");
