import { useState, useRef, useEffect } from 'react';
import { useTripStore, useAuthStore } from '../store';
import type { Place } from '../store';
import { MessageSquare, X, Send, Plus, MapPin, Hotel, Loader2 } from 'lucide-react';

interface AIChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface AISuggestedPlace {
    id: string;
    name: string;
    description: string;
    lat: number;
    lng: number;
    type: 'attraction' | 'hotel';
}

interface AIChatResponse {
    text: string;
    suggested_places: AISuggestedPlace[];
}

export function AIAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<AIChatMessage[]>([
        { role: 'assistant', content: 'Hi! I am your AI travel assistant. How can I help you plan your trip today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<AISuggestedPlace[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeTripId = useAuthStore(state => state.activeTripId);
    const { addToTriplist, addToDayPlan, activeDayId, days } = useTripStore();
    const activeDay = days.find(d => d.id === activeDayId) || days[0];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, suggestions, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const newMessages = [...messages, { role: 'user' as const, content: input }];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);
        setSuggestions([]);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
            const response = await fetch(`${apiUrl}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: newMessages,
                    trip_id: activeTripId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get AI response');
            }

            const data: AIChatResponse = await response.json();

            setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
            if (data.suggested_places && data.suggested_places.length > 0) {
                setSuggestions(data.suggested_places);
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPlace = (suggestion: AISuggestedPlace, addToPlan: boolean) => {
        const place: Place = {
            id: suggestion.id,
            name: suggestion.name,
            description: suggestion.description,
            lat: suggestion.lat,
            lng: suggestion.lng,
            recommendedDuration: 60 // Mock default duration
        };

        if (addToPlan && activeDay) {
            addToDayPlan(activeDay.id, place);
            // Also add to triplist so it's available in saved places
            addToTriplist(place);
        } else {
            addToTriplist(place);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col h-[500px] transition-all transform origin-bottom-right">
                    {/* Header */}
                    <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-md z-10">
                        <div className="flex items-center space-x-2">
                            <MessageSquare className="w-5 h-5" />
                            <h3 className="font-semibold text-sm">AI Assistant</h3>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-blue-100 hover:text-white transition-colors p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                                    msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {/* Loading Indicator */}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-100 text-gray-500 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center space-x-2 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Thinking...</span>
                                </div>
                            </div>
                        )}

                        {/* Suggestions UI Cards */}
                        {suggestions.length > 0 && !isLoading && (
                            <div className="space-y-3 mt-4">
                                {suggestions.map((place) => (
                                    <div key={place.id} className="bg-white border border-blue-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-start space-x-3">
                                            <div className={`p-2 rounded-lg mt-0.5 ${place.type === 'hotel' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                {place.type === 'hotel' ? <Hotel className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-900 text-sm">{place.name}</h4>
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{place.description}</p>

                                                <div className="flex items-center space-x-2 mt-3">
                                                    <button
                                                        onClick={() => handleAddPlace(place, false)}
                                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center"
                                                    >
                                                        Save Place
                                                    </button>
                                                    <button
                                                        onClick={() => handleAddPlace(place, true)}
                                                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-1.5 px-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center"
                                                    >
                                                        <Plus className="w-3 h-3 mr-1" /> Add to Day
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Ask for places to visit..."
                                className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-full px-4 py-2 text-sm transition-all"
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white p-2 rounded-full transition-colors flex items-center justify-center"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Action Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center"
                >
                    <MessageSquare className="w-6 h-6" />
                </button>
            )}
        </div>
    );
}
