"use client";
import { useState, useEffect } from "react";
import { registerUser } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();

  const carouselImages = [
   
    
    {
      url: "https://images.unsplash.com/photo-1500835556837-99ac94a94552",
      title: "Explore More",
      subtitle: "Log in to discover new destinations"
    },
    {
      url: "https://images.unsplash.com/photo-1527004013197-933c4bb611b3",
      title: "Adventure Calls",
      subtitle: "Your saved itineraries are waiting"
    },
    {
      url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05",
      title: "Travel Together",
      subtitle: "Connect with fellow travelers"
    },
    {
      url: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd",
      title: "Your Journey Awaits",
      subtitle: "Access your personalized travel plans"
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await registerUser({ name, email, password });
      alert("Signup successful! Please log in.");
      router.push("/login");
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Signup failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
  <div className="flex flex-col lg:flex-row w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl bg-gray-800 border border-gray-700">
    
    {/* Left - Carousel (Smaller & elegant) */}
    <div className="relative lg:w-[45%] h-72 lg:h-auto overflow-hidden">
       
          
      {carouselImages.map((image, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-all duration-[1500ms] ease-in-out transform ${
            index === currentSlide
              ? "opacity-100 scale-100 translate-x-0"
              : "opacity-0 scale-105 translate-x-8"
          }`}
        >
          <img
            src={image.url}
            alt={image.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
          <div className="absolute bottom-10 left-8 right-8 text-white drop-shadow-lg">
            <h2 className="text-2xl font-semibold mb-2">{image.title}</h2>
            <p className="text-sm text-white/80">{image.subtitle}</p>
          </div>
        </div>
      ))}

      {/* Indicators */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
        {carouselImages.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentSlide ? "w-6 bg-white" : "w-3 bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>

    {/* Right - Form */}
    <div className="flex-1 flex items-center justify-center px-6 py-10 lg:py-16 bg-gray-900">
        <a
            href="/"
            className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/30 text-white hover:bg-black/70 transition-all duration-300 text-sm font-medium shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </a>
      <div className="w-full max-w-sm">
        <h2 className="text-3xl font-bold text-white mb-6">Create an account</h2>
        <p className="text-gray-400 mb-8">
          Already have an account?{" "}
          <a href="/login" className="text-indigo-400 hover:underline">
            Log in
          </a>
        </p>

        <form onSubmit={handleSignup} className="flex flex-col gap-5">
          <input
            type="text"
            placeholder="Full Name"
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-indigo-500 outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-indigo-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-indigo-500 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition duration-300"
          >
            Create Account
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          By signing up, you agree to our{" "}
          <span className="text-indigo-400 cursor-pointer hover:underline">
            Terms & Conditions
          </span>
        </div>
      </div>
    </div>
  </div>
</div>
  );
}