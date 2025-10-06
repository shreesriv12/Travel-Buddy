'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Sun, Moon, MapPin, Calendar, Compass } from 'lucide-react';
import { useTheme } from './context/ThemeContext';

interface Destination {
  name: string;
  image: string;
  description: string;
}

declare global {
  interface Window {
    gsap: any;
    ScrollTrigger: any;
  }
}

export default function Page() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const heroRef = useRef<HTMLElement>(null);
  const featuredRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLElement>(null);
  const destinationCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const loadGSAP = (): void => {
      if (window.gsap) {
        initAnimations();
        return;
      }
      const gsapScript = document.createElement('script');
      gsapScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
      gsapScript.async = true;
      gsapScript.onload = () => {
        const stScript = document.createElement('script');
        stScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js';
        stScript.async = true;
        stScript.onload = () => {
          if (window.gsap && window.ScrollTrigger) {
            window.gsap.registerPlugin(window.ScrollTrigger);
            initAnimations();
          }
        };
        document.body.appendChild(stScript);
      };
      document.body.appendChild(gsapScript);
    };

    const initAnimations = (): void => {
      const gsap = window.gsap;

      const heroContent = heroRef.current?.querySelector('.hero-content');
      if (heroContent) {
        gsap.fromTo(
          heroContent,
          { opacity: 0, y: 60 },
          { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.3 }
        );
      }

      if (featuredRef.current) {
        gsap.fromTo(
          featuredRef.current.querySelector('.section-title'),
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: featuredRef.current,
              start: 'top 80%',
              end: 'top 50%',
              toggleActions: 'play none none none',
            },
          }
        );

        destinationCardsRef.current.forEach((card, index) => {
          if (!card) return;
          gsap.fromTo(
            card,
            { opacity: 0, y: 50, scale: 0.9 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.6,
              ease: 'power2.out',
              delay: index * 0.1,
              scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none none',
              },
            }
          );
        });
      }

      if (formRef.current) {
        window.gsap.fromTo(
          formRef.current.querySelector('.form-title'),
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: formRef.current,
              start: 'top 80%',
              toggleActions: 'play none none none',
            },
          }
        );

        window.gsap.fromTo(
          formRef.current.querySelector('.form-container'),
          { opacity: 0, y: 50, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: formRef.current,
              start: 'top 75%',
              toggleActions: 'play none none none',
            },
          }
        );
      }
    };

    loadGSAP();

    return () => {
      if (window.ScrollTrigger) {
        window.ScrollTrigger.getAll().forEach((t: any) => t.kill());
      }
    };
  }, []);

  const scrollToItinerary = (): void => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const destinations: Destination[] = [
    {
      name: 'Bali, Indonesia',
      image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4',
      description: 'Tropical paradise with ancient temples',
    },
    {
      name: 'Santorini, Greece',
      image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e',
      description: 'Stunning sunsets and white-washed villages',
    },
    {
      name: 'Tokyo, Japan',
      image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf',
      description: 'Where tradition meets futuristic innovation',
    },
    {
      name: 'Swiss Alps',
      image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7',
      description: 'Majestic mountains and pristine nature',
    },
  ];

  return (
  <div className={`min-h-screen  transition-colors duration-500 ${theme === 'dark' ? 'dark' : 'bg-white text-gray-900'}`}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Poppins', sans-serif; }
      `}</style>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300"
      >
        {theme === 'dark' ? (
          <Sun className="w-6 h-6 text-yellow-500" />
        ) : (
          <Moon className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative h-screen flex items-center justify-center overflow-hidden"
      >
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="videos/296958.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />

        <div className="hero-content relative z-10 text-center px-6 max-w-5xl mx-auto">
          <div className="inline-block mb-4 px-6 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
            <span className="text-white/90 text-sm font-medium tracking-wide uppercase">Welcome to TravelMate</span>
          </div>
          <h1 className="text-3xl italic md:text-5xl lg:text-6xl text-white mb-6 leading-tight tracking-tight">
            Plan Your Perfect
            <br />
            <span className="bg-gradient-to-r italic from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Journey
            </span>
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-white/80 mb-12 font-light max-w-3xl mx-auto leading-relaxed">
            Craft personalized itineraries that inspire adventure and create unforgettable memories around the world
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={scrollToItinerary}
              className="group px-8 py-3 bg-blue-800 text-white text-lg font-semibold rounded-full hover:scale-105 hover:shadow-2xl transition-all duration-300 hover:from-blue-600 hover:to-purple-700 flex items-center gap-2"
            >
              Start Planning
              <svg className="w-5 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-3 bg-white/10 backdrop-blur-md text-white text-lg font-semibold rounded-full hover:bg-white/20 transition-all duration-300 border border-white/30"
            >
              Learn More
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-white/70 rounded-full" />
          </div>
        </div>
      </section>

      {/* Featured Destinations */}
      <section
        ref={featuredRef}
        className="py-24 px-6 bg-white dark:bg-gray-900 transition-colors duration-500"
      >
        <div className="max-w-7xl mx-auto">
          <div className="section-title text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Featured Destinations
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Discover the world's most incredible places
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {destinations.map((dest, idx) => (
              <div
                key={idx}
                ref={(el) => (destinationCardsRef.current[idx] = el)}
                className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-shadow duration-300 cursor-pointer will-change-transform"
                style={{ transform: 'translateZ(1)' }}
              >
                <div className="aspect-[3/4] relative">
                  <img
                    src={dest.image}
                    alt={dest.name}
                    className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white transform transition-transform duration-300 group-hover:-translate-y-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-5 h-5" />
                      <h3 className="text-xl font-semibold">{dest.name}</h3>
                    </div>
                    <p className="text-sm text-white/80">{dest.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Create Itinerary Form */}
      <section
        ref={formRef}
        className="py-24 px-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 transition-colors duration-500"
      >
        <div className="max-w-4xl mx-auto">
          <div className="form-title text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Create Your Itinerary
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Let's start planning your dream adventure
            </p>
          </div>

          <div className="form-container bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 md:p-12 transition-colors duration-500">
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium mb-3">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  Destination
                </label>
                <input
                  type="text"
                  placeholder="Where do you want to go?"
                  className="w-full px-6 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors duration-300 text-lg"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium mb-3">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-6 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition-colors duration-300 text-lg"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium mb-3">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-6 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none transition-colors duration-300 text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium mb-3">
                  <Compass className="w-5 h-5 text-green-500" />
                  Activities
                </label>
                <textarea
                  placeholder="What would you like to do? (e.g., hiking, beaches, culture, food)"
                  rows={4}
                  className="w-full px-6 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-green-500 dark:focus:border-green-400 focus:outline-none transition-colors duration-300 text-lg resize-none"
                />
              </div>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  alert('Itinerary generation feature coming soon!');
                }}
                className="w-full py-5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-lg font-semibold rounded-xl hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 hover:from-blue-600 hover:to-purple-700"
              >
                Generate My Itinerary ✨
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-white dark:bg-black text-white transition-colors duration-500">
        <div className="max-w-7xl mx-auto text-center">
          <h3 className="text-2xl font-bold mb-2">TravelMate</h3>
          <p className="text-gray-400 mb-6">Your journey begins here</p>
          <p className="text-sm text-gray-500">© 2025 TravelMate. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
