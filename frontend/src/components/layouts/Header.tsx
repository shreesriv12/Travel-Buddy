"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaUserCircle } from 'react-icons/fa';
import { useState, useEffect } from 'react';

const Header = () => {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState('Guest');
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    // This runs only on the client side
    const userId = localStorage.getItem('userId');
    if (userId) {
      setCurrentUserId(userId.substring(0, 8) + '...'); // Show a truncated ID or name
    }
    setIsClient(true);
  }, []);

  const handleLogout = () => {
    // Clear user session/token and ID
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setCurrentUserId('Guest');
    console.log('User logged out');
    router.push('/login');
  };

  return (
    <header className="bg-white shadow-md p-4 flex justify-between items-center z-10">
      <Link href="/dashboard" className="text-xl font-bold text-blue-600">
        AI Trip Planner
      </Link>
      <div className="flex items-center space-x-4">
        {isClient && currentUserId !== 'Guest' && (
          <span className="text-gray-700 font-medium hidden sm:inline">User: {currentUserId}</span>
        )}
        <FaUserCircle size={32} className="text-gray-500" />
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
