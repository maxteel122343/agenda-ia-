import React, { useState, useEffect } from 'react';
import { X, Wand2, Clock, Layers, Timer, History, ArrowRight } from 'lucide-react';
import { CardData } from '../types';

interface TimerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardData;
  onUpdate: (updates: Partial<CardData>) => void;
  onAiOptimize: (cardId: string) => void;
  isAiOptimizing: boolean;
}

const TimerSettingsModal: React.FC<TimerSettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  card, 
  onUpdate, 
  onAiOptimize,
  isAiOptimizing 
}) => {
  const [duration, setDuration] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [preTime, setPreTime] = useState(card.preTimeSeconds || 0);
  const [postTime, setPostTime] = useState(card.postTimeSeconds || 0);
  const [intervals, setIntervals] = useState({ 
    count: card.intervals?.count || 0, 
    duration: (card.intervals?.duration || 0) / 60 // Display in minutes
  });

  useEffect(() => {
    if (isOpen) {
      const totalSeconds = card.timerTotal;
      const days = Math.floor(totalSeconds / (24 * 3600));
      const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setDuration({ days, hours, minutes, seconds });
      
      setPreTime(card.preTimeSeconds || 0);
      setPostTime(card.postTimeSeconds || 0);
      setIntervals({ 
        count: card.intervals?.count || 0, 
        duration: (card.intervals?.duration || 0) / 60 
      });
    }
  }, [isOpen, card]);

  const handleSave = () => {
    const totalSeconds = 
      (duration.days * 24 * 3600) + 
      (duration.hours * 3600) + 
      (duration.minutes * 60) + 
      duration.seconds;

    onUpdate({
      timerTotal: totalSeconds,
      timerRemaining: totalSeconds, // Reset remaining when total changes
      preTimeSeconds: preTime,
      postTimeSeconds: postTime,
      intervals: intervals.count > 0 ? {
        count: intervals.count,
        duration: intervals.duration * 60 // Convert back to seconds
      } : undefined
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-dark-800 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-dark-900/50">
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <Timer className="text-blue-400" size={20} /> Timer Configuration
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
            
            {/* AI Optimization Section */}
            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg flex items-center justify-between">
                <div>
                    <h3 className="text-purple-300 font-bold text-sm flex items-center gap-2">
                        <Wand2 size={14} /> AI Optimization
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-[250px]">
                        Analyze history and content to set ideal times.
                    </p>
                </div>
                <button 
                    onClick={() => onAiOptimize(card.id)}
                    disabled={isAiOptimizing}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded shadow-lg shadow-purple-900/20 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isAiOptimizing ? <Wand2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    {isAiOptimizing ? 'Analyzing...' : 'Magic Optimize'}
                </button>
            </div>

            {/* Total Duration */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Duration</label>
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { label: 'Days', key: 'days', max: 30 },
                        { label: 'Hours', key: 'hours', max: 23 },
                        { label: 'Mins', key: 'minutes', max: 59 },
                        { label: 'Secs', key: 'seconds', max: 59 }
                    ].map(({ label, key, max }) => (
                        <div key={key} className="bg-dark-900/50 p-2 rounded border border-white/5 flex flex-col items-center">
                            <input 
                                type="number" 
                                min="0" 
                                max={max}
                                value={(duration as any)[key]}
                                onChange={(e) => setDuration(prev => ({ ...prev, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                className="bg-transparent text-center text-xl font-mono font-bold w-full focus:outline-none text-white"
                            />
                            <span className="text-[10px] text-gray-500 uppercase">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Pre-Time */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <ArrowRight size={12} className="text-yellow-500" /> Pre-Time (Sec)
                    </label>
                    <input 
                        type="number"
                        min="0"
                        value={preTime}
                        onChange={(e) => setPreTime(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-dark-900/50 border border-white/5 rounded p-2 text-white font-mono focus:border-blue-500/50 focus:outline-none transition"
                    />
                </div>

                {/* Post-Time */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <History size={12} className="text-green-500" /> Post-Time (Sec)
                    </label>
                    <input 
                        type="number"
                        min="0"
                        value={postTime}
                        onChange={(e) => setPostTime(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-dark-900/50 border border-white/5 rounded p-2 text-white font-mono focus:border-blue-500/50 focus:outline-none transition"
                    />
                </div>
            </div>

            {/* Intervals */}
            <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Layers size={12} className="text-blue-400" /> Intervals
                </label>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-[10px] text-gray-500 block mb-1">Count</span>
                        <input 
                            type="number"
                            min="0"
                            value={intervals.count}
                            onChange={(e) => setIntervals(prev => ({ ...prev, count: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-full bg-dark-900/50 border border-white/5 rounded p-2 text-white font-mono focus:border-blue-500/50 focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <span className="text-[10px] text-gray-500 block mb-1">Duration (Minutes)</span>
                        <input 
                            type="number"
                            min="0"
                            value={intervals.duration}
                            onChange={(e) => setIntervals(prev => ({ ...prev, duration: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-full bg-dark-900/50 border border-white/5 rounded p-2 text-white font-mono focus:border-blue-500/50 focus:outline-none transition"
                        />
                    </div>
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-dark-900/50 flex justify-end gap-2">
            <button 
                onClick={onClose}
                className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
                Cancel
            </button>
            <button 
                onClick={handleSave}
                className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20 transition"
            >
                Save Configuration
            </button>
        </div>
      </div>
    </div>
  );
};

export default TimerSettingsModal;
