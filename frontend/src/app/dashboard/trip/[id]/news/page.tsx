'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import {  Sun,Moon, XCircle, CheckCircle, Link } from "lucide-react";
import {
  ArrowLeft,
  Newspaper,
  ExternalLink,
  Loader2,
  Info,
  TrendingUp,
  Clock,
  Search,
  Sparkles
} from 'lucide-react';

// Interfaces updated to match the actual JSON structure from your database
interface NewsSource {
  name: string;
  icon: string;
}

interface NewsArticle {
  id: string;
  title: string;
  snippet: string;
  source: NewsSource;
  date: string;
  link: string;
  thumbnail: string | null;
  position: number;
}

interface NewsData {
  summary: string;
  destination: string;
  totalArticles: number;
  timeRange: string;
  articles: NewsArticle[];
  searchQuery: string;
  error?: string;
}

export default function NewsPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [newsData, setNewsData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchNews();
  }, [tripId]);

  const fetchNews = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/news`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      const data = await response.json();
      
      // Check for a specific error from the backend
      if (data && data.error) {
        setError(data.error);
        setNewsData(null);
      } else {
        setNewsData(data);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      // The date format can be inconsistent, so try to parse it.
      // E.g., "10/02/2025, 07:00 AM, +0000 UTC"
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      
      if (diffInDays === 0) return 'Today';
      if (diffInDays === 1) return 'Yesterday';
      if (diffInDays < 7) return `${diffInDays} days ago`;
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
      return formatDate(dateString);
    } catch {
      return formatDate(dateString);
    }
  };

  const NewsCard = ({ article, index }: { article: NewsArticle; index: number }) => (
  <div 
    className={`group rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border ${
      theme === 'dark'
        ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700 hover:border-blue-500/50'
        : 'bg-white border-gray-100 hover:border-blue-200'
    }`}
    style={{ 
      animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
    }}
  >
    <div className="flex flex-col md:flex-row gap-0">
      {/* Article Thumbnail */}
      <div className={`relative md:w-80 h-48 md:h-auto overflow-hidden flex-shrink-0 ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-700 to-gray-800'
          : 'bg-gradient-to-br from-blue-100 to-purple-100'
      }`}>
        {article.thumbnail ? (
          <img
            src={article.thumbnail}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Newspaper className={`w-16 h-16 ${
              theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
            }`} />
          </div>
        )}
        <div className={`absolute top-3 left-3 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1 ${
          theme === 'dark'
            ? 'bg-gray-800/90 text-gray-300'
            : 'bg-white/90 text-gray-700'
        }`}>
          <TrendingUp className="w-3 h-3" />
          #{article.position}
        </div>
      </div>
      
      <div className="flex-1 p-6 flex flex-col justify-between">
        <div>
          {/* Source Badge */}
          <div className="flex items-center gap-2 mb-3">
            {article.source?.icon && (
              <img 
                src={article.source.icon} 
                alt={article.source.name}
                className="w-5 h-5 rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <span className={`text-sm font-semibold ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}>
              {article.source?.name || 'Unknown Source'}
            </span>
            <span className={theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}>
              •
            </span>
            <span className={`text-sm flex items-center gap-1 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              <Clock className="w-3 h-3" />
              {getRelativeTime(article.date)}
            </span>
          </div>

          {/* Title */}
          <h3 className={`text-xl font-bold mb-3 transition-colors line-clamp-2 ${
            theme === 'dark'
              ? 'text-white group-hover:text-blue-400'
              : 'text-gray-900 group-hover:text-blue-600'
          }`}>
            <a href={article.link} target="_blank" rel="noopener noreferrer">
              {article.title}
            </a>
          </h3>

          {/* Snippet */}
          <p className={`mb-4 line-clamp-3 leading-relaxed ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {article.snippet || 'No description available.'}
          </p>
        </div>
        
        {/* Read More Button */}
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 font-medium text-sm group/link w-fit ${
            theme === 'dark'
              ? 'text-blue-400 hover:text-blue-300'
              : 'text-blue-600 hover:text-blue-700'
          }`}
        >
          <span>Read full article</span>
          <ExternalLink className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  </div>
);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <Sparkles className="w-6 h-6 text-purple-500 absolute top-0 right-0 animate-pulse" />
          </div>
          <p className="text-gray-600 text-lg font-medium">Fetching the latest news...</p>
          <p className="text-gray-400 text-sm mt-2">Gathering updates from trusted sources</p>
        </div>
      </div>
    );
  }

  // Handle cases where there's an error or no data
  if (error || !newsData || newsData.articles.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center p-4">
        <div className="text-center bg-white p-10 rounded-2xl shadow-xl max-w-md">
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Info className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No News Available</h2>
          <p className="text-gray-600 mb-6">
            {error || 'No news articles found for this destination. The news agent may have failed or no relevant articles were available.'}
          </p>
          <button
            onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
          >
            Back to Overview
          </button>
        </div>
      </div>
    );
  }

  return (
  <div className={`min-h-screen ${
    theme === 'dark' 
      ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
      : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
  }`}>
    {/* Theme Toggle Button */}
    <button
      onClick={toggleTheme}
      className={`fixed top-6 left-6 z-50 p-3 rounded-full backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-gray-800/90 hover:bg-gray-700/90' 
          : 'bg-white/90 hover:bg-white'
      }`}
    >
      {theme === 'dark' ? (
        <Sun className="w-6 h-6 text-yellow-500" />
      ) : (
        <Moon className="w-6 h-6 text-gray-700" />
      )}
    </button>

    {/* Header */}
    <header className={`backdrop-blur-md shadow-sm sticky top-0 z-10 ${
      theme === 'dark'
        ? 'bg-gray-800/80 border-b border-gray-700'
        : 'bg-white/80'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
            className={`flex items-center gap-2 transition-colors group ${
              theme === 'dark'
                ? 'text-gray-300 hover:text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Overview</span>
          </button>
          
          <div className={`flex items-center gap-2 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            <Newspaper className="w-5 h-5" />
            <span className="text-sm font-medium">{newsData.totalArticles} Articles</span>
          </div>
        </div>
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Newspaper className="w-6 h-6 text-white" />
          </div>
          <h1 className={`text-4xl font-bold m-4 ${
            theme === 'dark'
              ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
          }`}>
            News & Updates
          </h1>
        </div>
        
        {/* Summary Card */}
        <div className={`rounded-2xl shadow-lg p-6 border ${
          theme === 'dark'
            ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700'
            : 'bg-white border-gray-100'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
            }`}>
              <Sparkles className={`w-5 h-5 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`} />
            </div>
            <div className="flex-1">
              <h2 className={`font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Latest Updates for {newsData.destination}
              </h2>
              <p className={`leading-relaxed ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {newsData.summary}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className={`rounded-xl p-4 shadow-sm border ${
          theme === 'dark'
            ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700'
            : 'bg-white border-gray-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
            }`}>
              <Search className={`w-5 h-5 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <p className={`text-xs uppercase tracking-wide ${
                theme === 'dark' ? 'text-gray-100' : 'text-gray-500'
              }`}>
                Search Query
              </p>
              <p className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {newsData.searchQuery}
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${
          theme === 'dark'
            ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700'
            : 'bg-white border-gray-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
            }`}>
              <Clock className={`w-5 h-5 ${
                theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
              }`} />
            </div>
            <div>
              <p className={`text-xs uppercase tracking-wide ${
                theme === 'dark' ? 'text-gray-100' : 'text-gray-500'
              }`}>
                Time Range
              </p>
              <p className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {newsData.timeRange}
              </p>
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border ${
          theme === 'dark'
            ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700'
            : 'bg-white border-gray-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
            }`}>
              <TrendingUp className={`w-5 h-5 ${
                theme === 'dark' ? 'text-green-400' : 'text-green-600'
              }`} />
            </div>
            <div>
              <p className={`text-xs uppercase tracking-wide ${
                theme === 'dark' ? 'text-gray-100' : 'text-gray-500'
              }`}>
                Total Articles
              </p>
              <p className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {newsData.totalArticles} Stories
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* News Articles Grid */}
      <div className="space-y-6">
        {newsData.articles.map((article, index) => (
          <NewsCard key={article.id} article={article} index={index} />
        ))}
      </div>
    </main>

    <style jsx>{`
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `}</style>
  </div>
);}