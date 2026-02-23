import React, { useState, useEffect } from 'react';
import { CardData, EventGroup } from '../types';
import { X, GripVertical, Play, CheckCircle, Circle, Clock, Filter, Square } from 'lucide-react';

interface TaskOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardData[];
  events?: EventGroup[];
  isRoutineActive?: boolean;
  onReorder: (newOrder: CardData[]) => void;
  onStart: (orderedList?: CardData[]) => void;
  onStop?: () => void;
}

const TaskOrderModal: React.FC<TaskOrderModalProps> = ({ 
    isOpen, 
    onClose, 
    cards, 
    events = [], 
    isRoutineActive = false,
    onReorder, 
    onStart,
    onStop 
}) => {
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [localCards, setLocalCards] = useState<CardData[]>(cards);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  // Sync local state when prop changes, provided we aren't dragging
  useEffect(() => {
    if (draggedItemIndex === null) {
        if (selectedEventId === 'all') {
            setLocalCards(cards);
        } else {
            const evt = events.find(e => e.id === selectedEventId);
            if (evt) {
                // Filter and keep relative order
                const filtered = cards.filter(c => evt.cardIds.includes(c.id));
                setLocalCards(filtered);
            } else {
                setLocalCards([]);
            }
        }
    }
  }, [cards, draggedItemIndex, selectedEventId, events]);

  if (!isOpen) return null;

  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    // Reorder locally for visual feedback
    const newCards = [...localCards];
    const draggedItem = newCards[draggedItemIndex];
    newCards.splice(draggedItemIndex, 1);
    newCards.splice(index, 0, draggedItem);
    
    setLocalCards(newCards);
    setDraggedItemIndex(index);
  };

  const handleDrop = () => {
    setDraggedItemIndex(null);
    // If we are in 'all' mode, we can persist the reorder globally immediately if we want,
    // but typically we wait for 'Start'. However, standard drag-sort UX implies immediate save.
    // For specific event view, we probably don't want to reorder the *global* list until start.
  };

  const handleStartClick = () => {
      onStart(localCards);
  };

  const pendingCount = localCards.filter(c => c.status !== 'completed' && c.status !== 'skipped').length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-white/10 rounded-xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex flex-col gap-3 bg-dark-900 rounded-t-xl">
          <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Task Order
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
          </div>
          
          {/* Event Selector */}
          <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <select 
                className="w-full bg-dark-800 border border-gray-700 rounded p-2 pl-9 text-xs text-white focus:outline-none focus:border-blue-500"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                  <option value="all">All Cards</option>
                  {events.map(evt => (
                      <option key={evt.id} value={evt.id}>Event: {evt.title}</option>
                  ))}
              </select>
          </div>
          <p className="text-xs text-gray-400">{pendingCount} tasks remaining in this list</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {localCards.map((card, index) => (
                <div 
                    key={card.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDrop}
                    className={`
                        flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-dark-700 select-none cursor-grab active:cursor-grabbing transition-colors
                        ${card.status === 'completed' ? 'opacity-60 border-green-900 bg-green-900/10' : card.status === 'skipped' ? 'opacity-50 border-red-900' : 'hover:border-blue-500/50'}
                        ${draggedItemIndex === index ? 'opacity-50 ring-2 ring-blue-500' : ''}
                    `}
                >
                    <div className="text-gray-500 cursor-grab">
                        <GripVertical size={16} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                             <h3 className={`font-medium truncate ${card.status === 'completed' ? 'text-green-400 line-through' : card.status === 'skipped' ? 'text-red-400 line-through' : 'text-white'}`}>
                                 {card.title}
                             </h3>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                             {card.status === 'active' && <span className="text-blue-400 flex items-center gap-1"><Clock size={10} /> Running</span>}
                             <span>{Math.floor(card.timerTotal / 60)}m</span>
                        </div>
                    </div>

                    <div>
                        {card.status === 'completed' ? (
                            <CheckCircle size={20} className="text-green-500" />
                        ) : card.status === 'active' ? (
                            <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                        ) : card.status === 'skipped' ? (
                             <div className="text-red-500 text-xs">Skip</div>
                        ) : (
                            <Circle size={20} className="text-gray-600" />
                        )}
                    </div>
                </div>
            ))}
            
            {localCards.length === 0 && (
                <div className="text-center text-gray-500 mt-10 p-4 border-2 border-dashed border-gray-700 rounded-lg">
                    No cards found.
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-dark-900 rounded-b-xl space-y-2">
             <button 
                onClick={handleStartClick}
                disabled={pendingCount === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02]"
             >
                 <Play size={20} fill="currentColor" />
                 {pendingCount === 0 ? 'All Tasks Finished' : isRoutineActive ? 'Restart Routine' : 'Start / Focus Routine'}
             </button>
             
             {isRoutineActive && onStop && (
                 <button 
                    onClick={onStop}
                    className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-200 hover:text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
                 >
                     <Square size={16} fill="currentColor" /> Stop Routine
                 </button>
             )}

             <p className="text-[10px] text-center text-gray-500 mt-2">
                 Starts Focus Mode with the filtered list above.
             </p>
        </div>

      </div>
    </div>
  );
};

export default TaskOrderModal;