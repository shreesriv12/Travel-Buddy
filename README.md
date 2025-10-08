# 🌍 Travel Buddy - AI-Powered Travel Assistant

A modern, full-stack travel planning application that helps users create personalized itineraries, manage budgets, and get AI-powered travel recommendations using Google's Gemini AI.

![Travel Planner](https://img.shields.io/badge/Next.js-13-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18-green?style=for-the-badge&logo=node.js)
![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748?style=for-the-badge&logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?style=for-the-badge&logo=tailwind-css)

## ✨ Features

### 🎯 Core Functionality
- **AI-Powered Trip Planning** - Generate complete itineraries using Gemini AI
- **Smart Budget Management** - Track expenses and manage travel budgets
- **Automated Recommendations** - Get personalized travel suggestions via email
- **Interactive Dashboard** - Beautiful overview of all your trips and activities
- **Real-time Chat Assistant** - AI travel assistant for instant help

### 🤖 AI Capabilities
- **Gemini AI Integration** - Advanced travel recommendations and itinerary generation
- **Smart Cron Jobs** - Automated email recommendations every 3 days
- **Context-Aware Chatbot** - Remembers conversation history and user preferences
- **Personalized Content** - Tailored suggestions based on travel history

### 🎨 User Experience
- **Modern UI/UX** - Clean, responsive design with Tailwind CSS
- **Dark/Light Mode** - Theme switching for comfortable viewing
- **Real-time Updates** - Live trip status and progress tracking
- **Mobile Responsive** - Works seamlessly across all devices

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL database
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/travel-planner.git
   cd travel-planner
   ```
2. **Install dependencies**
    ```bash
    # Frontend (Next.js)
    cd frontend
    npm install

    # Backend (Node.js)
    cd ../backend
    npm install
   ```

3. **Environment Setup**
    ```bash
    # Frontend (.env.local):
    NEXT_PUBLIC_GOOGLE_API_KEY=your_gemini_api_key_here
    NEXT_PUBLIC_API_URL=http://localhost:5000/api
    # Backend (.env):
    DATABASE_URL="postgresql://username:password@localhost:5432/travel_planner"
    GOOGLE_API_KEY=your_gemini_api_key_here
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_app_password
    JWT_SECRET=your_jwt_secret




    ```
4. **Database Setup**

    ```bash
    # Generate Prisma client
    npx prisma generate

    # Run migrations
    npx prisma db push

    # Seed sample data (optional)
    npx prisma db seed
    ```

4. **Start the application**
    ```bash
    # Start backend (from backend directory)
    npm run dev

    # Start frontend (from frontend directory, new terminal)
    npm run dev
    ```

### Project Structure

    
    travel-planner/
    ├── frontend/                 # Next.js React Application
    │   ├── src/
    │   │   ├── app/             # Next.js app router pages
    │   │   ├── components/      # React components
    │   │   │   ├── chatbot/     # AI chat interface
    │   │   │   ├── dashboard/   # Dashboard components
    │   │   │   └── ui/          # Reusable UI components
    │   │   ├── hooks/           # Custom React hooks
    │   │   ├── services/        # API services
    │   │   └── context/         # React context providers
    │   ├── public/              # Static assets
    │   └── package.json
    │
    ├── backend/                 # Node.js Express API
    │   ├── src/
    │   │   ├── controllers/     # Route controllers
    │   │   ├── services/        # Business logic
    │   │   │   ├── cronService.js    # Automated email jobs
    │   │   │   ├── emailService.js   # Email functionality
    │   │   │   └── recommendationService.js # AI recommendations
    │   │   ├── routes/          # API routes
    │   │   ├── middleware/      # Custom middleware
    │   │   ├── config/          # Database and app config
    │   │   └── utils/           # Utility functions
    │   ├── prisma/              # Database schema and migrations
    │   └── package.json
    │
    └── README.md
    
