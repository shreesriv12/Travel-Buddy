"use client";
import { useState } from "react";
import { loginUser } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await loginUser({ email, password });
      localStorage.setItem("token", res.data.token);
      router.push("/dashboard"); // redirect after login
    } catch (err) {
      alert(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-3 max-w-sm mx-auto mt-20">
      <h2 className="text-2xl font-bold mb-4">Login</h2>
      <input
        type="email"
        placeholder="Email"
        className="border p-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        className="border p-2"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" className="bg-blue-600 text-white p-2">Login</button>
    </form>
  );
}
