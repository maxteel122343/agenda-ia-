import React, { useState } from 'react';
import { CardData, EventGroup } from '../types';
import { Plus, X, Folder, Check } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CardData[];
  events: EventGroup[];
  onSaveEvent: (event: EventGroup) => void;
}

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, cards, events, onSaveEvent }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!newEventTitle.trim()) return;
    const newEvent: EventGroup = {
      id: crypto.randomUUID(),
      title: newEventTitle,
      cardIds: Array.from(selectedCardIds)
    };
    onSaveEvent(newEvent);
    setNewEventTitle('');
    setSelectedCardIds(new Set());
    setActiveTab('list');
  };

  const toggleCardSelection = (id: string) => {
    const newSet = new Set(selectedCardIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCardIds(newSet);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-white/10 rounded-xl w-full max-w-md h-[600px] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-dark-900 rounded-t-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Folder className="text-blue-500" /> Event Manager
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex border-b border-white/10">
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex-1 p-3 text-sm font-medium transition ${activeTab === 'list' ? 'bg-white/5 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-white/5'}`}
          >
            My Events
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={`flex-1 p-3 text-sm font-medium transition ${activeTab === 'create' ? 'bg-white/5 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-white/5'}`}
          >
            Create New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'list' ? (
            <div className="space-y-3">
              {events.length === 0 && (
                <div className="text-center text-gray-500 mt-10">No events created yet.</div>
              )}
              {events.map(evt => (
                <div key={evt.id} className="bg-dark-700 p-3 rounded-lg border border-white/5 hover:border-blue-500/50 transition">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-white">{evt.title}</h3>
                    <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full">{evt.cardIds.length} cards</span>
                  </div>
                  <div className="text-xs text-gray-400 flex flex-wrap gap-1">
                    {evt.cardIds.slice(0, 3).map(cid => {
                        const c = cards.find(x => x.id === cid);
                        return c ? <span key={cid} className="bg-black/30 px-1 rounded">{c.title}</span> : null;
                    })}
                    {evt.cardIds.length > 3 && <span>+{evt.cardIds.length - 3} more</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Event Name</label>
                <input 
                  className="w-full bg-dark-900 border border-gray-600 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Morning Routine"
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                />
              </div>
              
              <div className="flex-1 overflow-hidden flex flex-col">
                <label className="text-xs text-gray-400 block mb-1">Select Cards to Include</label>
                <div className="flex-1 overflow-y-auto space-y-2 bg-dark-900 p-2 rounded border border-gray-700">
                  {cards.map(card => (
                    <div 
                      key={card.id} 
                      onClick={() => toggleCardSelection(card.id)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${selectedCardIds.has(card.id) ? 'bg-blue-600/20 border border-blue-500' : 'hover:bg-white/5 border border-transparent'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedCardIds.has(card.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                        {selectedCardIds.has(card.id) && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-sm truncate">{card.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleCreate}
                disabled={!newEventTitle || selectedCardIds.size === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 rounded flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Save Event
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventModal;