"use client";
import { useState, useEffect } from "react";
import { loginUser } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Sun, Moon, XCircle, CheckCircle, Link } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null); // New state for error messages
  const [currentSlide, setCurrentSlide] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const carouselImages = [
    {
      url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
      title: "Welcome Back",
      subtitle: "Continue your adventure with TravelBuddy"
    },
    {
      url: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800",
      title: "Discover Amazing Places",
      subtitle: "Explore the world with TravelBuddy"
    },
    {
      url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1",
      title: "Plan Your Journey",
      subtitle: "Create perfect itineraries effortlessly"
    },
    {
      url: "https://images.unsplash.com/photo-1488646953014-85cb44e25828",
      title: "Capture Memories",
      subtitle: "Make every trip unforgettable"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselImages.length]);

const handleLogin = async (e) => {
  e.preventDefault();
  setError(null);

  try {
const res = await loginUser({ email, password });
console.log('Login response:', res.data);
    
    // Correctly destructure token and user object
    const { token, user } = res.data;

    if (token && user?.id) {
      // Store token and userId
      localStorage.setItem("token", token);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("userName", user.name); // optional
      localStorage.setItem("userEmail", user.email); // optional

      router.push("/dashboard");
    } else {
      throw new Error("Login successful, but missing required user data.");
    }
  } catch (err) {
    console.error("Login error:", err);
    const errorMessage = err.response?.data?.message || "Login failed. Please check your email and password.";
    setError(errorMessage);
  }
};


  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
    }`}>
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 left-6 z-50 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300"
      >
        {theme === 'dark' ? (
          <Sun className="w-6 h-6 text-yellow-500" />
        ) : (
          <Moon className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* Back to Home Button */}
      <Link
        href="/"
        className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-black/50 dark:bg-white/10 backdrop-blur-md rounded-full border border-white/30 text-white hover:bg-black/70 dark:hover:bg-white/20 transition-all duration-300 text-sm font-medium shadow-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Home
      </Link>

      <div className={`flex flex-col lg:flex-row w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl transition-colors duration-500 ${
        theme === 'dark' 
          ? 'bg-gray-800 border border-gray-700' 
          : 'bg-white border border-gray-200'
      }`}>
        
        {/* Left - Carousel */}
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
        <div className={`flex-1 flex items-center justify-center px-6 py-10 lg:py-16 transition-colors duration-500 ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        }`}>
          <div className="w-full max-w-sm">
            <h2 className={`text-3xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Login
            </h2>
            <p className={`mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Don't have an account?{" "}
              <a href="/signup" className="text-indigo-500 hover:underline font-medium">
                Sign Up
              </a>
            </p>

            {/* Error Message Display */}
            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 text-red-700 bg-red-100 rounded-lg dark:bg-red-900 dark:text-red-300">
                <XCircle size={20} />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <input
                type="email"
                placeholder="Email"
                className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors duration-300 ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
                }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className={`w-full px-4 py-3 rounded-lg border outline-none transition-colors duration-300 ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-indigo-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-indigo-500'
                }`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition duration-300 shadow-lg hover:shadow-xl"
              >
                Login
              </button>
            </form>

            <div className={`mt-6 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
              Secure login powered by TravelBuddy
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
