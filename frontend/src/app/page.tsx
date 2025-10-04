// src/app/page.tsx
import Link from 'next/link';
import { Plane, Calendar, MapPin, Star, Users, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Plane className="h-8 w-8 text-indigo-600" />
              <span className="text-2xl font-bold text-indigo-900">TravelAI</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <button className="px-4 py-2 text-indigo-600 hover:text-indigo-800 font-medium transition">
                  Login
                </button>
              </Link>
              <Link href="/signup">
                <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md">
                  Sign Up
                </button>
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Plan Your Perfect Trip with
            <span className="text-indigo-600"> AI</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
            Let artificial intelligence create personalized travel itineraries with flights, 
            accommodations, activities, and weather forecasts - all in seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <button className="px-8 py-4 bg-indigo-600 text-white text-lg rounded-lg hover:bg-indigo-700 transition shadow-lg">
                Get Started Free
              </button>
            </Link>
            <Link href="/planner">
              <button className="px-8 py-4 bg-white text-indigo-600 text-lg rounded-lg hover:bg-gray-50 transition shadow-lg border-2 border-indigo-600">
                Try Demo
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
          Why Choose TravelAI?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Calendar className="h-12 w-12 text-indigo-600" />}
            title="Smart Itineraries"
            description="AI-powered day-by-day plans optimized for your schedule and preferences"
          />
          <FeatureCard
            icon={<MapPin className="h-12 w-12 text-indigo-600" />}
            title="Local Activities"
            description="Discover hidden gems and popular attractions tailored to your interests"
          />
          <FeatureCard
            icon={<Star className="h-12 w-12 text-indigo-600" />}
            title="Weather-Aware"
            description="Activities scheduled based on real-time weather forecasts"
          />
          <FeatureCard
            icon={<Users className="h-12 w-12 text-indigo-600" />}
            title="Group Planning"
            description="Perfect for solo travelers, couples, families, or groups"
          />
          <FeatureCard
            icon={<Shield className="h-12 w-12 text-indigo-600" />}
            title="Budget Control"
            description="Stay within your budget with transparent pricing and alternatives"
          />
          <FeatureCard
            icon={<Plane className="h-12 w-12 text-indigo-600" />}
            title="Flight Integration"
            description="Compare and book flights directly from your itinerary"
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            <Step
              number="1"
              title="Enter Details"
              description="Tell us your destination, dates, budget, and preferences"
            />
            <Step
              number="2"
              title="AI Planning"
              description="Our AI analyzes thousands of options to create your perfect itinerary"
            />
            <Step
              number="3"
              title="Enjoy Your Trip"
              description="Get a complete travel plan with bookings, activities, and more"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-center text-white shadow-2xl">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Start Your Adventure?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of travelers who trust TravelAI for their trips
          </p>
          <Link href="/signup">
            <button className="px-8 py-4 bg-white text-indigo-600 text-lg rounded-lg hover:bg-gray-100 transition shadow-lg font-semibold">
              Create Free Account
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Plane className="h-6 w-6" />
                <span className="text-xl font-bold">TravelAI</span>
              </div>
              <p className="text-gray-400">
                AI-powered travel planning for the modern explorer
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Demo</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 TravelAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}