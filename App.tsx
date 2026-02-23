import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CardData, Connection, CameraState, CardColor, ChatMessage, EventGroup, CardVisualSettings, CardBehaviorSettings } from './types';
import CardNode from './components/CardNode';
import ConnectionLayer from './components/ConnectionLayer';
import EventModal from './components/EventModal';
import CalendarModal from './components/CalendarModal';
import TaskOrderModal from './components/TaskOrderModal';
import ShortcutsModal from './components/ShortcutsModal';
import SettingsModal from './components/SettingsModal';
import VisionMode from './components/VisionMode';
import VoiceChatPanel from './components/VoiceChatPanel';
import HistoryPanel from './components/HistoryPanel';
import TimerSettingsModal from './components/TimerSettingsModal';
import { getTaskSuggestions, AiAction, speakText, connectLiveSession, optimizeTaskSchedule, estimateTaskDuration } from './services/geminiService';
import { Plus, Filter, MessageSquare, Target, ListOrdered, Mic, Send, X, CornerDownRight, Spline, Minus, Activity, Type, MicOff, Calendar, Folder, Maximize2, Minimize2, ChevronLeft, ChevronRight, Square, Lock, Unlock, Headphones, CalendarCheck2, Settings, Layers, Eye, AudioLines, StickyNote, Keyboard, ScrollText } from 'lucide-react';

function App() {
  // --- State ---
  const [cards, setCards] = useState<CardData[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [events, setEvents] = useState<EventGroup[]>([]);
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<CardColor | 'all'>('all');
  
  // Vision Mode State
  const [isVisionModeOpen, setIsVisionModeOpen] = useState(false);
  const [isVoiceChatOpen, setIsVoiceChatOpen] = useState(false);
  const [voiceChatMessages, setVoiceChatMessages] = useState<Array<{ id: string; text: string; isUser: boolean; timestamp: number }>>([]);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [cardVisualSettings, setCardVisualSettings] = useState<CardVisualSettings>({
      showImage: true,
      showTitle: true,
      showDescription: true,
      showTimer: true,
      showCompleteBtn: true,
      showDeleteBtn: true,
      showSchedule: true,
      showIntervals: true,
      showTags: true,
      showLastCompleted: true,
      showCompletionCount: true,
      showAttachmentIndicator: true,
      showAttachmentActions: true,
      defaultShape: 'rectangle',
      defaultColor: 'blue'
  });

  // Behavior Configuration State
  const [cardBehaviorSettings, setCardBehaviorSettings] = useState<CardBehaviorSettings>({
      preTimeSeconds: 0,
      postTimeSeconds: 0,
      maxPauses: 3,
      pauseDuration: 5,
      pauseDurationMode: 'fixed',
      requireClickToStart: false,
      requireClickToFinish: false,
      autoFlowAfterPostTime: true,
      requireClickToStartTimer: false,
      requireClickToStartInterval: false,
      requireClickToEndInterval: false,
      requireClickToStartPostTime: false,
      requireClickToFinishPostTime: false
  });

  // Shortcuts State
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({
      groupByTags: 'g',
      openCalendar: 'c',
      createEvent: 'e',
      createNote: 'n',
      toggleMic: 'm'
  });

  // UI State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isTaskOrderModalOpen, setIsTaskOrderModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [editingTimerCardId, setEditingTimerCardId] = useState<string | null>(null);
  const [isAiOptimizing, setIsAiOptimizing] = useState(false);
  
  const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
  const [liveVideoStream, setLiveVideoStream] = useState<MediaStream | null>(null);
  
  // Focus & Navigation State
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isCameraLocked, setIsCameraLocked] = useState(true); // TRUE = System controls camera (Task Order), FALSE = User controls (Free Look)
  const [activeRoutineIds, setActiveRoutineIds] = useState<string[]>([]); // Subset of card IDs for the current routine
  
  // Connection Visual Settings
  const [connectionStyle, setConnectionStyle] = useState<'curved' | 'straight'>('curved');
  const [connectionWidth, setConnectionWidth] = useState<number>(2);
  const [showConnectionLabels, setShowConnectionLabels] = useState<boolean>(false);

  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isVoiceModeRef = useRef(isVoiceMode);
  const isAiProcessingRef = useRef(isAiProcessing);
  const disconnectLiveSessionRef = useRef<(() => void) | null>(null);
  const isConnectingRef = useRef(false);

  // Sync refs
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);
  useEffect(() => { isAiProcessingRef.current = isAiProcessing; }, [isAiProcessing]);

  // --- Helpers ---
  const screenToCanvas = useCallback((sx: number, sy: number) => {
    if (!containerRef.current) return { x: sx, y: sy };
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // (sx - centerX - tx) / zoom = x
    const x = (sx - rect.left - centerX - camera.x) / camera.zoom;
    const y = (sy - rect.top - centerY - camera.y) / camera.zoom;
    return { x, y };
  }, [camera]);

  const centerCameraOnCard = useCallback((cardId: string, zoomLevel: number = 1.0) => {
      const card = cards.find(c => c.id === cardId);
      if (!card || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      // Adjust center to account for sidebar (approx 64px)
      // Visual center is slightly to the right
      const sidebarOffset = 64; 
      const centerX = (rect.width - sidebarOffset) / 2 + sidebarOffset;
      const centerY = rect.height / 2;

      // We want: (card.x + cardWidth/2) * zoom + cam.x = centerX
      // Assuming card width ~256px (w-64) and height ~auto (~300px)
      // We use a slightly larger height estimate to ensure bottom isn't cut off
      const cardCenterX = card.x + 128; 
      const cardCenterY = card.y + 150;

      const newCamX = centerX - (cardCenterX * zoomLevel);
      const newCamY = centerY - (cardCenterY * zoomLevel);

      setCamera({
          x: newCamX,
          y: newCamY,
          zoom: zoomLevel
      });
  }, [cards]);

  // --- Handlers (Memoized for Performance) ---
  
  const handleAiOptimize = useCallback(async (cardId: string) => {
      const card = cards.find(c => c.id === cardId);
      if (!card) return;

      setIsAiOptimizing(true);
      try {
          const completedHistory = cards.filter(c => c.status === 'completed');
          const result = await optimizeTaskSchedule(card, completedHistory);
          
          // Update Card
          setCards(prev => prev.map(c => c.id === cardId ? {
              ...c,
              timerTotal: result.timerTotal,
              timerRemaining: result.timerTotal,
              preTimeSeconds: result.preTime,
              postTimeSeconds: result.postTime,
              intervals: result.intervals
          } : c));

          // Create Reasoning Note
          const noteId = Date.now().toString();
          const noteCard: CardData = {
              id: noteId,
              type: 'note',
              x: card.x + 300,
              y: card.y,
              title: `AI Plan: ${card.title}`,
              description: result.reasoning,
              color: 'purple',
              timerTotal: 0,
              timerRemaining: 0,
              status: 'pending',
              notes: [],
              tags: ['ai-log'],
              completionCount: 0,
              attachments: []
          };
          setCards(prev => [...prev, noteCard]);
          speakText("I've optimized the schedule and created a note explaining my reasoning.");
      } catch (error) {
          console.error("Optimization failed", error);
          speakText("Sorry, I couldn't optimize the schedule.");
      } finally {
          setIsAiOptimizing(false);
      }
  }, [cards]);

  const handleGroupByTags = useCallback(() => {
      setCards(prevCards => {
          const newCards = [...prevCards];
          const tagGroups: Record<string, CardData[]> = {};
          const noTagCards: CardData[] = [];

          // Group cards
          newCards.forEach(card => {
              if (card.tags && card.tags.length > 0) {
                  const primaryTag = card.tags[0]; // Group by first tag
                  if (!tagGroups[primaryTag]) tagGroups[primaryTag] = [];
                  tagGroups[primaryTag].push(card);
              } else {
                  noTagCards.push(card);
              }
          });

          // Layout Constants
          const startX = 0;
          const startY = 0;
          const gapX = 300;
          const gapY = 350;
          const groupGap = 400;

          let currentX = startX;

          // Layout No-Tag Cards first
          if (noTagCards.length > 0) {
              noTagCards.forEach((card, i) => {
                  card.x = currentX;
                  card.y = startY + (i * gapY);
              });
              currentX += gapX + 100;
          }

          // Layout Tag Groups
          Object.entries(tagGroups).forEach(([tag, groupCards]) => {
              // Create a visual header for the group (optional, but we just arrange them)
              groupCards.forEach((card, i) => {
                  card.x = currentX;
                  card.y = startY + (i * gapY);
              });
              currentX += gapX;
          });

          speakText(`Grouped ${newCards.length} cards by tags.`);
          return newCards;
      });
  }, []);

  const handleAddCard = useCallback((parentId?: string, customData?: Partial<CardData>) => {
    // Calculate center based on current camera state
    const newX = -camera.x / camera.zoom;
    const newY = -camera.y / camera.zoom;

    const spawnX = customData?.x ?? (parentId ? newX + 50 : newX);
    const spawnY = customData?.y ?? (parentId ? newY + 50 : newY);

    const newCard: CardData = {
        id: crypto.randomUUID(),
        x: spawnX,
        y: spawnY,
        title: customData?.title || 'New Task',
        description: customData?.description || 'Description here...',
        color: (customData?.color as CardColor) || 'blue',
        timerTotal: 300,
        timerRemaining: 300,
        status: 'pending',
        notes: [],
        tags: [],
        completionCount: 0,
        attachments: [],
        intervals: { count: 1, duration: 300 },
        aiThoughts: [],
        parentId,
        ...customData
    };
    
    setCards(prevCards => [...prevCards, newCard]);
    
    if (parentId) {
        setConnections(prev => [...prev, { id: crypto.randomUUID(), fromId: parentId, toId: newCard.id, label: 'Next' }]);
    }
  }, [camera]); 

  const handleAddBatchCard = useCallback(() => {
      // Create a green card with 10 intervals of 10 minutes (600 seconds)
      handleAddCard(undefined, {
          title: "Batch Cleaning",
          description: "10x Tasks - 10 mins each",
          color: 'green',
          timerTotal: 600, // 10 minutes
          timerRemaining: 600,
          intervals: { count: 10, duration: 600 },
          currentInterval: 1
      });
  }, [handleAddCard]);

  const handleUpdateCard = useCallback((id: string, updates: Partial<CardData>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const handleAddNote = useCallback(() => {
      // Create a yellow note
      handleAddCard(undefined, {
          title: "New Note",
          description: "Write something...",
          color: 'yellow',
          type: 'note',
          timerTotal: 0,
          timerRemaining: 0
      });
  }, [handleAddCard]);

  const handleAutoDuration = useCallback(async (id: string) => {
      const card = cards.find(c => c.id === id);
      if (!card) return;
      
      // Show loading feedback?
      const duration = await estimateTaskDuration(card.title, card.description);
      handleUpdateCard(id, { timerTotal: duration * 60, timerRemaining: duration * 60 });
      speakText(`I've set the timer to ${duration} minutes.`);
  }, [cards, handleUpdateCard]);

  const handleBatchUpdate = useCallback((updates: { id: string, data: Partial<CardData> }[]) => {
    setCards(prev => {
        const newCards = [...prev];
        updates.forEach(u => {
            const idx = newCards.findIndex(c => c.id === u.id);
            if (idx !== -1) {
                newCards[idx] = { ...newCards[idx], ...u.data };
            }
        });
        return newCards;
    });
  }, []);

  const deleteCard = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
  }, []);

  const handleSelectCard = useCallback((id: string) => {
      setSelectedCardId(id);
      // Only center automatically if we are in Locked Mode (Task Order Mode)
      if (isFocusMode && isCameraLocked) {
          centerCameraOnCard(id, 1.2);
      }
  }, [isFocusMode, isCameraLocked, centerCameraOnCard]);

  const handleCardDragStart = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isFocusMode) return; // Disable dragging in focus mode
    setDraggingCardId(id);
    setSelectedCardId(id);
  }, [isFocusMode]);

  const handleConnectStart = useCallback((id: string) => {
    if (isFocusMode) return; // Disable connection creation in focus mode
    setConnectingFromId(prev => {
        if (prev) {
            if (prev !== id) {
                setConnections(conns => [...conns, { id: crypto.randomUUID(), fromId: prev, toId: id }]);
            }
            return null;
        } else {
            return id;
        }
    });
  }, [isFocusMode]);

  const handleBreakdown = useCallback((parentId: string, steps: any[]) => {
      setCards(prevCards => {
          const parent = prevCards.find(c => c.id === parentId);
          if(!parent) return prevCards;
          
          const newCards: CardData[] = [];
          const newConns: Connection[] = [];
          let lastId = parentId;
          
          steps.forEach((step, idx) => {
              const id = crypto.randomUUID();
              newCards.push({
                  id,
                  x: parent.x + 300,
                  y: parent.y + (idx * 250) - (steps.length * 100),
                  title: step.title,
                  description: step.description,
                  color: parent.color,
                  timerTotal: step.duration * 60,
                  timerRemaining: step.duration * 60,
                  status: 'pending',
                  notes: [],
                  tags: [],
                  completionCount: 0,
                  attachments: [],
                  intervals: { count: 1, duration: step.duration * 60 },
                  aiThoughts: [],
                  parentId: parentId
              });
              newConns.push({ id: crypto.randomUUID(), fromId: lastId, toId: id, label: `Step ${idx + 1}` });
              lastId = id; 
          });
          
          setTimeout(() => {
             setConnections(c => [...c, ...newConns]);
          }, 0);
          
          return [...prevCards, ...newCards];
      });
  }, []);

  // --- Order & Routine Handlers ---
  const handleReorderCards = (newOrder: CardData[]) => {
      setCards(newOrder);
  };

  const advanceToNextTaskInRoutine = useCallback((currentCards: CardData[], routineIds: string[]) => {
      // Find the first task in the routine list that is pending
      let nextId = null;
      
      // Iterate through the routine IDs in order
      for (const id of routineIds) {
          const card = currentCards.find(c => c.id === id);
          if (card && card.status === 'pending') {
              nextId = id;
              break;
          }
      }

      if (nextId) {
          setCards(prev => prev.map(c => c.id === nextId ? { ...c, status: 'active' } : c));
          setSelectedCardId(nextId);
          if (isCameraLocked) {
              setTimeout(() => centerCameraOnCard(nextId, 1.2), 50);
          }
      } else {
          speakText("All tasks in this routine are finished.");
          setIsFocusMode(false);
          setCamera(prev => ({...prev, zoom: 1}));
      }
  }, [centerCameraOnCard, isCameraLocked]);

  const handleStartRoutine = (orderedList?: CardData[]) => {
      let routineIds: string[] = [];
      let listToUse = cards;

      // If specific list provided (Drag Drop Modal or Event)
      if (orderedList) {
          routineIds = orderedList.map(c => c.id);
          const idsSet = new Set(routineIds);
          // Reorder global cards to match the modal's order + others appended
          const others = cards.filter(c => !idsSet.has(c.id));
          listToUse = [...orderedList, ...others];
          setCards(listToUse);
      } else {
          // Default: all cards are in the routine
          routineIds = cards.map(c => c.id);
      }

      setActiveRoutineIds(routineIds);

      // Reset active status for cards in this routine
      const updatedCards = listToUse.map(c => routineIds.includes(c.id) && c.status === 'active' ? { ...c, status: 'pending' as const } : c);
      setCards(updatedCards);

      // Trigger start
      setIsTaskOrderModalOpen(false);
      setIsFocusMode(true);
      setIsCameraLocked(true);
      
      // We need to pass the *updated* cards to advance logic
      setTimeout(() => advanceToNextTaskInRoutine(updatedCards, routineIds), 0);
  };

  const handleStopRoutine = useCallback(() => {
      setCards(prev => prev.map(c => c.status === 'active' ? { ...c, status: 'pending' } : c));
      setIsFocusMode(false);
      setActiveRoutineIds([]);
      setCamera(prev => ({ ...prev, zoom: 1 }));
      speakText("Routine stopped.");
  }, []);

  const handleCompleteTask = useCallback((id: string) => {
      setCards(prev => {
          const card = prev.find(c => c.id === id);
          if (!card) return prev;

          // 1. Mark current as completed
          const updated = prev.map(c => c.id === id ? { 
              ...c, 
              status: 'completed', 
              timerRemaining: 0,
              completionCount: (c.completionCount || 0) + 1,
              lastCompleted: Date.now()
          } as CardData : c);

          // 2. Advance to next
          // We need to run the advance logic *after* state update, but we are inside setState.
          // So we do the find logic here manually.
          let nextId: string | null = null;
          if (activeRoutineIds.length > 0) {
              for (const rid of activeRoutineIds) {
                  const c = updated.find(x => x.id === rid);
                  if (c && c.status === 'pending') {
                      nextId = rid;
                      break;
                  }
              }
          } else {
               // Fallback if no routine is defined (just find next pending in global list)
               const next = updated.find(c => c.status === 'pending');
               if (next) nextId = next.id;
          }

          if (nextId) {
             // Activate next
             const finalUpdate = updated.map(c => c.id === nextId ? { ...c, status: 'active' } as CardData : c);
             
             // Side effects (Camera)
             setTimeout(() => {
                 setSelectedCardId(nextId);
                 if (isCameraLocked) centerCameraOnCard(nextId!, 1.2);
             }, 50);

             return finalUpdate;
          } else {
             // Routine done
             setTimeout(() => {
                 speakText("Routine complete!");
                 setIsFocusMode(false);
                 setCamera(prev => ({...prev, zoom: 1}));
             }, 500);
             return updated;
          }
      });
  }, [activeRoutineIds, isCameraLocked, centerCameraOnCard]);

  const handleSnooze = useCallback((id: string) => {
      setCards(prev => {
          // Remove from activeRoutineIds temporarily logic is complex if we rely on index.
          // Simplest Snooze: Move ID to end of activeRoutineIds array?
          // We need to update activeRoutineIds state too if we want true reorder.
          // For now, let's just mark it pending and deactivate it, then find next.
          // But "Snooze" implies do it later.
          
          const updated = prev.map(c => c.id === id ? { ...c, status: 'pending' } as CardData : c);
          
          // Reorder the routine IDs: move this ID to the end
          if (activeRoutineIds.includes(id)) {
              const newOrder = activeRoutineIds.filter(x => x !== id).concat(id);
              setActiveRoutineIds(newOrder); // Update routine order state
              
              // Now find next in the NEW order
              let nextId = null;
              for (const rid of newOrder) {
                  const c = updated.find(x => x.id === rid);
                  if (c && c.status === 'pending') {
                      nextId = rid;
                      break;
                  }
              }
              
              if (nextId) {
                   const finalUpdate = updated.map(c => c.id === nextId ? { ...c, status: 'active' } as CardData : c);
                   setTimeout(() => {
                        setSelectedCardId(nextId);
                        if (isCameraLocked) centerCameraOnCard(nextId!, 1.2);
                   }, 50);
                   return finalUpdate;
              }
          }
          return updated;
      });
  }, [activeRoutineIds, isCameraLocked, centerCameraOnCard]);

  const handleSkip = useCallback((id: string) => {
      setCards(prev => {
          const updated = prev.map(c => c.id === id ? { ...c, status: 'skipped', timerRemaining: 0 } as CardData : c);
          
          // Find next in current routine
          let nextId = null;
          if (activeRoutineIds.length > 0) {
              for (const rid of activeRoutineIds) {
                  const c = updated.find(x => x.id === rid);
                  if (c && c.status === 'pending') {
                      nextId = rid;
                      break;
                  }
              }
          }
          
          if (nextId) {
             const finalUpdate = updated.map(c => c.id === nextId ? { ...c, status: 'active' } as CardData : c);
             setTimeout(() => {
                 setSelectedCardId(nextId);
                 if (isCameraLocked) centerCameraOnCard(nextId!, 1.2);
             }, 50);
             return finalUpdate;
          }
           return updated;
      });
  }, [activeRoutineIds, isCameraLocked, centerCameraOnCard]);


  // --- Schedule Handlers ---
  const handleSaveEvent = (newEvent: EventGroup) => {
      setEvents(prev => [...prev, newEvent]);
  };

  const handleApplySchedule = (updates: Array<{ id: string; start: string; end: string }>) => {
      setCards(prev => prev.map(c => {
          const update = updates.find(u => u.id === c.id);
          if (update) {
              return { ...c, scheduledStart: update.start, scheduledEnd: update.end };
          }
          return c;
      }));
      // Provide feedback
      const msg = `Scheduled ${updates.length} tasks successfully.`;
      setChatMessages(prev => [...prev, { role: 'model', text: msg, timestamp: Date.now() }]);
      speakText(msg);
  };

  const handleUnscheduleTask = (cardId: string) => {
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, scheduledStart: undefined, scheduledEnd: undefined } : c));
  };

  const toggleFocusMode = () => {
      if (!isFocusMode) {
          // Entering focus mode
          let targetId = selectedCardId;
          if (!targetId) {
              const active = cards.find(c => c.status === 'active');
              targetId = active ? active.id : cards[0]?.id;
          }
          
          if (targetId) {
              setSelectedCardId(targetId);
              centerCameraOnCard(targetId, 1.2);
              setIsFocusMode(true);
              setIsCameraLocked(true); // Reset to locked on enter
          }
      } else {
          handleStopRoutine(); // Exiting via toggle acts as stop
      }
  };

  const toggleCameraLock = () => {
      setIsCameraLocked(!isCameraLocked);
  };

  // --- Live Session Handler ---
  const handleToggleLiveSession = useCallback(async (mode: 'audio' | 'vision' | 'voice_chat' = 'audio') => {
      // Prevent race conditions
      if (isConnectingRef.current) return;

      if (isLiveSessionActive) {
          // If active, we might just be switching modes or closing
          if (mode === 'vision' && !isVisionModeOpen) {
              setIsVisionModeOpen(true);
              setIsVoiceChatOpen(false);
              return;
          }
          if (mode === 'voice_chat' && !isVoiceChatOpen) {
              setIsVoiceChatOpen(true);
              setIsVisionModeOpen(false);
              return;
          }

          // Otherwise disconnect
          if (disconnectLiveSessionRef.current) {
              disconnectLiveSessionRef.current();
              disconnectLiveSessionRef.current = null;
          }
          setIsLiveSessionActive(false);
          setLiveVideoStream(null);
          setIsVisionModeOpen(false);
          setIsVoiceChatOpen(false);
      } else {
          // Start Session
          isConnectingRef.current = true;
          
          // Turn off legacy voice mode to prevent mic conflict
          if (isVoiceMode) setIsVoiceMode(false);

          if (mode === 'vision') setIsVisionModeOpen(true);
          if (mode === 'voice_chat') setIsVoiceChatOpen(true);
          
          const disconnect = await connectLiveSession(
              (habit, implication) => {
                  // CALLBACK: When habit is detected by AI
                  setCards(prev => {
                      // Find or create "User Insights" card
                      let insightsCard = prev.find(c => c.title === "🧠 User Insights");
                      
                      if (!insightsCard) {
                          const newCard: CardData = {
                              id: crypto.randomUUID(),
                              x: -camera.x + 100,
                              y: -camera.y + 100,
                              title: "🧠 User Insights",
                              description: "AI-observed habits and behavioral patterns.",
                              color: 'purple',
                              timerTotal: 0,
                              timerRemaining: 0,
                              status: 'pending',
                              notes: [],
                              tags: ['ai-insights'],
                              completionCount: 0,
                              attachments: [],
                              aiThoughts: [],
                          };
                          // Add new thought immediately
                          newCard.aiThoughts = [{
                              timestamp: Date.now(),
                              content: `OBSERVATION: ${habit}\nIMPLICATION: ${implication}`
                          }];
                          return [...prev, newCard];
                      } else {
                          // Update existing
                          return prev.map(c => c.id === insightsCard!.id ? {
                              ...c,
                              aiThoughts: [
                                  ...(c.aiThoughts || []),
                                  {
                                      timestamp: Date.now(),
                                      content: `OBSERVATION: ${habit}\nIMPLICATION: ${implication}`
                                  }
                              ]
                          } : c);
                      }
                  });
              },
              (isActive) => {
                  setIsLiveSessionActive(isActive);
                  isConnectingRef.current = false; // Reset connecting flag
                  if (!isActive) {
                      setLiveVideoStream(null);
                      // Close panels if session ends unexpectedly
                      setIsVisionModeOpen(false);
                      setIsVoiceChatOpen(false);
                  }
              },
              (stream) => {
                  setLiveVideoStream(stream);
              },
              (text, isUser) => {
                  // Handle Transcript
                  setVoiceChatMessages(prev => [...prev, {
                      id: crypto.randomUUID(),
                      text,
                      isUser,
                      timestamp: Date.now()
                  }]);
              }
          );
          disconnectLiveSessionRef.current = disconnect as any;
      }
  }, [isLiveSessionActive, camera, isVisionModeOpen, isVoiceChatOpen, isVoiceMode]);

  // Auto-start live session on mount
  useEffect(() => {
      // Small delay to ensure permissions are ready and UI is mounted
      const timer = setTimeout(() => {
          if (!isLiveSessionActive && !disconnectLiveSessionRef.current) {
              handleToggleLiveSession();
          }
      }, 1000);
      return () => clearTimeout(timer);
  }, []);

  // --- Zoom to Cursor Logic ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isFocusMode && isCameraLocked) return; // Disable zoom in focus mode IF locked

    if (e.ctrlKey || e.metaKey || true) {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const mouseRelX = mouseX - centerX;
        const mouseRelY = mouseY - centerY;

        const worldX = (mouseRelX - camera.x) / camera.zoom;
        const worldY = (mouseRelY - camera.y) / camera.zoom;

        const zoomSensitivity = 0.001;
        const zoomFactor = Math.exp(-e.deltaY * zoomSensitivity);
        const newZoom = Math.min(Math.max(0.1, camera.zoom * zoomFactor), 5);

        const newCamX = mouseRelX - (worldX * newZoom);
        const newCamY = mouseRelY - (worldY * newZoom);

        setCamera({
            x: newCamX,
            y: newCamY,
            zoom: newZoom
        });
    }
  }, [camera, isFocusMode, isCameraLocked]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFocusMode && isCameraLocked) return; // Disable drag in locked mode
    if (e.button === 1 || e.button === 0) {
       setIsDragging(true);
       setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingCardId && !isFocusMode) {
        const dx = (e.movementX) / camera.zoom;
        const dy = (e.movementY) / camera.zoom;
        setCards(prev => prev.map(c => c.id === draggingCardId ? { ...c, x: c.x + dx, y: c.y + dy } : c));
    } else if (isDragging && (!isFocusMode || !isCameraLocked)) {
        setCamera(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingCardId(null);
  };

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore if typing in input
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

        // --- SHORTCUTS ---
        const key = e.key.toLowerCase();
        
        if (key === shortcuts.groupByTags) {
            handleGroupByTags();
        } else if (key === shortcuts.openCalendar) {
            setIsCalendarModalOpen(prev => !prev);
        } else if (key === shortcuts.createEvent) {
            setIsEventModalOpen(prev => !prev);
        } else if (key === shortcuts.createNote) {
            handleAddNote();
        } else if (key === shortcuts.toggleMic) {
            setIsVoiceMode(prev => !prev);
        }

        if (!selectedCardId) return;

        if (isFocusMode && isCameraLocked) {
            // --- TASK ORDER NAVIGATION (LOCKED MODE) ---
            // Use activeRoutineIds to navigate
            const listIds = activeRoutineIds.length > 0 ? activeRoutineIds : cards.map(c => c.id);
            const currentIndex = listIds.indexOf(selectedCardId);
            
            if (currentIndex === -1) return;

            let nextIndex = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                nextIndex = currentIndex + 1;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                nextIndex = currentIndex - 1;
            }

            if (nextIndex >= 0 && nextIndex < listIds.length) {
                const nextId = listIds[nextIndex];
                setSelectedCardId(nextId);
                centerCameraOnCard(nextId, 1.0); // Use 1.0 zoom for better visibility
            }

        } else {
            // --- SPATIAL NAVIGATION (FREE LOOK MODE) ---
            const current = cards.find(c => c.id === selectedCardId);
            if (!current) return;

            let next: CardData | undefined;
            if (e.key === 'ArrowRight') {
                next = cards.filter(c => c.x > current.x).sort((a, b) => a.x - b.x)[0];
            } else if (e.key === 'ArrowLeft') {
                next = cards.filter(c => c.x < current.x).sort((a, b) => b.x - a.x)[0];
            } else if (e.key === 'ArrowDown') {
                next = cards.filter(c => c.y > current.y).sort((a, b) => a.y - b.y)[0];
            } else if (e.key === 'ArrowUp') {
                next = cards.filter(c => c.y < current.y).sort((a, b) => b.y - a.y)[0];
            }

            if (next) {
                setSelectedCardId(next.id);
                if (isFocusMode) {
                   // In free look focus mode, just select it
                   // User can pan if they want
                } else {
                    // Standard canvas behavior
                    setCamera(prev => {
                        const rect = containerRef.current?.getBoundingClientRect();
                        const sidebarOffset = 64;
                        const centerX = rect ? (rect.width - sidebarOffset) / 2 + sidebarOffset : 0;
                        const centerY = rect ? rect.height / 2 : 0;
                        const nextCenterX = next!.x + 128; 
                        const nextCenterY = next!.y + 150;
                        return { 
                            ...prev, 
                            x: centerX - (nextCenterX * prev.zoom), 
                            y: centerY - (nextCenterY * prev.zoom) 
                        };
                    });
                }
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCardId, cards, isFocusMode, isCameraLocked, centerCameraOnCard, activeRoutineIds, shortcuts, handleGroupByTags, handleAddNote]); 


  // AI Chat & Action Handling
  const handleSendMessage = useCallback(async (textOverride?: string) => {
    const text = typeof textOverride === 'string' ? textOverride : chatInput;
    if (!text?.trim()) return;
    
    // Clear input if using text box
    if (!textOverride) setChatInput('');

    const userMsg: ChatMessage = { role: 'user', text: text, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    
    setIsAiProcessing(true);
    
    // Add AI placeholder
    setChatMessages(prev => [...prev, { role: 'model', text: 'Thinking...', timestamp: Date.now() + 1 }]);
    
    // Call AI Service
    // We pass the latest cards state implicitly via closure (re-created on change) or we trust it doesn't change too fast during chat
    const actions: AiAction[] = await getTaskSuggestions(cards, userMsg.text);
    
    setIsAiProcessing(false);
    setChatMessages(prev => prev.slice(0, -1)); // Remove placeholder

    // Execute Actions
    for (const action of actions) {
        if (action.type === 'chat' && action.text) {
             setChatMessages(prev => [...prev, { role: 'model', text: action.text!, timestamp: Date.now() }]);
             speakText(action.text);
        }
        else if (action.type === 'create_card' && action.cardData) {
             handleAddCard(undefined, action.cardData);
        }
        else if (action.type === 'move_card' && action.moveData) {
            const targetId = action.moveData.targetId;
            handleUpdateCard(targetId, { x: action.moveData.x, y: action.moveData.y });
        }
        else if (action.type === 'connect_cards' && action.connectData) {
            setConnections(prev => [...prev, { 
                id: crypto.randomUUID(), 
                fromId: action.connectData!.fromId, 
                toId: action.connectData!.toId,
                label: action.connectData!.label 
            }]);
        }
        else if (action.type === 'update_settings' && action.settingsData) {
            setCardBehaviorSettings(prev => ({ ...prev, ...action.settingsData }));
            // Optional: Add a system message or toast to confirm settings update
            setChatMessages(prev => [...prev, { role: 'model', text: "Updated behavior settings based on your request.", timestamp: Date.now() }]);
        }
    }
  }, [cards, chatInput, handleAddCard, handleUpdateCard]);

  // --- Voice Mode Logic ---
  const handleSendMessageRef = useRef(handleSendMessage);
  useEffect(() => { handleSendMessageRef.current = handleSendMessage; }, [handleSendMessage]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Capture one phrase at a time
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
            const text = event.results[0][0].transcript;
            if (text) {
                // Send immediately
                handleSendMessageRef.current(text);
            }
        };

        recognition.onend = () => {
            // Restart if voice mode is on AND AI isn't processing/speaking (prevents echo)
            if (isVoiceModeRef.current && !isAiProcessingRef.current) {
                try { recognition.start(); } catch (e) { /* ignore */ }
            }
        };

        recognition.onerror = (e: any) => {
            console.error("Speech error", e);
            if (e.error === 'not-allowed') {
                setIsVoiceMode(false);
                speakText("Acesso ao microfone negado.");
            }
        };

        recognitionRef.current = recognition;
    } else {
        console.warn("Speech Recognition not supported in this browser.");
    }
  }, []);

  // Effect to start/stop based on mode and processing status
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isVoiceMode && !isAiProcessing && !isLiveSessionActive) {
        try { recognition.start(); } catch(e) { /* ignore if already started */ }
    } else {
        recognition.stop();
    }
  }, [isVoiceMode, isAiProcessing, isLiveSessionActive]);


  // Visual settings toggles
  const toggleConnectionStyle = () => setConnectionStyle(prev => prev === 'curved' ? 'straight' : 'curved');
  const toggleConnectionWidth = () => setConnectionWidth(prev => prev === 2 ? 4 : prev === 4 ? 8 : 2);
  const toggleConnectionLabels = () => setShowConnectionLabels(prev => !prev);

  // Derived state
  const visibleCards = filterColor === 'all' 
    ? cards 
    : cards.filter(c => c.color === filterColor || (isFocusMode && c.id === selectedCardId));
    
  const cardsToRender = isFocusMode && selectedCardId 
    ? visibleCards.filter(c => c.id === selectedCardId) 
    : visibleCards;

  const activeTask = cards.find(c => c.status === 'active');
  const nextTask = !activeTask ? cards.find(c => c.status === 'pending') : null;

  // Schedule Stats
  const scheduledTaskCount = cards.filter(c => c.scheduledStart).length;

  return (
    <div className="w-screen h-screen bg-dark-900 overflow-hidden relative font-sans text-white">
      {/* --- Focus Mode Overlay --- */}
      {isFocusMode && (
          <div className="absolute inset-0 pointer-events-none z-30 flex flex-col items-center">
              <div className="bg-gradient-to-b from-black/80 to-transparent w-full h-32 flex justify-center pt-8">
                <div className="pointer-events-auto flex items-center gap-4">
                    {/* Status Pill with Lock Toggle */}
                    <div className="bg-dark-800 border border-white/20 rounded-full px-6 py-2 flex items-center gap-4 shadow-2xl">
                        <span className="text-sm font-bold tracking-widest text-blue-400 animate-pulse">
                            {isCameraLocked ? 'LOCKED FOCUS' : 'FREE LOOK'}
                        </span>
                        
                        <div className="w-[1px] h-4 bg-gray-600" />
                        
                        <button 
                            onClick={toggleCameraLock}
                            className={`p-1 rounded-full transition ${isCameraLocked ? 'text-green-400 hover:text-green-300' : 'text-yellow-400 hover:text-yellow-300'}`}
                            title={isCameraLocked ? "Unlock Camera (Free Look)" : "Lock Camera (Auto-Focus)"}
                        >
                            {isCameraLocked ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>

                        <button 
                            onClick={toggleFocusMode}
                            className="bg-gray-700/50 hover:bg-gray-700 text-gray-200 hover:text-white rounded-full p-1 transition ml-2"
                            title="Exit Focus Mode (Keep Running)"
                        >
                            <Minimize2 size={16} />
                        </button>
                    </div>
                    
                    <button 
                        onClick={handleStopRoutine}
                        className="pointer-events-auto bg-red-600/80 hover:bg-red-500 text-white rounded-full px-4 py-2 text-sm font-bold shadow-2xl flex items-center gap-2"
                        title="Stop Active Routine"
                    >
                        <Square size={14} fill="currentColor" /> STOP ROUTINE
                    </button>
                </div>
              </div>
              
              {/* Navigation Hints */}
              <div className="absolute top-1/2 left-4 -translate-y-1/2 text-white/10 pointer-events-none transition-opacity duration-300">
                  <ChevronLeft size={64} />
                  <span className="block text-center text-xs opacity-50">{isCameraLocked ? 'PREV TASK' : 'PAN LEFT'}</span>
              </div>
               <div className="absolute top-1/2 right-4 -translate-y-1/2 text-white/10 pointer-events-none transition-opacity duration-300">
                  <ChevronRight size={64} />
                  <span className="block text-center text-xs opacity-50">{isCameraLocked ? 'NEXT TASK' : 'PAN RIGHT'}</span>
              </div>
          </div>
      )}

      {/* --- Live Camera Preview --- */}
      {isLiveSessionActive && liveVideoStream && (
          <div className="absolute bottom-4 right-4 z-50 w-64 h-48 bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-orange-500/50 animate-in slide-in-from-bottom-10 fade-in duration-500">
              <video 
                  ref={videoRef => {
                      if (videoRef && liveVideoStream) {
                          videoRef.srcObject = liveVideoStream;
                          videoRef.play().catch(e => console.error("Video play error", e));
                      }
                  }}
                  className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                  muted
                  playsInline
              />
              <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-white tracking-wider">AI VISION ACTIVE</span>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-2">
                  <span className="text-[10px] text-white/70">Chronos is watching...</span>
              </div>
          </div>
      )}

      {/* --- Toolbar --- */}
      <div className={`absolute top-4 left-4 z-50 flex flex-col gap-2 transition-opacity duration-300 max-h-[calc(100vh-2rem)] overflow-y-auto ${isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="bg-dark-800/80 backdrop-blur border border-white/10 p-2 rounded-lg shadow-xl flex flex-col gap-2 shrink-0">
            <button onClick={() => handleAddCard()} className="p-2 bg-blue-600 rounded hover:bg-blue-500 transition tooltip-container group">
                <Plus size={20} />
                <span className="fixed left-16 bg-black px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition z-50 pointer-events-none">Add Card</span>
            </button>
            <button onClick={handleAddNote} className="p-2 bg-yellow-600 rounded hover:bg-yellow-500 transition tooltip-container group" title="Add Note (Post-it)">
                <StickyNote size={20} />
                <span className="fixed left-16 bg-black px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition z-50 pointer-events-none">Add Note</span>
            </button>
            <button onClick={handleAddBatchCard} className="p-2 bg-emerald-600 rounded hover:bg-emerald-500 transition tooltip-container group" title="Add Batch Task (Green)">
                <Layers size={20} />
                <span className="fixed left-16 bg-black px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition z-50 pointer-events-none">Batch Task</span>
            </button>
            <button onClick={() => setIsChatOpen(!isChatOpen)} className="p-2 bg-purple-600 rounded hover:bg-purple-500 transition group">
                <MessageSquare size={20} />
            </button>
             <button onClick={() => setIsTaskOrderModalOpen(true)} className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition group" title="Ordered Task List">
                <ListOrdered size={20} />
            </button>
            <button onClick={() => setIsEventModalOpen(true)} className="p-2 bg-indigo-600 rounded hover:bg-indigo-500 transition group" title="Event Manager">
                <Folder size={20} />
            </button>
            <button onClick={() => setIsCalendarModalOpen(true)} className="p-2 bg-green-600 rounded hover:bg-green-500 transition group relative" title="Calendar AI">
                <Calendar size={20} />
                {scheduledTaskCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                        {scheduledTaskCount}
                    </span>
                )}
            </button>
            
            <div className="h-[1px] bg-white/10 w-full my-1" />
            
             {/* New Schedule Check Button */}
             <button 
                onClick={() => setIsCalendarModalOpen(true)} 
                className="p-2 bg-dark-700 hover:bg-dark-600 text-gray-300 hover:text-white rounded transition group relative"
                title="Active Scheduled Items"
            >
                <CalendarCheck2 size={20} />
                {scheduledTaskCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                        {scheduledTaskCount}
                    </span>
                )}
            </button>

            <button 
                onClick={() => setIsSettingsModalOpen(true)} 
                className="p-2 bg-dark-700 hover:bg-dark-600 text-gray-300 hover:text-white rounded transition group"
                title="Visual & Behavior Configuration"
            >
                <Settings size={20} />
            </button>

            <button 
                onClick={() => setIsShortcutsModalOpen(true)} 
                className="p-2 bg-dark-700 hover:bg-dark-600 text-gray-300 hover:text-white rounded transition group"
                title="Keyboard Shortcuts"
            >
                <Keyboard size={20} />
            </button>

            <button 
                onClick={() => setIsHistoryPanelOpen(true)} 
                className="p-2 bg-dark-700 hover:bg-dark-600 text-gray-300 hover:text-white rounded transition group"
                title="History & Insights"
            >
                <ScrollText size={20} />
            </button>

            <button 
                onClick={toggleFocusMode} 
                className="p-2 bg-teal-600 rounded hover:bg-teal-500 transition group" 
                title="Enter Focus Mode"
            >
                <Maximize2 size={20} />
            </button>

            <button 
                onClick={() => setIsVoiceMode(!isVoiceMode)} 
                className={`p-2 rounded transition group relative ${isVoiceMode ? 'bg-red-500/20 text-red-500 border border-red-500 animate-pulse' : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-gray-600'}`}
                title={isVoiceMode ? "Disable Voice Mode" : "Enable Voice Mode"}
            >
                {isVoiceMode ? <Mic size={20} /> : <MicOff size={20} />}
                {isVoiceMode && (
                    <span className="absolute left-10 top-1/2 -translate-y-1/2 whitespace-nowrap bg-red-600 text-white text-[10px] px-2 py-0.5 rounded">
                        Listening...
                    </span>
                )}
            </button>
            
            {/* Live Conversation Button */}
            <button 
                onClick={() => handleToggleLiveSession('audio')} 
                className={`p-2 rounded transition group relative ${isLiveSessionActive && !isVisionModeOpen && !isVoiceChatOpen ? 'bg-orange-500/20 text-orange-400 border border-orange-500 animate-pulse shadow-[0_0_15px_rgba(251,146,60,0.5)]' : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-gray-600'}`}
                title="AI Live Conversation (Audio Only)"
            >
                <Headphones size={20} className={isLiveSessionActive && !isVisionModeOpen && !isVoiceChatOpen ? "animate-bounce" : ""} />
            </button>

            {/* Voice Chat Button */}
            <button 
                onClick={() => handleToggleLiveSession('voice_chat')} 
                className={`p-2 rounded transition group relative ${isLiveSessionActive && isVoiceChatOpen ? 'bg-purple-500/20 text-purple-400 border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-gray-600'}`}
                title="Voice Chat (Audio + Text)"
            >
                <AudioLines size={20} className={isLiveSessionActive && isVoiceChatOpen ? "animate-pulse" : ""} />
            </button>

            {/* Vision Mode Button */}
            <button 
                onClick={() => handleToggleLiveSession('vision')} 
                className={`p-2 rounded transition group relative ${isLiveSessionActive && isVisionModeOpen ? 'bg-blue-500/20 text-blue-400 border border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-gray-600'}`}
                title="Open Vision Mode (Camera + AI)"
            >
                <Eye size={20} />
            </button>
        </div>
        
        {/* Filters */}
        <div className="bg-dark-800/80 backdrop-blur border border-white/10 p-2 rounded-lg shadow-xl flex flex-col gap-2">
            <Filter size={16} className="text-gray-400 self-center mb-1" />
            {(['red', 'yellow', 'purple', 'blue', 'green'] as CardColor[]).map(color => (
                <button
                    key={color}
                    onClick={() => setFilterColor(filterColor === color ? 'all' : color)}
                    className={`w-6 h-6 rounded-full border-2 transition ${filterColor === color ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    style={{ backgroundColor: color === 'red' ? '#ef4444' : color === 'yellow' ? '#eab308' : color === 'purple' ? '#a855f7' : color === 'blue' ? '#3b82f6' : '#22c55e' }}
                />
            ))}
             <button 
                onClick={() => setFilterColor('all')}
                className={`text-xs text-center text-gray-400 hover:text-white ${filterColor === 'all' ? 'text-white font-bold' : ''}`}
            >
                ALL
            </button>
        </div>

        {/* View Settings */}
        <div className="bg-dark-800/80 backdrop-blur border border-white/10 p-2 rounded-lg shadow-xl flex flex-col gap-2">
            <div className="text-[10px] text-gray-500 text-center font-bold">VIEW</div>
            <button 
                onClick={toggleConnectionStyle} 
                className="p-2 hover:bg-white/10 rounded transition text-gray-300 hover:text-white"
                title={connectionStyle === 'curved' ? "Straight Lines" : "Curved Lines"}
            >
                {connectionStyle === 'curved' ? <Spline size={20} /> : <Minus size={20} className="rotate-45" />}
            </button>
            <button 
                onClick={toggleConnectionWidth} 
                className="p-2 hover:bg-white/10 rounded transition text-gray-300 hover:text-white flex items-center justify-center"
                title="Line Thickness"
            >
                <div className="flex flex-col gap-[2px] items-center justify-center h-5 w-5">
                   <div className={`w-4 bg-current rounded-full transition-all ${connectionWidth === 2 ? 'h-[1px] opacity-100' : 'h-[1px] opacity-40'}`} />
                   <div className={`w-4 bg-current rounded-full transition-all ${connectionWidth === 4 ? 'h-[2px] opacity-100' : 'h-[2px] opacity-40'}`} />
                   <div className={`w-4 bg-current rounded-full transition-all ${connectionWidth === 8 ? 'h-[4px] opacity-100' : 'h-[4px] opacity-40'}`} />
                </div>
            </button>
            <button 
                onClick={toggleConnectionLabels} 
                className={`p-2 rounded transition flex items-center justify-center ${showConnectionLabels ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                title="Toggle Connection Labels"
            >
                <Type size={20} />
            </button>
        </div>
      </div>

      {/* --- Modals --- */}
      <VoiceChatPanel 
          isOpen={isVoiceChatOpen}
          onClose={() => setIsVoiceChatOpen(false)}
          isActive={isLiveSessionActive}
          onToggleSession={() => handleToggleLiveSession('voice_chat')}
          messages={voiceChatMessages}
      />

      {isVisionModeOpen && (
          <VisionMode 
              stream={liveStream} 
              isActive={isLiveSessionActive} 
              onClose={() => setIsVisionModeOpen(false)}
              onToggleMic={() => { /* Mic toggle logic if needed, currently handled by session */ }}
              isMicOn={true}
          />
      )}

      <EventModal 
        isOpen={isEventModalOpen} 
        onClose={() => setIsEventModalOpen(false)} 
        cards={cards} 
        events={events}
        onSaveEvent={handleSaveEvent}
      />
      <CalendarModal 
        isOpen={isCalendarModalOpen} 
        onClose={() => setIsCalendarModalOpen(false)} 
        cards={cards} 
        events={events}
        onApplySchedule={handleApplySchedule}
        onBatchUpdate={handleBatchUpdate}
        onUnschedule={handleUnscheduleTask}
        scheduledCount={scheduledTaskCount}
      />
      <TaskOrderModal 
        isOpen={isTaskOrderModalOpen}
        onClose={() => setIsTaskOrderModalOpen(false)}
        cards={cards}
        events={events}
        isRoutineActive={isFocusMode && activeRoutineIds.length > 0}
        onReorder={handleReorderCards}
        onStart={handleStartRoutine}
        onStop={handleStopRoutine}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        visualSettings={cardVisualSettings}
        behaviorSettings={cardBehaviorSettings}
        onUpdateVisual={setCardVisualSettings}
        onUpdateBehavior={setCardBehaviorSettings}
      />
      <ShortcutsModal 
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
        shortcuts={shortcuts}
        onUpdateShortcuts={setShortcuts}
      />
      <HistoryPanel 
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
        cards={cards}
      />
      {editingTimerCardId && (
          <TimerSettingsModal 
            isOpen={!!editingTimerCardId}
            onClose={() => setEditingTimerCardId(null)}
            card={cards.find(c => c.id === editingTimerCardId)!}
            onUpdate={(updates) => handleUpdateCard(editingTimerCardId, updates)}
            onAiOptimize={handleAiOptimize}
            isAiOptimizing={isAiOptimizing}
          />
      )}

      {/* --- Connecting Indicator --- */}
      {connectingFromId && !isFocusMode && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-500/20 text-yellow-300 border border-yellow-500 px-4 py-2 rounded-full animate-pulse backdrop-blur">
              Click another card or node to connect... 
              <button onClick={() => setConnectingFromId(null)} className="ml-4 text-white underline font-bold">Cancel</button>
          </div>
      )}
      
      {/* --- Canvas --- */}
      <div 
        ref={containerRef}
        className={`w-full h-full ${isFocusMode && isCameraLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{
            backgroundImage: isFocusMode ? 'none' : 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundColor: isFocusMode ? '#000' : 'transparent',
            backgroundSize: '30px 30px',
            transition: 'background-color 0.5s ease'
        }}
      >
        <div 
            className="absolute left-1/2 top-1/2 w-0 h-0 transition-transform duration-500 ease-in-out will-change-transform"
            style={{ 
                transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` 
            }}
        >
            {!isFocusMode && (
                <ConnectionLayer 
                    connections={connections} 
                    cards={visibleCards} 
                    connectionStyle={connectionStyle}
                    strokeWidth={connectionWidth}
                    showLabels={showConnectionLabels}
                />
            )}
            
            {cardsToRender.map(card => {
                // Calculate connections for Info view
                const connectionCount = connections.filter(c => c.fromId === card.id || c.toId === card.id).length;
                return (
                    <CardNode 
                        key={card.id}
                        card={card}
                        visualSettings={cardVisualSettings}
                        behaviorSettings={cardBehaviorSettings}
                        isSelected={selectedCardId === card.id}
                        isActiveTask={activeTask?.id === card.id}
                        isNextTask={nextTask?.id === card.id}
                        onUpdate={handleUpdateCard}
                        onDelete={deleteCard}
                        onSelect={handleSelectCard}
                        onStartDrag={handleCardDragStart}
                        onConnectStart={handleConnectStart}
                        onBreakdown={handleBreakdown}
                        onSnooze={handleSnooze}
                        onSkip={handleSkip}
                        onCompleteTask={handleCompleteTask}
                        onAutoDuration={handleAutoDuration}
                        onTimerClick={(id) => setEditingTimerCardId(id)}
                        connectionCount={connectionCount}
                    />
                );
            })}
        </div>
      </div>

      {/* --- Chat Panel --- */}
      <div className={`absolute right-0 top-0 h-full w-80 bg-dark-800/95 border-l border-white/10 shadow-2xl transform transition-transform duration-300 flex flex-col z-50 ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-bold flex items-center gap-2"><Target className="text-purple-400" /> AI Assistant</h2>
              <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                  <div className="text-gray-500 text-sm text-center mt-10">
                      Ask me to create tasks, organize your layout, or connect cards in a sequence.
                  </div>
              )}
              {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-dark-700 text-gray-200'}`}>
                          {msg.text}
                      </div>
                  </div>
              ))}
          </div>
          <div className="p-4 border-t border-white/10">
              <div className="relative">
                  <input 
                    className="w-full bg-dark-900 border border-gray-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-purple-500 pr-10"
                    placeholder="Ask AI..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button onClick={() => handleSendMessage()} className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white" disabled={isAiProcessing}>
                      {isAiProcessing ? <Activity size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
              </div>
          </div>
      </div>
      
      {/* Help / Shortcuts Overlay */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-500 pointer-events-none select-none">
          Click the circle node to connect cards • Double-click card to edit • Scroll to Zoom
      </div>
    </div>
  );
}

export default App;