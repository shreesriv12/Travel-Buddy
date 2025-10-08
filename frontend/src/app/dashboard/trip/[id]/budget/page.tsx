// app/dashboard/trip/[id]/budget/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Sun, Moon, XCircle,Link } from "lucide-react";
import { useTheme } from '../../../../context/ThemeContext';
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
  const { theme, toggleTheme } = useTheme();

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
  <div
    className={`min-h-screen transition-colors duration-500 ${
      theme === "dark"
        ? "bg-gray-950 text-gray-100"
        : "bg-gray-50 text-gray-900"
    }`}
  >
    {/* Theme Toggle */}
    <button
      onClick={toggleTheme}
      className="fixed top-6 left-6 z-50 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:scale-105 transition-transform duration-300"
    >
      {theme === "dark" ? (
        <Sun className="w-6 h-6 text-yellow-400" />
      ) : (
        <Moon className="w-6 h-6 text-gray-900" />
      )}
    </button>

    {/* Header */}
    <header
      className={`border-b ${
        theme === "dark"
          ? "bg-gray-900 border-gray-800"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          onClick={() => router.push(`/dashboard/trip/${tripId}/overview`)}
          className={`flex items-center gap-2 transition ${
        theme === "dark"
          ? "bg-gray-900 border-gray-800"
          : "bg-white border-gray-200"
      }`}
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Overview
        </button>
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Budget Breakdown</h1>
        <p className="text-gray-600 dark:text-gray-400">{budgetData.summary}</p>
      </div>

      {/* Total Budget Card */}
      <div
        className={`rounded-xl p-8 shadow-sm ${
          theme === "dark"
            ? "bg-gradient-to-r from-indigo-800 to-indigo-900"
            : "bg-gradient-to-r from-indigo-500 to-indigo-700"
        } text-white`}
      >
        <div className="flex justify-between items-start flex-wrap gap-6">
          <div>
            <p className="text-indigo-200 mb-2">Total Trip Budget</p>
            <p className="text-5xl font-bold mb-4">
              ${budgetData.budget.total.toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-6 text-sm">
              {[
                { label: "Per Person", value: budgetData.budget.perPerson },
                { label: "Per Day", value: budgetData.budget.perDay },
                { label: "Duration", value: `${budgetData.tripInfo.duration} days` },
                { label: "Travelers", value: budgetData.tripInfo.travelers },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-indigo-200">{item.label}</p>
                  <p className="text-lg font-semibold">
                    {typeof item.value === "number"
                      ? `$${Math.round(item.value).toLocaleString()}`
                      : item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget Distribution + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pie Chart */}
        <div
          className={`rounded-xl p-6 shadow-sm ${
            theme === "dark" ? "bg-gray-900" : "bg-white"
          }`}
        >
          <h2 className="text-xl font-bold mb-6">Budget Distribution</h2>
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
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor:
                    theme === "dark" ? "#1f2937" : "white",
                  borderRadius: "0.5rem",
                  border: "none",
                  color: theme === "dark" ? "#e5e7eb" : "#111827",
                }}
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div
          className={`rounded-xl p-6 shadow-sm ${
            theme === "dark" ? "bg-gray-900" : "bg-white"
          }`}
        >
          <h2 className="text-xl font-bold mb-6">Category Breakdown</h2>
          <div className="space-y-4">
            {chartData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${item.value.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">{item.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Items */}
      <div
        className={`rounded-xl p-6 shadow-sm ${
          theme === "dark" ? "bg-gray-900" : "bg-white"
        }`}
      >
        <h2 className="text-xl font-bold mb-6">Detailed Budget Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={theme === "dark" ? "border-gray-700" : "border-gray-200"}>
              <tr>
                {["Category", "Item", "Estimated", "Actual", "Status", "Difference"].map((col) => (
                  <th
                    key={col}
                    className="py-3 px-4 text-sm font-semibold text-left"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={theme === "dark" ? "divide-gray-800" : "divide-gray-100 divide-y"}>
              {budgetItems.map((item) => {
                const difference = item.actual_amount - item.estimated_amount;
                const isOverBudget = difference > 0;

                return (
                  <tr
                    key={item.id}
                    className={`hover:${
                      theme === "dark" ? "bg-gray-800" : "bg-gray-50"
                    }`}
                  >
                    <td className="py-3 px-4">{CATEGORY_ICONS[item.category] || "📌"}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{item.item_name}</p>
                      {item.notes && (
                        <p className="text-sm text-gray-500">{item.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${item.estimated_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${item.actual_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          item.status
                        )}`}
                      >
                        {getStatusIcon(item.status)}
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {difference !== 0 && (
                        <div
                          className={`flex items-center justify-end gap-1 ${
                            isOverBudget ? "text-red-500" : "text-green-500"
                          }`}
                        >
                          {isOverBudget ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
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

      {/* Tips */}
      {budgetData.recommendations.length > 0 && (
        <div
          className={`rounded-xl p-6 ${
            theme === "dark"
              ? "bg-gray-900 text-gray-100 border border-gray-800"
              : "bg-gray-50 text-gray-800 border border-gray-200"
          }`}
        >
          <div className="flex items-start gap-4">
            <Lightbulb className="w-6 h-6 text-yellow-500 mt-1" />
            <div>
              <h2 className="text-xl font-bold mb-4">💡 Budget Tips</h2>
              <ul className="space-y-2">
                {budgetData.recommendations.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">•</span>
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