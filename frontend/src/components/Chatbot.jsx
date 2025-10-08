'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Loader2, Search, Link } from 'lucide-react';

// Define the model name and API endpoint
const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Helper for Exponential Backoff (crucial for API calls)
const fetchWithBackoff = async (url, options, maxRetries = 5) => {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status !== 429) { // Not a rate limit error
                return response;
            }
            // Rate limit hit, wait and retry
            console.warn(`Rate limit hit (429). Retrying in ${delay / 1000}s...`);
        } catch (error) {
            console.error("Fetch error, retrying:", error);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
    }
    throw new Error("API call failed after maximum retries.");
};

// Main Chatbot component
export default function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'model', text: 'Hello! I am your AI Travel Planner. Ask me anything about your next trip, itinerary ideas, or budget advice!', sources: [] }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isOpen]);

    /**
     * Calls the Gemini API to get a response for the user query, using Google Search grounding.
     */
    const callGeminiApi = async (userQuery) => {
        setIsLoading(true);
        const apiKey = ""; // Canvas environment handles the key
        const url = `${API_URL}?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}`;

        const systemPrompt = "You are a friendly, helpful, and concise travel planning and information assistant. Use up-to-date information when answering travel questions.";

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            tools: [{ "google_search": {} }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        try {
            const response = await fetchWithBackoff(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (!candidate || !candidate.content?.parts?.[0]?.text) {
                return { text: "Sorry, I couldn't generate a useful response right now.", sources: [] };
            }

            const text = candidate.content.parts[0].text;
            let sources = [];
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title)
                    .slice(0, 3); // Limit to 3 sources for clean display
            }
            
            return { text, sources };

        } catch (error) {
            console.error("Gemini API call failed:", error);
            return { text: "Oops! There was an error connecting to the AI. Please try again later.", sources: [] };
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        
        // 1. Add user message to chat
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);

        // 2. Get AI response
        const { text: modelText, sources } = await callGeminiApi(userMessage);

        // 3. Add model response to chat
        setMessages(prev => [...prev, { role: 'model', text: modelText, sources }]);
    };
    
    // --- UI Rendering ---

    const ChatBubble = ({ message }) => {
        const isUser = message.role === 'user';
        const bubbleClasses = isUser
            ? 'bg-blue-600 text-white rounded-tr-xl rounded-bl-xl rounded-tl-xl ml-auto'
            : 'bg-gray-100 text-gray-800 rounded-tl-xl rounded-br-xl rounded-tr-xl mr-auto';
        
        const sourcesClasses = isUser
            ? 'text-blue-200'
            : 'text-gray-500';

        return (
            <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
                <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 shadow-md transition-all duration-300 ${bubbleClasses}`}>
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    {message.sources && message.sources.length > 0 && (
                        <div className={`mt-2 pt-2 border-t border-opacity-20 ${isUser ? 'border-white' : 'border-gray-300'} text-xs space-y-1 ${sourcesClasses}`}>
                            <div className="flex items-center gap-1 font-semibold">
                                <Search className="w-3 h-3"/> Sources:
                            </div>
                            {message.sources.map((source, index) => (
                                <a 
                                    key={index} 
                                    href={source.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="block underline hover:opacity-80 transition"
                                >
                                    <Link className="inline w-3 h-3 mr-1 align-top" />{source.title}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
                aria-label={isOpen ? 'Close Chatbot' : 'Open Chatbot'}
            >
                {isOpen ? (
                    <X className="w-7 h-7" />
                ) : (
                    <MessageSquare className="w-7 h-7" />
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-4 w-[90vw] max-w-sm h-[70vh] max-h-[600px] bg-white rounded-xl shadow-2xl flex flex-col transition-all duration-300 transform scale-100 origin-bottom-right border border-gray-200">
                    {/* Chat Header */}
                    <div className="p-4 border-b border-gray-200 bg-blue-600 rounded-t-xl flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Travel Assistant AI</h2>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white hover:text-blue-100 transition p-1 rounded-full"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Message Area */}
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                        {messages.map((msg, index) => (
                            <ChatBubble key={index} message={msg} />
                        ))}
                        {isLoading && (
                            <div className="flex justify-start mb-4">
                                <div className="bg-gray-100 text-gray-800 rounded-tl-xl rounded-br-xl rounded-tr-xl p-3 shadow-md animate-pulse">
                                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin inline mr-2"/>
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about destinations or plans..."
                                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className={`p-3 rounded-lg flex items-center justify-center transition ${
                                    !input.trim() || isLoading
                                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                                aria-label="Send Message"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            
            {/* Custom scrollbar style for better visibility */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
            `}</style>
        </div>
    );
}
