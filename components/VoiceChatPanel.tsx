import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Send, AudioLines, MessageSquare } from 'lucide-react';

interface VoiceChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    isActive: boolean;
    onToggleSession: () => void;
    messages: Array<{ id: string; text: string; isUser: boolean; timestamp: number }>;
}

export default function VoiceChatPanel({ isOpen, onClose, isActive, onToggleSession, messages }: VoiceChatPanelProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    if (!isOpen) return null;

    return (
        <div className="absolute right-0 top-0 h-full w-96 bg-gray-900/95 border-l border-white/10 shadow-2xl z-50 flex flex-col backdrop-blur-md animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-800 text-gray-400'}`}>
                        <AudioLines size={20} className={isActive ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Voice Chat</h3>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                            {isActive ? (
                                <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Live Connection Active
                                </>
                            ) : (
                                "Disconnected"
                            )}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                    <X size={20} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center p-8 opacity-50">
                        <AudioLines size={48} className="mb-4 text-gray-700" />
                        <p className="text-sm">Start the session and speak naturally.</p>
                        <p className="text-xs mt-2">Your conversation will appear here.</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div 
                            key={msg.id} 
                            className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                        >
                            <div 
                                className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                                    msg.isUser 
                                        ? 'bg-blue-600/80 text-white rounded-tr-none' 
                                        : 'bg-gray-800/80 text-gray-200 rounded-tl-none border border-white/5'
                                }`}
                            >
                                {msg.text}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Controls */}
            <div className="p-4 border-t border-white/10 bg-black/40">
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={onToggleSession}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all transform hover:scale-105 shadow-lg ${
                            isActive 
                                ? 'bg-red-500 text-white shadow-red-500/20 hover:bg-red-600' 
                                : 'bg-white text-black shadow-white/10 hover:bg-gray-200'
                        }`}
                    >
                        {isActive ? <MicOff size={28} /> : <Mic size={28} />}
                    </button>
                </div>
                <p className="text-center text-xs text-gray-500 mt-4 font-mono">
                    {isActive ? "Listening..." : "Tap mic to start"}
                </p>
            </div>
        </div>
    );
}
