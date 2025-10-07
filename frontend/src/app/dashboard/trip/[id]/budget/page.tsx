// app/dashboard/trip/[id]/budget/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Clock,
  Loader2,
  Lightbulb
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface BudgetData {
  summary: string;
  budget: {
    total: number;
    totalActual: number;
    perPerson: number;
    perDay: number;
    categoryBreakdown: {
      [category: string]: {
        estimated: number;
        actual: number;
        items: any[];
      };
    };
  };
  recommendations: string[];
  tripInfo: {
    destination: string;
    duration: number;
    travelers: number;
    dates: {
      start: string;
      end: string;
    };
  };
}

interface BudgetItem {
  id: string;
  category: string;
  item_name: string;
  estimated_amount: number;
  actual_amount: number;
  status: string;
  notes: string | null;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'];

const CATEGORY_ICONS: { [key: string]: string } = {
  flights: '✈️',
  accommodation: '🏨',
  food: '🍽️',
  localTransport: '🚗',
  transport: '🚗',
  activities: '🎯',
  miscellaneous: '💡',
  shopping: '🛍️',
  entertainment: '🎭'
};

export default function BudgetPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBudgetData();
  }, [tripId]);

  const fetchBudgetData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      // Fetch budget summary
      const budgetRes = await fetch(`http://localhost:5000/api/trips/${tripId}/budget`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Fetch budget items
      const itemsRes = await fetch(`http://localhost:5000/api/trips/${tripId}/budget/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!budgetRes.ok || !itemsRes.ok) {
        throw new Error('Failed to fetch budget data');
      }

      const budgetData = await budgetRes.json();
      const itemsData = await itemsRes.json();

      setBudgetData(budgetData);
      setBudgetItems(itemsData.budgetItems);
    } catch (err) {
      console.error('Error fetching budget:', err);
      setError(err instanceof Error ? err.message : 'Failed to load budget');
    } finally {
      setLoading(false);
    }
  };

  const getChartData = () => {
    if (!budgetData) return [];
    
    return Object.entries(budgetData.budget.categoryBreakdown).map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: value.estimated,
      percentage: ((value.estimated / budgetData.budget.total) * 100).toFixed(1)
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'estimated': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'estimated': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading budget details...</p>
        </div>
      </div>
    );
  }

  if (error || !budgetData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'No budget data available'}</p>
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

  const chartData = getChartData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Budget Breakdown</h1>
          <p className="text-gray-600">{budgetData.summary}</p>
        </div>

        {/* Total Budget Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 text-white mb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 mb-2">Total Trip Budget</p>
              <p className="text-5xl font-bold mb-4">
                ${budgetData.budget.total.toLocaleString()}
              </p>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-blue-200">Per Person</p>
                  <p className="text-xl font-semibold">
                    ${Math.round(budgetData.budget.perPerson).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-blue-200">Per Day</p>
                  <p className="text-xl font-semibold">
                    ${Math.round(budgetData.budget.perDay).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-blue-200">Duration</p>
                  <p className="text-xl font-semibold">{budgetData.tripInfo.duration} days</p>
                </div>
                <div>
                  <p className="text-blue-200">Travelers</p>
                  <p className="text-xl font-semibold">{budgetData.tripInfo.travelers}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Budget Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Category Breakdown</h2>
            <div className="space-y-4">
              {chartData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-900 font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ${item.value.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">{item.percentage}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Budget Items */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Detailed Budget Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Item</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Estimated</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actual</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {budgetItems.map((item) => {
                  const difference = item.actual_amount - item.estimated_amount;
                  const isOverBudget = difference > 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="text-2xl">{CATEGORY_ICONS[item.category] || '📌'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{item.item_name}</p>
                        {item.notes && (
                          <p className="text-sm text-gray-500">{item.notes}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        ${item.estimated_amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        ${item.actual_amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {difference !== 0 && (
                          <div className={`flex items-center justify-end gap-1 ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                            {isOverBudget ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span className="font-medium">
                              ${Math.abs(difference).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Saving Tips */}
        {budgetData.recommendations.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Lightbulb className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-4">💡 Budget Tips</h2>
                <ul className="space-y-2">
                  {budgetData.recommendations.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-700">
                      <span className="text-green-600 font-bold">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}