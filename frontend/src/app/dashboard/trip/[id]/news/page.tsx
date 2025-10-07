'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Newspaper,
  ExternalLink,
  Loader2,
  Info
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

  const NewsCard = ({ article }: { article: NewsArticle }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition flex gap-6">
      {/* Article Thumbnail */}
      {article.thumbnail ? (
        <img
          src={article.thumbnail}
          alt={article.title}
          className="w-32 h-20 object-cover rounded-lg flex-shrink-0"
        />
      ) : (
        <div className="w-32 h-20 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
          <Newspaper className="w-8 h-8 text-gray-400" />
        </div>
      )}
      
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
            <a href={article.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {article.title}
            </a>
          </h3>
          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{article.snippet || 'No description available.'}</p>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
          <span className="font-medium">{article.source?.name || 'Unknown Source'}</span>
          <span>&middot;</span>
          <span>{formatDate(article.date)}</span>
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-blue-600 hover:underline text-sm font-medium"
          >
            Read more <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Fetching the latest news...</p>
        </div>
      </div>
    );
  }

  // Handle cases where there's an error or no data
  if (error || !newsData || newsData.articles.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-xl shadow-md">
          <Info className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'No news articles found for this destination. The news agent may have failed or no relevant articles were available.'}</p>
          <button
            onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Overview
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">News and Updates</h1>
          <p className="text-gray-600">{newsData.summary}</p>
        </div>

        <div className="space-y-4">
          {newsData.articles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      </main>
    </div>
  );
}

// Remove the unused helper function to keep the code clean