'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Sun, Moon, MapPin } from 'lucide-react';

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
  const [theme, setTheme] = useState('light');
  const router = useRouter();
  const heroRef = useRef<HTMLElement>(null);
  const featuredRef = useRef<HTMLElement>(null);
  const destinationCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

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
    };

    loadGSAP();

    return () => {
      if (window.ScrollTrigger) {
        window.ScrollTrigger.getAll().forEach((t: any) => t.kill());
      }
    };
  }, []);

  const handleStartPlanning = (): void => {
    router.push('/login');
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
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Poppins', sans-serif; }
      `}</style>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300"
        style={{ backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)' }}
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
            <span className="text-white/90 text-sm font-medium tracking-wide uppercase">Welcome to TravelBuddy</span>
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
              onClick={handleStartPlanning}
              className="group px-8 py-3 bg-blue-800 text-white text-lg font-semibold rounded-full hover:scale-105 hover:shadow-2xl transition-all duration-300 hover:bg-blue-700 flex items-center gap-2"
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
        className={`py-24 px-6 transition-colors duration-500 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="section-title text-center mb-16">
            <h2 className={`text-4xl md:text-5xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Featured Destinations
            </h2>
            <p className={`text-xl ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
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

      {/* Footer */}
      <footer className={`py-12 px-6 transition-colors duration-500 ${theme === 'dark' ? 'bg-black' : 'bg-gray-900'}`}>
        <div className="max-w-7xl mx-auto text-center">
          <h3 className="text-2xl font-bold mb-2 text-white">TravelBuddy</h3>
          <p className="text-gray-400 mb-6">Your journey begins here</p>
          <p className="text-sm text-gray-500">© 2025 TravelBuddy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}