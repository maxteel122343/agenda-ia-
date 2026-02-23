import React from 'react';
import { X, FileText, CheckCircle, Clock, BrainCircuit } from 'lucide-react';
import { CardData } from '../types';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardData[];
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose, cards }) => {
  if (!isOpen) return null;

  const completedCards = cards.filter(c => c.status === 'completed').sort((a, b) => (b.lastCompleted || 0) - (a.lastCompleted || 0));
  const aiNotes = cards.filter(c => c.type === 'note' && c.tags?.includes('ai-log')).sort((a, b) => (b.metrics?.[0]?.actualTime || 0) - (a.metrics?.[0]?.actualTime || 0));

  return (
    <div className="fixed inset-y-0 right-0 z-[60] w-96 bg-dark-900 border-l border-white/10 shadow-2xl transform transition-transform duration-300 flex flex-col">
      
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-dark-800">
        <h2 className="text-lg font-bold flex items-center gap-2 text-white">
          <HistoryIcon /> History & Insights
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition">
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Completed Tasks Section */}
        <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" /> Completed Tasks ({completedCards.length})
            </h3>
            <div className="space-y-2">
                {completedCards.length === 0 ? (
                    <p className="text-sm text-gray-600 italic">No completed tasks yet.</p>
                ) : (
                    completedCards.map(card => (
                        <div key={card.id} className="bg-dark-800 p-3 rounded border border-white/5 hover:border-white/10 transition">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-sm font-medium text-gray-200 line-clamp-1">{card.title}</span>
                                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                    {card.lastCompleted ? new Date(card.lastCompleted).toLocaleDateString() : '-'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2 mb-2">{card.description}</p>
                            <div className="flex gap-2 text-[10px] text-gray-600">
                                <span className="flex items-center gap-1"><Clock size={10} /> {Math.round(card.timerTotal / 60)}m</span>
                                {card.intervals && <span className="flex items-center gap-1"><BrainCircuit size={10} /> {card.intervals.count} int</span>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* AI Thoughts Section */}
        <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BrainCircuit size={14} className="text-purple-500" /> AI Thought Logs
            </h3>
            <div className="space-y-2">
                {aiNotes.length === 0 ? (
                    <p className="text-sm text-gray-600 italic">No AI insights recorded yet.</p>
                ) : (
                    aiNotes.map(note => (
                        <div key={note.id} className="bg-purple-900/10 p-3 rounded border border-purple-500/20 hover:border-purple-500/40 transition">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-sm font-medium text-purple-300 line-clamp-1">{note.title}</span>
                            </div>
                            <p className="text-xs text-gray-400 whitespace-pre-wrap">{note.description}</p>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

const HistoryIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <path d="M12 7v5l4 2" />
    </svg>
);

export default HistoryPanel;
