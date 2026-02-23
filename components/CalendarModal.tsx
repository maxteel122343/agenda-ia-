import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CardData, EventGroup, AiThought } from '../types';
import { Calendar as CalendarIcon, X, Wand2, Clock, ChevronLeft, ChevronRight, LayoutList, CalendarDays, Check, Shuffle, Layers, Timer, BrainCircuit, FileText, Trash2, CalendarCheck } from 'lucide-react';
import { scheduleTasks, analyzeScheduleDeeply } from '../services/geminiService';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventGroup[];
  cards: CardData[];
  onApplySchedule: (updates: Array<{ id: string; start: string; end: string }>) => void;
  onBatchUpdate?: (updates: { id: string, data: Partial<CardData> }[]) => void;
  onUnschedule?: (cardId: string) => void;
  scheduledCount?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, events, cards, onApplySchedule, onBatchUpdate, onUnschedule, scheduledCount = 0 }) => {
  const [activeTab, setActiveTab] = useState<'scheduler' | 'calendar'>('calendar');
  
  // View State
  const [currentDate, setCurrentDate] = useState(new Date()); // For month navigation
  const [selectedDate, setSelectedDate] = useState(new Date()); // Specifically selected day (for timeline)
  
  // Scheduling State
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [dailyStartTime, setDailyStartTime] = useState('09:00');
  const [dailyEndTime, setDailyEndTime] = useState('18:00');
  const [isScheduling, setIsScheduling] = useState(false);
  
  // New Scheduling Options
  const [mergeAgendas, setMergeAgendas] = useState(false);
  const [fixedDuration, setFixedDuration] = useState<string>(''); // Empty = use card duration
  
  // Deep Thinking Mode
  const [isDeepThinkingMode, setIsDeepThinkingMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);

  // Scroll to 8 AM on mount/tab change
  useEffect(() => {
    if (activeTab === 'calendar' && timelineRef.current) {
        timelineRef.current.scrollTop = 480; // 8 hours * 60px
    }
  }, [activeTab, isOpen]);

  if (!isOpen) return null;

  // --- Logic ---

  const handleDateClick = (date: Date) => {
    // Always update the view to the clicked date
    setSelectedDate(date);

    // If an event is selected, we are in "Range Selection Mode"
    if (selectedEventId) {
        // If we have a full range or no start, reset and start new range
        if (!rangeStart || (rangeStart && rangeEnd)) {
            setRangeStart(date);
            setRangeEnd(null);
        } else {
            // We have a start, so this is the end
            if (date < rangeStart) {
                setRangeEnd(rangeStart);
                setRangeStart(date);
            } else {
                setRangeEnd(date);
            }
        }
    }
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const handleApplySchedule = async () => {
    if (!selectedEventId || !rangeStart) return;

    const event = events.find(e => e.id === selectedEventId);
    if (!event) return;

    // 1. Prepare New Tasks
    const durationOverride = fixedDuration ? parseInt(fixedDuration) : null;
    
    const newTasksToSchedule = event.cardIds
      .map(id => cards.find(c => c.id === id))
      .filter(c => c !== undefined)
      .map(c => ({
        id: c!.id,
        title: c!.title,
        durationMinutes: durationOverride || Math.ceil(c!.timerTotal / 60) || 60
      }));

    if (newTasksToSchedule.length === 0) return;

    setIsScheduling(true);

    // --- DEEP THINKING ANALYSIS ---
    if (isDeepThinkingMode && onBatchUpdate) {
        setIsAnalyzing(true);
        // Identify which cards are being scheduled to analyze them
        const relevantCards = cards.filter(c => event.cardIds.includes(c.id));
        
        try {
            const thoughts = await analyzeScheduleDeeply(relevantCards);
            
            // Save thoughts to cards
            const thoughtUpdates = thoughts.map(t => {
                const card = cards.find(c => c.id === t.id);
                const currentThoughts = card?.aiThoughts || [];
                return {
                    id: t.id,
                    data: {
                        aiThoughts: [
                            ...currentThoughts,
                            { timestamp: Date.now(), content: t.thought }
                        ]
                    }
                };
            });
            onBatchUpdate(thoughtUpdates);
        } catch (e) {
            console.error("Deep thinking failed, proceeding with schedule.", e);
        }
        setIsAnalyzing(false);
    }
    // -----------------------------

    // 2. Define Time Window
    const rStart = rangeStart;
    const rEnd = rangeEnd || rangeStart;

    const startISO = new Date(rStart.getFullYear(), rStart.getMonth(), rStart.getDate(), parseInt(dailyStartTime.split(':')[0]), parseInt(dailyStartTime.split(':')[1])).toISOString();
    const endISO = new Date(rEnd.getFullYear(), rEnd.getMonth(), rEnd.getDate(), parseInt(dailyEndTime.split(':')[0]), parseInt(dailyEndTime.split(':')[1])).toISOString();

    // 3. Identify Existing "Busy" Slots
    // Find all cards that are currently scheduled within this window
    const windowStart = new Date(startISO);
    const windowEnd = new Date(endISO);

    const existingScheduledCards = cards.filter(c => {
        if (!c.scheduledStart || !c.scheduledEnd) return false;
        const cStart = new Date(c.scheduledStart);
        const cEnd = new Date(c.scheduledEnd);
        // Check overlap
        return (cStart < windowEnd && cEnd > windowStart);
    });

    const busySlots = existingScheduledCards.map(c => ({
        start: c.scheduledStart!,
        end: c.scheduledEnd!
    }));

    // 4. Handle "Merge" Logic
    let finalTasksToSchedule = newTasksToSchedule;
    let finalBusySlots = busySlots;

    if (mergeAgendas) {
        // MERGE: We treat existing tasks as tasks to be re-scheduled alongside new ones.
        // We clear busy slots because everything is fluid.
        const existingAsTasks = existingScheduledCards.map(c => ({
            id: c.id,
            title: c.title,
            durationMinutes: Math.ceil((new Date(c.scheduledEnd!).getTime() - new Date(c.scheduledStart!).getTime()) / 60000)
        }));
        
        // Combine lists (avoid duplicates if event contains already scheduled cards)
        const combinedMap = new Map();
        [...existingAsTasks, ...newTasksToSchedule].forEach(t => combinedMap.set(t.id, t));
        finalTasksToSchedule = Array.from(combinedMap.values());
        
        finalBusySlots = []; // No busy slots, full reorganization
    }

    // 5. Call AI
    const schedule = await scheduleTasks(
        finalTasksToSchedule, 
        startISO, 
        endISO, 
        finalBusySlots
    );
    
    onApplySchedule(schedule);
    setIsScheduling(false);
    
    // Clear selection after scheduling
    setSelectedEventId('');
    setRangeStart(null);
    setRangeEnd(null);
    setMergeAgendas(false);
  };

  // --- Calendar Helpers ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay, year, month };
  };

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
  };

  const getDailyEvents = () => {
    return cards.filter(card => {
        if (!card.scheduledStart) return false;
        const start = new Date(card.scheduledStart);
        return isSameDay(start, selectedDate);
    });
  };

  // Get all upcoming scheduled cards for the sidebar list
  const allScheduledCards = useMemo(() => {
      return cards
        .filter(c => c.scheduledStart)
        .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());
  }, [cards]);

  const { days, firstDay, year, month } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const dailyEvents = getDailyEvents();

  const getEventStyle = (card: CardData) => {
      if (!card.scheduledStart || !card.scheduledEnd) return {};
      const start = new Date(card.scheduledStart);
      const end = new Date(card.scheduledEnd);
      
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      
      return {
          top: `${startMinutes}px`, // 1px per minute
          height: `${Math.max(20, durationMinutes)}px`
      };
  };

  const colorStyles: Record<string, string> = {
      red: 'bg-red-600/80 border-red-400',
      yellow: 'bg-yellow-600/80 border-yellow-400 text-black',
      purple: 'bg-purple-600/80 border-purple-400',
      blue: 'bg-blue-600/80 border-blue-400',
      green: 'bg-green-600/80 border-green-400',
  };

  // Render History Modal
  const renderHistoryModal = () => {
      if (!showHistoryModal) return null;
      
      const allThoughts = cards
        .filter(c => c.aiThoughts && c.aiThoughts.length > 0)
        .flatMap(c => c.aiThoughts!.map(t => ({...t, cardTitle: c.title})))
        .sort((a, b) => b.timestamp - a.timestamp);

      return (
          <div className="absolute inset-0 bg-dark-900/95 z-50 flex flex-col p-6 animate-in fade-in">
              <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold flex items-center gap-2 text-purple-400">
                       <BrainCircuit /> Global Thought History
                   </h3>
                   <button onClick={() => setShowHistoryModal(false)}><X className="text-gray-400 hover:text-white" /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                  {allThoughts.length === 0 ? (
                      <div className="text-gray-500 italic">No Deep Thinking analysis recorded yet. Activate the toggle and schedule tasks.</div>
                  ) : (
                      allThoughts.map((thought, i) => (
                          <div key={i} className="bg-dark-800 p-4 rounded border border-white/10">
                              <div className="flex justify-between text-xs text-gray-500 mb-2">
                                  <span className="font-bold text-white uppercase">{thought.cardTitle}</span>
                                  <span>{new Date(thought.timestamp).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-gray-300 leading-relaxed font-mono whitespace-pre-wrap">
                                  {thought.content}
                              </p>
                          </div>
                      ))
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-white/10 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-dark-900">
          <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CalendarIcon className="text-green-500" /> Calendar & AI Schedule
              </h2>
              <div className="flex bg-dark-800 rounded p-1 border border-white/5">
                  <button 
                    onClick={() => setActiveTab('calendar')}
                    className={`px-3 py-1 text-xs rounded transition flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                      <CalendarDays size={14} /> Calendar View
                  </button>
                  <button 
                    onClick={() => setActiveTab('scheduler')}
                    className={`px-3 py-1 text-xs rounded transition flex items-center gap-2 ${activeTab === 'scheduler' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                      <LayoutList size={14} /> Manual Planner
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="px-2 py-1 ml-1 text-xs rounded transition flex items-center gap-2 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 relative group"
                    title="View Deep Thinking History"
                  >
                     <FileText size={14} /> History
                     {scheduledCount > 0 && (
                         <span className="ml-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                             {scheduledCount}
                         </span>
                     )}
                  </button>
              </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex relative">
            {renderHistoryModal()}

            {/* --- CALENDAR VIEW --- */}
            {activeTab === 'calendar' && (
                <div className="flex w-full h-full">
                    {/* Left: Sidebar (Month Navigator & Scheduler Controls) */}
                    <div className="w-80 border-r border-white/10 flex flex-col bg-dark-900/80 backdrop-blur">
                        
                        {/* Month Nav */}
                        <div className="p-4 flex items-center justify-between border-b border-white/5">
                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded"><ChevronLeft size={16} /></button>
                            <span className="font-bold text-lg">{monthName} {year}</span>
                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded"><ChevronRight size={16} /></button>
                        </div>
                        
                        {/* Grid */}
                        <div className="p-4">
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {WEEKDAYS.map(d => <div key={d} className="text-center text-xs text-gray-500 font-bold">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                                {Array.from({ length: days }).map((_, i) => {
                                    const d = i + 1;
                                    const dateObj = new Date(year, month, d);
                                    
                                    const isViewSelected = isSameDay(dateObj, selectedDate);
                                    const isToday = isSameDay(dateObj, new Date());
                                    const hasEvents = cards.some(c => c.scheduledStart && isSameDay(new Date(c.scheduledStart), dateObj));

                                    // Range Logic
                                    const isStart = rangeStart && isSameDay(dateObj, rangeStart);
                                    const isEnd = rangeEnd && isSameDay(dateObj, rangeEnd);
                                    const isInRange = rangeStart && rangeEnd && dateObj > rangeStart && dateObj < rangeEnd;
                                    const isRangeSelected = isStart || isEnd || isInRange;

                                    return (
                                        <button
                                            key={d}
                                            onClick={() => handleDateClick(dateObj)}
                                            className={`
                                                h-9 w-9 rounded-full flex items-center justify-center text-sm relative transition-all duration-200
                                                ${isRangeSelected && !isStart && !isEnd ? 'bg-blue-900/30 text-blue-200 rounded-none' : ''}
                                                ${isStart || isEnd ? 'bg-blue-600 text-white font-bold scale-110 shadow-lg shadow-blue-500/50 z-10' : ''}
                                                ${isViewSelected && !isRangeSelected ? 'bg-green-600 text-white font-bold' : ''}
                                                ${!isViewSelected && !isRangeSelected ? 'hover:bg-white/10 text-gray-300' : ''}
                                                ${isToday && !isViewSelected && !isRangeSelected ? 'border border-green-500 text-green-500' : ''}
                                            `}
                                        >
                                            {d}
                                            {hasEvents && !isViewSelected && !isRangeSelected && (
                                                <div className="absolute bottom-1 w-1 h-1 bg-green-400 rounded-full" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* --- UPCOMING SCHEDULES / MANAGEMENT LIST --- */}
                        <div className="flex-1 overflow-y-auto border-t border-white/5">
                            <div className="p-3 bg-dark-800 sticky top-0 border-b border-white/5 flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400 flex items-center gap-2">
                                    <CalendarCheck size={12} /> Active Schedules
                                </span>
                                <span className="text-[10px] text-gray-500">{allScheduledCards.length} items</span>
                            </div>
                            <div className="p-2 space-y-1">
                                {allScheduledCards.map(c => {
                                    const start = new Date(c.scheduledStart!);
                                    return (
                                        <div key={c.id} className="group flex items-center justify-between p-2 rounded bg-dark-800/50 hover:bg-dark-800 border border-transparent hover:border-white/10 transition-colors">
                                            <div className="min-w-0">
                                                <div className="text-xs text-white truncate font-medium">{c.title}</div>
                                                <div className="text-[10px] text-gray-500">
                                                    {start.toLocaleDateString()} {start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                            {onUnschedule && (
                                                <button 
                                                    onClick={() => onUnschedule(c.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded transition-all"
                                                    title="Remove from Calendar"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                {allScheduledCards.length === 0 && (
                                    <div className="text-center py-4 text-xs text-gray-600">No events scheduled.</div>
                                )}
                            </div>
                        </div>

                        {/* --- SCHEDULER CONTROLS --- */}
                        <div className="bg-dark-800 p-4 border-t border-white/10">
                            <div className="text-xs text-gray-400 mb-3 font-bold flex items-center gap-2">
                                <Wand2 size={12} className="text-blue-400" />
                                AI SCHEDULER
                            </div>
                            
                            {/* 1. Select Event */}
                            <div className="mb-3">
                                <select 
                                    className="w-full bg-dark-900 border border-gray-600 rounded p-2 text-xs text-white focus:border-blue-500 outline-none"
                                    value={selectedEventId}
                                    onChange={e => {
                                        setSelectedEventId(e.target.value);
                                        // Reset range when changing event to avoid confusion
                                        setRangeStart(null);
                                        setRangeEnd(null);
                                    }}
                                >
                                    <option value="">-- Select Event to Schedule --</option>
                                    {events.map(e => (
                                        <option key={e.id} value={e.id}>{e.title}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedEventId && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
                                    <div className="text-[10px] text-gray-400">
                                        {!rangeStart ? "Select Start Date above" : !rangeEnd ? "Select End Date above" : "Range Selected"}
                                    </div>
                                    
                                    {/* Time Inputs */}
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <span className="text-[10px] text-gray-500 block">Start Time</span>
                                            <input type="time" value={dailyStartTime} onChange={e => setDailyStartTime(e.target.value)} className="w-full bg-dark-900 border border-gray-600 rounded p-1 text-xs" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[10px] text-gray-500 block">End Time</span>
                                            <input type="time" value={dailyEndTime} onChange={e => setDailyEndTime(e.target.value)} className="w-full bg-dark-900 border border-gray-600 rounded p-1 text-xs" />
                                        </div>
                                    </div>

                                    {/* Advanced Options */}
                                    <div className="bg-dark-900/50 p-2 rounded border border-white/5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1"><Shuffle size={10} /> Merge & Reorder</span>
                                            <button 
                                                onClick={() => setMergeAgendas(!mergeAgendas)}
                                                className={`w-8 h-4 rounded-full transition-colors relative ${mergeAgendas ? 'bg-blue-600' : 'bg-gray-600'}`}
                                            >
                                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${mergeAgendas ? 'translate-x-4' : ''}`} />
                                            </button>
                                        </div>
                                        
                                        {/* DEEP THINKING TOGGLE */}
                                        <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                            <span className="text-[10px] text-purple-400 flex items-center gap-1"><BrainCircuit size={10} /> Deep Thinking</span>
                                            <button 
                                                onClick={() => setIsDeepThinkingMode(!isDeepThinkingMode)}
                                                className={`w-8 h-4 rounded-full transition-colors relative ${isDeepThinkingMode ? 'bg-purple-600' : 'bg-gray-600'}`}
                                            >
                                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isDeepThinkingMode ? 'translate-x-4' : ''}`} />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1 w-24"><Timer size={10} /> Force Duration</span>
                                            <input 
                                                type="number" 
                                                placeholder="mins" 
                                                className="w-full bg-dark-800 border border-gray-600 rounded px-1 text-xs py-0.5"
                                                value={fixedDuration}
                                                onChange={(e) => setFixedDuration(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleApplySchedule}
                                        disabled={!rangeStart || isScheduling || isAnalyzing}
                                        className={`w-full text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-2 transition-all
                                            ${isDeepThinkingMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'}
                                        `}
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <BrainCircuit size={12} className="animate-pulse" /> Deep Thinking...
                                            </>
                                        ) : isScheduling ? (
                                            <>
                                                <Wand2 size={12} className="animate-spin" /> Scheduling...
                                            </>
                                        ) : (
                                            <>
                                                <Check size={12} /> {isDeepThinkingMode ? 'Analyze & Schedule' : mergeAgendas ? 'Merge & Reschedule' : 'Fill Gaps'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Daily Timeline */}
                    <div className="flex-1 flex flex-col h-full bg-dark-800 relative">
                         <div className="p-4 border-b border-white/10 flex justify-between items-center bg-dark-800 z-10 shadow-sm">
                             <div className="flex flex-col">
                                 <span className="text-xs text-green-400 font-bold uppercase">{selectedDate.toLocaleString('default', { weekday: 'long' })}</span>
                                 <span className="text-2xl font-bold text-white">{selectedDate.getDate()} {selectedDate.toLocaleString('default', { month: 'long' })}</span>
                             </div>
                             <div className="text-sm text-gray-400">{dailyEvents.length} Tasks Scheduled</div>
                         </div>
                         
                         <div ref={timelineRef} className="flex-1 overflow-y-auto relative custom-scrollbar">
                             <div className="relative min-h-[1440px] w-full" style={{ height: '1440px' }}> {/* 24h * 60px/h */}
                                 
                                 {/* Time Grid */}
                                 {HOURS.map(hour => (
                                     <div key={hour} className="absolute w-full border-t border-white/5 flex group hover:bg-white/[0.02]" style={{ top: `${hour * 60}px`, height: '60px' }}>
                                         <div className="w-16 text-right pr-4 text-xs text-gray-500 -mt-2 group-hover:text-gray-300">
                                             {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                                         </div>
                                         <div className="flex-1" />
                                     </div>
                                 ))}

                                 {/* Current Time Line (if today) */}
                                 {isSameDay(selectedDate, new Date()) && (
                                     <div 
                                        className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                                        style={{ top: `${new Date().getHours() * 60 + new Date().getMinutes()}px` }}
                                     >
                                         <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
                                     </div>
                                 )}

                                 {/* Events */}
                                 {dailyEvents.map(card => {
                                     const style = getEventStyle(card);
                                     const colorClass = colorStyles[card.color] || colorStyles.blue;
                                     const start = new Date(card.scheduledStart!);
                                     const end = new Date(card.scheduledEnd!);
                                     const timeStr = `${start.getHours()}:${start.getMinutes().toString().padStart(2, '0')} - ${end.getHours()}:${end.getMinutes().toString().padStart(2, '0')}`;

                                     return (
                                         <div
                                             key={card.id}
                                             className={`group absolute left-20 right-4 rounded-md border-l-4 p-2 text-xs shadow-lg transition hover:scale-[1.01] hover:z-30 cursor-pointer overflow-hidden ${colorClass}`}
                                             style={style}
                                         >
                                             <div className="flex justify-between items-start">
                                                 <div className="font-bold truncate text-sm">{card.title}</div>
                                                 {onUnschedule && (
                                                     <button 
                                                        onClick={(e) => { e.stopPropagation(); onUnschedule(card.id); }}
                                                        className="bg-black/20 hover:bg-red-500 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Delete Event"
                                                     >
                                                         <Trash2 size={12} />
                                                     </button>
                                                 )}
                                             </div>
                                             <div className="opacity-80 truncate">{timeStr}</div>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>
                    </div>
                </div>
            )}

            {/* --- OLD SCHEDULER VIEW (Kept as fallback) --- */}
            {activeTab === 'scheduler' && (
                <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500">Select "Calendar View" to use the new visual scheduler.</div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default CalendarModal;