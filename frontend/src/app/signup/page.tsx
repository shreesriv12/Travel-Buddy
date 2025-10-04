"use client";
import { useState } from "react";
import { registerUser } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await registerUser({ name, email, password });
      alert("Signup successful! Please log in.");
      router.push("/login");
    } catch (err) {
      alert(err.response?.data?.message || "Signup failed");
    }
  };

  return (
    <form onSubmit={handleSignup} className="flex flex-col gap-3 max-w-sm mx-auto mt-20">
      <h2 className="text-2xl font-bold mb-4">Signup</h2>
      <input
        type="text"
        placeholder="Name"
        className="border p-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
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
      <button type="submit" className="bg-green-600 text-white p-2">Signup</button>
    </form>
  );
}
