import React, { useEffect, useRef } from 'react';
import { X, Mic, MicOff, Video, VideoOff, Eye } from 'lucide-react';

interface VisionModeProps {
    stream: MediaStream | null;
    isActive: boolean;
    onClose: () => void;
    onToggleMic: () => void;
    isMicOn: boolean;
}

export default function VisionMode({ stream, isActive, onClose, onToggleMic, isMicOn }: VisionModeProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl aspect-video bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5">
                {stream ? (
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        muted 
                        playsInline 
                        className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        <p className="font-mono text-sm tracking-widest uppercase">Initializing Optical Sensors...</p>
                    </div>
                )}
                
                {/* HUD Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Corners */}
                    <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-blue-500/50 rounded-tl-lg" />
                    <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-blue-500/50 rounded-tr-lg" />
                    <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-blue-500/50 rounded-bl-lg" />
                    <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-blue-500/50 rounded-br-lg" />
                    
                    {/* Center Crosshair */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-20">
                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white" />
                        <div className="absolute left-1/2 top-0 h-full w-[1px] bg-white" />
                    </div>
                </div>

                {/* Controls Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Eye className="text-blue-400" size={24} />
                            <h2 className="text-3xl font-bold text-white tracking-tight">Chronos Vision</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                            <p className="text-blue-200/80 font-mono text-sm">
                                {isActive ? "ANALYZING BEHAVIOR & CONTEXT" : "ESTABLISHING LINK..."}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 pointer-events-auto">
                        <button 
                            onClick={onToggleMic}
                            className={`p-4 rounded-full transition backdrop-blur-md border ${isMicOn ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-red-500/80 border-red-500 text-white hover:bg-red-600/80'}`}
                        >
                            {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-4 rounded-full bg-white text-black hover:bg-gray-200 transition shadow-lg shadow-white/10"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 flex items-center gap-6 text-gray-400 max-w-2xl text-center font-light">
                <p>
                    <span className="text-blue-400 font-medium">Tip:</span> Chronos can see if you're distracted, holding objects, or just chilling. Try showing her a task list or asking "What do you think of my setup?"
                </p>
            </div>
        </div>
    );
}
