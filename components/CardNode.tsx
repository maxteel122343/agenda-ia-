
import React, { useState, useRef, useEffect } from 'react';
import { CardData, Attachment, CardVisualSettings, CardBehaviorSettings, CardShape, CardColor } from '../types';
import PizzaTimer from './PizzaTimer';
import { MoreHorizontal, Image as ImageIcon, Trash2, CheckCircle, Wand2, Info, X, Clock, Calendar, Check, Mic, Paperclip, Music, Tag, Link, ArrowRight, Ban, Play, PauseCircle, Hourglass, Coffee, Layers, Activity, Settings, Hexagon, Circle, Square, Diamond } from 'lucide-react';
import { generateCardImage, breakDownTask } from '../services/geminiService';

interface CardNodeProps {
  card: CardData;
  visualSettings?: CardVisualSettings;
  behaviorSettings?: CardBehaviorSettings;
  isSelected: boolean;
  isActiveTask: boolean;
  isNextTask: boolean;
  onUpdate: (id: string, updates: Partial<CardData>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
  onConnectStart: (id: string) => void;
  onBreakdown: (id: string, steps: any[]) => void;
  onSnooze?: (id: string) => void;
  onSkip?: (id: string) => void;
  onCompleteTask?: (id: string) => void;
  onAutoDuration?: (id: string) => void;
  onTimerClick?: (id: string) => void;
  connectionCount?: number;
}

const CardNode: React.FC<CardNodeProps> = React.memo(({
  card,
  visualSettings,
  behaviorSettings,
  isSelected,
  isActiveTask,
  isNextTask,
  onUpdate,
  onDelete,
  onSelect,
  onStartDrag,
  onConnectStart,
  onBreakdown,
  onSnooze,
  onSkip,
  onCompleteTask,
  onAutoDuration,
  onTimerClick,
  connectionCount = 0
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Timing Phases: 'idle' | 'pre-active' (Warmup) | 'active' (Working) | 'paused' | 'post-active' (Cooldown) | 'finished'
  const [phase, setPhase] = useState<'idle' | 'pre-active' | 'active' | 'paused' | 'post-active' | 'finished'>('idle');
  const [subTimer, setSubTimer] = useState(0); // Used for pre-time and post-time countdowns
  const [pausesTaken, setPausesTaken] = useState(0);
  
  // Overtime Tracking (Negative Time)
  const [overtimeStart, setOvertimeStart] = useState<number | null>(null);
  const [waitingForClickPhase, setWaitingForClickPhase] = useState<string | null>(null); // 'timer-start', 'interval-start', 'interval-end', 'task-end', 'post-start', 'post-end'
  const [showSettings, setShowSettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // --- Shape Styles ---
  const getShapeStyles = () => {
      const shape = card.shape || 'rectangle';
      const baseStyles = "relative transition-all duration-300 group";
      
      switch (shape) {
          case 'circle':
              return `${baseStyles} rounded-full aspect-square flex flex-col justify-center items-center text-center p-6`;
          case 'hexagon':
              return `${baseStyles} clip-path-hexagon p-8 flex flex-col justify-center items-center text-center`; 
          case 'diamond':
              return `${baseStyles} rotate-45 p-8 flex flex-col justify-center items-center text-center`;
          case 'rectangle':
          default:
              return `${baseStyles} rounded-2xl`;
      }
  };

  const getInnerContentStyles = () => {
      const shape = card.shape || 'rectangle';
      if (shape === 'diamond') return "rotate-[-45deg]"; // Counter-rotate content
      return "";
  };

  // --- Color Styles ---
  const getColorStyles = () => {
    const isCompleted = card.status === 'completed';
    const isSkipped = card.status === 'skipped';
    
    if (isCompleted) return 'bg-dark-800 border-green-500/50 opacity-75 grayscale-[0.5]';
    if (isSkipped) return 'bg-dark-800 border-gray-600/50 opacity-50';

    const colors = {
      red: 'bg-red-950/40 border-red-500/50 hover:border-red-400',
      yellow: 'bg-yellow-950/40 border-yellow-500/50 hover:border-yellow-400',
      purple: 'bg-purple-950/40 border-purple-500/50 hover:border-purple-400',
      blue: 'bg-blue-950/40 border-blue-500/50 hover:border-blue-400',
      green: 'bg-green-950/40 border-green-500/50 hover:border-green-400',
    };
    
    const activeClass = isActiveTask ? 'ring-2 ring-white shadow-[0_0_30px_rgba(255,255,255,0.1)] scale-105 z-20' : '';
    const nextClass = isNextTask ? 'border-dashed border-2' : '';
    const selectedClass = isSelected ? 'ring-2 ring-blue-400 z-10' : '';
    
    return `${colors[card.color]} border backdrop-blur-md ${activeClass} ${nextClass} ${selectedClass}`;
  };
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- Default Settings ---
  const settings = visualSettings || {
      showImage: true, showTitle: true, showDescription: true, showTimer: true, showCompleteBtn: true,
      showDeleteBtn: true, showSchedule: true, showIntervals: true, showTags: true, showLastCompleted: true,
      showCompletionCount: true, showAttachmentIndicator: true, showAttachmentActions: true
  };

  const behavior = behaviorSettings || {
      preTimeSeconds: 0, postTimeSeconds: 0, maxPauses: 3, pauseDuration: 5, pauseDurationMode: 'fixed',
      requireClickToStart: false, requireClickToFinish: false, autoFlowAfterPostTime: true,
      requireClickToStartTimer: false, requireClickToStartInterval: false, requireClickToEndInterval: false,
      requireClickToStartPostTime: false, requireClickToFinishPostTime: false
  };

  // --- Logic Handling ---

  const logMetric = (phaseName: any, expectedTime: number) => {
      const actualTime = Date.now();
      const delaySeconds = (actualTime - expectedTime) / 1000;
      const negativeTime = overtimeStart ? (actualTime - overtimeStart) / 1000 : 0;
      
      const newMetric = {
          phase: phaseName,
          expectedTime,
          actualTime,
          delaySeconds,
          negativeTime: negativeTime > 0 ? negativeTime : undefined
      };
      
      onUpdate(card.id, { metrics: [...(card.metrics || []), newMetric] });
      setOvertimeStart(null);
      setWaitingForClickPhase(null);
  };

  // Handle Parent State Changes (when App.tsx sets card.status)
  useEffect(() => {
    if (card.status === 'active' && phase === 'idle') {
        // App wants this card to be active. Check behavior rules.
        if (behavior.requireClickToStart) {
             // Wait for user click, technically we are active in global state but locally "ready"
             // Visuals will show a "Start" overlay
             setWaitingForClickPhase('pre-start');
        } else {
             startSequence();
        }
    } else if (card.status === 'pending' && phase !== 'idle') {
        // Reset if moved back to pending
        setPhase('idle');
        setSubTimer(0);
        setOvertimeStart(null);
        setWaitingForClickPhase(null);
    } else if (card.status === 'completed' && phase !== 'finished') {
        setPhase('finished');
    }
  }, [card.status, behavior.requireClickToStart]);

  const startSequence = () => {
      if (behavior.preTimeSeconds > 0) {
          setPhase('pre-active');
          setSubTimer(behavior.preTimeSeconds);
      } else {
          setPhase('active');
      }
  };

  const initiatePause = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pausesTaken < behavior.maxPauses) {
          setPhase('paused');
          
          let duration = behavior.pauseDuration;
          if (behavior.pauseDurationMode === 'percent') {
              duration = Math.floor((behavior.pauseDuration / 100) * card.timerTotal);
          }
          setSubTimer(duration);
          setPausesTaken(p => p + 1);
      }
  };

  const cancelPause = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setPhase('active');
      setSubTimer(0);
  };

  const checkIntervalCompletion = () => {
      // Check if this is a Batch Task (has intervals > 1)
      if (card.intervals && card.intervals.count > 1) {
          const current = card.currentInterval || 1;
          if (current < card.intervals.count) {
              // Proceed to next interval
              onUpdate(card.id, {
                  currentInterval: current + 1,
                  timerRemaining: card.intervals.duration // Reset Timer
              });
              playBeep(); // Audio feedback for "Next Round"
              return true; // Interval handled
          }
      }
      return false; // No more intervals, really finished
  };

  const finishTask = (auto: boolean = false) => {
      // Logic for interval cards (Batch Tasks)
      if (checkIntervalCompletion()) {
          return; 
      }

      const proceedToPost = () => {
          if (behavior.postTimeSeconds > 0) {
              if (behavior.requireClickToStartPostTime) {
                  setWaitingForClickPhase('post-start');
                  setOvertimeStart(Date.now());
              } else {
                  setPhase('post-active');
                  setSubTimer(behavior.postTimeSeconds);
              }
          } else {
              triggerCompletion();
          }
      };

      if (auto) {
          // Timer ended naturally
          if (behavior.requireClickToFinish) {
               setWaitingForClickPhase('task-end');
               setOvertimeStart(Date.now());
          } else {
               proceedToPost();
          }
      } else {
          // Manual finish
          proceedToPost();
      }
  };

  const triggerCompletion = () => {
      if (onCompleteTask) {
          onCompleteTask(card.id);
      } else {
          onUpdate(card.id, { 
              status: 'completed', 
              timerRemaining: 0, 
              completionCount: (card.completionCount || 0) + 1, 
              lastCompleted: Date.now() 
          });
      }
      setPhase('finished');
  };

  // --- Timer Tick Effect ---
  useEffect(() => {
    let interval: any;

    if (waitingForClickPhase) {
        // In overtime/waiting mode, we just track time passing if needed, or do nothing
        // The UI should show the "Waiting" state
        return;
    }

    if (phase === 'pre-active') {
        interval = setInterval(() => {
            setSubTimer(prev => {
                if (prev <= 1) {
                    if (behavior.requireClickToStartTimer) {
                        setWaitingForClickPhase('timer-start');
                        setOvertimeStart(Date.now());
                        return 0;
                    }
                    setPhase('active');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    } 
    else if (phase === 'active' && card.status === 'active') {
        interval = setInterval(() => {
            onUpdate(card.id, { timerRemaining: Math.max(0, card.timerRemaining - 1) });
            
            // 30 Seconds Warning
            if (card.timerRemaining === 31) { // 31 because state updates next tick
                 playBeep();
            }
            // Finished
            if (card.timerRemaining <= 0) {
                 // Check if interval logic handles it, otherwise stop and finish
                 // We call finishTask(true) which handles intervals internally
                 if (card.intervals && card.intervals.count > 1 && (card.currentInterval || 1) < card.intervals.count) {
                     // Auto-advance interval without stopping ticker effectively
                     if (behavior.requireClickToEndInterval) {
                         setWaitingForClickPhase('interval-end');
                         setOvertimeStart(Date.now());
                     } else {
                         checkIntervalCompletion();
                     }
                 } else {
                     clearInterval(interval);
                     playAlarm();
                     finishTask(true);
                 }
            }
        }, 1000);
    }
    else if (phase === 'paused') {
        interval = setInterval(() => {
            setSubTimer(prev => {
                if (prev <= 1) {
                    setPhase('active'); // Auto resume after pause
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    else if (phase === 'post-active') {
        interval = setInterval(() => {
             setSubTimer(prev => {
                 if (prev <= 1) {
                     if (behavior.requireClickToFinishPostTime) {
                         setWaitingForClickPhase('post-end');
                         setOvertimeStart(Date.now());
                         return 0;
                     }

                     if (behavior.autoFlowAfterPostTime) {
                         triggerCompletion();
                     } else {
                         // Wait for user to click "Next"
                         clearInterval(interval);
                     }
                     return 0;
                 }
                 return prev - 1;
             });
        }, 1000);
    }

    return () => clearInterval(interval);
  }, [phase, card.status, card.timerRemaining, behavior, card.id, card.intervals, card.currentInterval, waitingForClickPhase]);

  // --- Sound Helpers ---
  const playBeep = () => {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
  };

  const playAlarm = () => {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1);
  };


  // --- Event Handlers ---

  const handleManualClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If waiting for start
    if (waitingForClickPhase === 'pre-start') {
        logMetric('pre-start', Date.now()); // Expected was now-ish
        startSequence();
        return;
    }

    // If waiting for timer start (after pre-time)
    if (waitingForClickPhase === 'timer-start') {
        logMetric('timer-start', overtimeStart || Date.now());
        setPhase('active');
        return;
    }

    // If waiting for interval start
    // (Not implemented in this pass, but structure is here)
    
    // If waiting for interval end
    if (waitingForClickPhase === 'interval-end') {
        logMetric('interval-end', overtimeStart || Date.now());
        checkIntervalCompletion();
        return;
    }

    // If waiting for task end (timer finished)
    if (waitingForClickPhase === 'task-end') {
        logMetric('task-end', overtimeStart || Date.now());
        if (behavior.postTimeSeconds > 0) {
             if (behavior.requireClickToStartPostTime) {
                  setWaitingForClickPhase('post-start');
                  setOvertimeStart(Date.now());
             } else {
                  setPhase('post-active');
                  setSubTimer(behavior.postTimeSeconds);
             }
        } else {
             triggerCompletion();
        }
        return;
    }

    // If waiting for post-time start
    if (waitingForClickPhase === 'post-start') {
        logMetric('post-start', overtimeStart || Date.now());
        setPhase('post-active');
        setSubTimer(behavior.postTimeSeconds);
        return;
    }

    // If waiting for post-time end
    if (waitingForClickPhase === 'post-end') {
        logMetric('post-end', overtimeStart || Date.now());
        triggerCompletion();
        return;
    }

    // If we require click to start and we are in that limbo state (fallback)
    if (card.status === 'active' && phase === 'idle' && behavior.requireClickToStart) {
        startSequence();
        return;
    }

    // Interval Click Logic (Green Card Feature)
    if (card.status === 'active' && card.intervals && card.intervals.count > 1) {
        // If clicking an active interval card, it means "Done with this rep, next please"
        // It does NOT pause.
        if (checkIntervalCompletion()) {
            return;
        }
    }

    // Toggle logic for standard non-behavioral use
    if (card.status === 'active' && (phase === 'active' || phase === 'pre-active')) {
      // If clicking active card, toggle to pending
      onUpdate(card.id, { status: 'pending' });
      setPhase('idle');
    } else {
      onUpdate(card.id, { status: 'active' });
    }
  };

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (phase === 'post-active' && !behavior.autoFlowAfterPostTime) {
        triggerCompletion();
        return;
    }
    
    // Handle Interval Completion via button
    if (card.status === 'active' && checkIntervalCompletion()) {
        return;
    }

    if (card.status !== 'completed') {
        finishTask(false);
    } else {
        onUpdate(card.id, { status: 'pending' });
        setPhase('idle');
    }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImg(true);
    const imgData = await generateCardImage(card.title, card.description);
    if (imgData) {
      onUpdate(card.id, { imageUrl: imgData });
    }
    setIsGeneratingImg(false);
  };

  const handleBreakdown = async () => {
    setIsBreakingDown(true);
    const steps = await breakDownTask(card.title);
    if (steps.length > 0) {
        onBreakdown(card.id, steps);
    }
    setIsBreakingDown(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isCover: boolean = true) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
          if (isCover) {
             onUpdate(card.id, { imageUrl: reader.result as string });
          } else {
             // Attachment
             const newAttachment: Attachment = {
                 id: crypto.randomUUID(),
                 type: 'image',
                 url: reader.result as string,
                 timestamp: Date.now()
             };
             onUpdate(card.id, { attachments: [...(card.attachments || []), newAttachment] });
          }
      };
      reader.readAsDataURL(file);
    }
  };

  // Audio Recording
  const toggleRecording = async () => {
      if (isRecording) {
          mediaRecorderRef.current?.stop();
          setIsRecording(false);
      } else {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const mediaRecorder = new MediaRecorder(stream);
              mediaRecorderRef.current = mediaRecorder;
              audioChunksRef.current = [];

              mediaRecorder.ondataavailable = (event) => {
                  audioChunksRef.current.push(event.data);
              };

              mediaRecorder.onstop = () => {
                  const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                  const reader = new FileReader();
                  reader.onloadend = () => {
                      const base64Audio = reader.result as string;
                      const newAttachment: Attachment = {
                          id: crypto.randomUUID(),
                          type: 'audio',
                          url: base64Audio,
                          timestamp: Date.now()
                      };
                      onUpdate(card.id, { attachments: [...(card.attachments || []), newAttachment] });
                  };
                  reader.readAsDataURL(audioBlob);
                  stream.getTracks().forEach(track => track.stop());
              };

              mediaRecorder.start();
              setIsRecording(true);
          } catch (err) {
              console.error("Microphone access denied", err);
          }
      }
  };

  const formatTimeSince = (timestamp?: number) => {
      if (!timestamp) return 'Never';
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return `${seconds}s ago`;
      if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds/3600)}h ago`;
      return `${Math.floor(seconds/86400)}d ago`;
  };

  const formatScheduledTime = (iso?: string) => {
      if (!iso) return 'Not scheduled';
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', weekday: 'short' });
  };

  // Color border classes
  const borderColor = {
    red: 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
    yellow: 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]',
    purple: 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]',
    blue: 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
    green: 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]',
  }[card.color];

  // --- Note Rendering (Post-it Style) ---
  if (card.type === 'note') {
      const noteColorClass = {
          red: 'bg-red-200 text-red-900',
          yellow: 'bg-yellow-200 text-yellow-900',
          purple: 'bg-purple-200 text-purple-900',
          blue: 'bg-blue-200 text-blue-900',
          green: 'bg-green-200 text-green-900',
      }[card.color];

      return (
        <div
            className={`absolute flex flex-col w-64 min-h-[16rem] shadow-xl transform rotate-1 transition-all duration-200 group
                ${noteColorClass}
                ${isSelected ? 'ring-4 ring-white/50 z-40 scale-105' : 'z-10 hover:z-30 hover:rotate-0'}
            `}
            style={{ transform: `translate(${card.x}px, ${card.y}px) rotate(${isSelected ? 0 : 1}deg)` }}
            onClick={(e) => { e.stopPropagation(); onSelect(card.id); }}
            onMouseDown={(e) => onStartDrag(e, card.id)}
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
        >
            {/* Pin / Drag Handle */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 shadow-sm border border-black/20 z-20" />

            {/* Content */}
            <div className="p-6 flex-1 flex flex-col font-mono">
                {isEditing ? (
                    <>
                        <input 
                            className="bg-transparent border-b border-black/20 text-lg font-bold focus:outline-none w-full mb-2 placeholder-black/30"
                            value={card.title}
                            onChange={(e) => onUpdate(card.id, { title: e.target.value })}
                            placeholder="Title"
                        />
                        <textarea 
                            className="bg-transparent flex-1 resize-none focus:outline-none w-full text-sm placeholder-black/30"
                            value={card.description}
                            onChange={(e) => onUpdate(card.id, { description: e.target.value })}
                            placeholder="Note content..."
                        />
                        {/* Color Picker for Note */}
                        <div className="flex gap-1 mt-2 mb-2">
                            {(['red', 'yellow', 'purple', 'blue', 'green'] as const).map(c => (
                                <button 
                                    key={c}
                                    onClick={() => onUpdate(card.id, { color: c })}
                                    className={`w-4 h-4 rounded-full border border-black/20 ${c === 'red' ? 'bg-red-400' : c === 'yellow' ? 'bg-yellow-400' : c === 'purple' ? 'bg-purple-400' : c === 'blue' ? 'bg-blue-400' : 'bg-green-400'} ${card.color === c ? 'ring-2 ring-black/30' : ''}`}
                                />
                            ))}
                        </div>
                        {/* Tag Editor for Note */}
                        <input 
                            className="bg-transparent border-b border-black/10 text-xs focus:outline-none w-full placeholder-black/30 font-mono"
                            value={card.tags?.join(', ') || ''}
                            onChange={(e) => onUpdate(card.id, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                            placeholder="Tags (comma separated)..."
                        />
                    </>
                ) : (
                    <>
                        <h3 className="text-xl font-bold mb-2 leading-tight">{card.title}</h3>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed opacity-90">{card.description}</p>
                    </>
                )}
            </div>

            {/* Footer Actions */}
            <div className="px-4 pb-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="flex gap-1">
                    {card.tags.map((tag, i) => (
                        <span key={i} className="text-[10px] bg-black/10 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                 </div>
                 <button onClick={() => onDelete(card.id)} className="text-black/40 hover:text-red-600">
                    <Trash2 size={16} />
                 </button>
            </div>
        </div>
      );
  }

  // --- Standard Card Rendering ---
  return (
    <div
      className={`absolute flex flex-col w-64 bg-dark-800/90 backdrop-blur-md border-2 rounded-xl overflow-visible transition-all duration-200 group
        ${isSelected ? 'ring-2 ring-white z-40 scale-105' : 'z-10 hover:z-30'}
        ${isNextTask ? 'animate-pulse ring-2 ring-yellow-400' : ''}
        ${card.status === 'completed' ? 'opacity-60 grayscale' : ''}
        ${card.status === 'skipped' ? 'opacity-50 border-dashed' : ''}
        ${borderColor}
      `}
      style={{
        transform: `translate(${card.x}px, ${card.y}px)`,
      }}
      onClick={(e) => {
          e.stopPropagation();
          onSelect(card.id);
          onConnectStart(card.id); 
      }}
      onDoubleClick={(e) => {
          e.stopPropagation();
          setIsEditing(!isEditing);
      }}
    >
        {/* Connection Handle */}
        <div 
            className={`absolute -top-3 -right-3 w-6 h-6 rounded-full border-4 border-dark-900 cursor-crosshair z-50 transition-transform hover:scale-125
                ${isSelected ? 'bg-white' : `bg-${card.color}-500`}
            `}
            style={{ backgroundColor: card.color === 'red' ? '#ef4444' : card.color === 'yellow' ? '#eab308' : card.color === 'purple' ? '#a855f7' : card.color === 'blue' ? '#3b82f6' : '#22c55e' }}
            title="Drag or Click to Connect"
            onClick={(e) => {
                e.stopPropagation();
                onConnectStart(card.id);
            }}
        />

        {/* --- INTERACTION OVERLAYS --- */}
        
        {/* Click To Start Overlay */}
        {card.status === 'active' && (phase === 'idle' || waitingForClickPhase === 'pre-start') && behavior.requireClickToStart && (
             <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center animate-in fade-in" onClick={handleManualClick}>
                 <Play size={40} className="text-white animate-pulse" />
                 <span className="text-xs font-bold mt-2">Click to Start</span>
             </div>
        )}

        {/* Waiting For Timer Start Overlay */}
        {waitingForClickPhase === 'timer-start' && (
             <div className="absolute inset-0 z-50 bg-yellow-900/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center animate-in fade-in" onClick={handleManualClick}>
                 <Play size={32} className="text-yellow-400 animate-bounce" />
                 <span className="text-xs font-bold mt-2 text-yellow-100">Warmup Done! Start Timer?</span>
                 {overtimeStart && <span className="text-[10px] text-red-400 mt-1">Delay: {Math.floor((Date.now() - overtimeStart)/1000)}s</span>}
             </div>
        )}

        {/* Waiting For Task End Overlay */}
        {waitingForClickPhase === 'task-end' && (
             <div className="absolute inset-0 z-50 bg-red-900/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center animate-in fade-in" onClick={handleManualClick}>
                 <CheckCircle size={32} className="text-white animate-pulse" />
                 <span className="text-xs font-bold mt-2 text-white">Timer Finished! Mark Done?</span>
                 {overtimeStart && <span className="text-[10px] text-red-300 mt-1">Overtime: {Math.floor((Date.now() - overtimeStart)/1000)}s</span>}
             </div>
        )}

        {/* Waiting For Post-Start Overlay */}
        {waitingForClickPhase === 'post-start' && (
             <div className="absolute inset-0 z-50 bg-purple-900/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center animate-in fade-in" onClick={handleManualClick}>
                 <Clock size={32} className="text-purple-300 animate-bounce" />
                 <span className="text-xs font-bold mt-2 text-purple-100">Start Cooldown?</span>
                 {overtimeStart && <span className="text-[10px] text-red-400 mt-1">Delay: {Math.floor((Date.now() - overtimeStart)/1000)}s</span>}
             </div>
        )}

        {/* Waiting For Post-End Overlay */}
        {waitingForClickPhase === 'post-end' && (
             <div className="absolute inset-0 z-50 bg-green-900/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center animate-in fade-in" onClick={handleManualClick}>
                 <CheckCircle size={32} className="text-green-300 animate-pulse" />
                 <span className="text-xs font-bold mt-2 text-green-100">Cooldown Done! Finish?</span>
                 {overtimeStart && <span className="text-[10px] text-red-400 mt-1">Overtime: {Math.floor((Date.now() - overtimeStart)/1000)}s</span>}
             </div>
        )}

        {/* Pre-Time Overlay */}
        {phase === 'pre-active' && !waitingForClickPhase && (
            <div className="absolute inset-0 z-50 bg-yellow-900/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center animate-in fade-in">
                <Hourglass size={32} className="text-yellow-400 animate-spin" />
                <span className="text-lg font-bold text-white mt-1">{subTimer}s</span>
                <span className="text-xs uppercase tracking-widest text-yellow-200">Warm Up</span>
            </div>
        )}

        {/* Pause Overlay */}
        {phase === 'paused' && (
            <div className="absolute inset-0 z-50 bg-blue-900/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center animate-in fade-in">
                <Coffee size={32} className="text-blue-300" />
                <span className="text-lg font-bold text-white mt-1">{subTimer}s</span>
                <span className="text-xs uppercase tracking-widest text-blue-200">Paused</span>
                <button onClick={(e) => cancelPause(e)} className="mt-2 text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30">Resume</button>
            </div>
        )}

         {/* Post-Time Overlay */}
         {phase === 'post-active' && (
            <div className="absolute inset-0 z-50 bg-purple-900/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center animate-in fade-in">
                <Clock size={32} className="text-purple-300 animate-bounce" />
                <span className="text-lg font-bold text-white mt-1">{subTimer}s</span>
                <span className="text-xs uppercase tracking-widest text-purple-200">Cooldown</span>
                {!behavior.autoFlowAfterPostTime && subTimer === 0 && (
                     <button onClick={handleComplete} className="mt-2 bg-purple-500 hover:bg-purple-400 text-white font-bold py-1 px-3 rounded animate-pulse">
                         Next Task &rarr;
                     </button>
                )}
            </div>
        )}

        {/* --- INFO OVERLAY (FLIP CARD EFFECT) --- */}
        {showInfo && (
            <div className="absolute inset-0 z-50 bg-dark-900 rounded-xl flex flex-col overflow-hidden animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                {/* Info Header */}
                <div className="h-12 border-b border-white/10 flex items-center justify-between px-3 bg-dark-800">
                    <span className="text-xs font-bold text-gray-300 uppercase flex items-center gap-1">
                        <Info size={14} className="text-blue-400"/> Detailed Info
                    </span>
                    <button onClick={() => setShowInfo(false)} className="hover:bg-white/10 p-1 rounded"><X size={16} /></button>
                </div>
                
                {/* Info Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                    
                    {/* Basic Stats Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-dark-800 p-2 rounded border border-white/5">
                            <span className="text-[10px] text-gray-500 block">Status</span>
                            <span className={`text-xs font-bold capitalize ${card.status === 'completed' ? 'text-green-500' : card.status === 'skipped' ? 'text-red-400' : 'text-white'}`}>{card.status}</span>
                        </div>
                        {settings.showSchedule && (
                            <div className="bg-dark-800 p-2 rounded border border-white/5">
                                <span className="text-[10px] text-gray-500 block">Scheduled</span>
                                <span className="text-xs text-white truncate">{formatScheduledTime(card.scheduledStart)}</span>
                            </div>
                        )}
                        {settings.showCompletionCount && (
                            <div className="bg-dark-800 p-2 rounded border border-white/5">
                                <span className="text-[10px] text-gray-500 block">Completed</span>
                                <span className="text-xs font-bold text-white">{card.completionCount || 0} times</span>
                            </div>
                        )}
                        {settings.showLastCompleted && (
                            <div className="bg-dark-800 p-2 rounded border border-white/5">
                                <span className="text-[10px] text-gray-500 block">Last Done</span>
                                <span className="text-xs text-gray-300">{formatTimeSince(card.lastCompleted)}</span>
                            </div>
                        )}
                    </div>

                    {/* Intervals Detail */}
                    {card.intervals && card.intervals.count > 1 && (
                        <div className="bg-green-900/20 p-2 rounded border border-green-500/30">
                            <span className="text-[10px] text-green-400 block mb-1 font-bold">BATCH PROGRESS</span>
                            <div className="flex items-center justify-between text-xs text-white mb-1">
                                <span>Round {card.currentInterval || 1} of {card.intervals.count}</span>
                                <span>{Math.round(((card.currentInterval || 1) / card.intervals.count) * 100)}%</span>
                            </div>
                            <div className="h-2 w-full bg-dark-900 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-green-500 transition-all duration-500" 
                                    style={{ width: `${((card.currentInterval || 1) / card.intervals.count) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    {settings.showTags && card.tags && card.tags.length > 0 && (
                        <div>
                             <span className="text-[10px] text-gray-500 block mb-1">TAGS</span>
                             <div className="flex flex-wrap gap-1">
                                 {card.tags.map((tag, i) => (
                                     <span key={i} className="text-[10px] bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">{tag}</span>
                                 ))}
                             </div>
                        </div>
                    )}

                    {/* Attachments & Notes */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-gray-500">ATTACHMENTS ({card.attachments?.length || 0})</span>
                            {settings.showAttachmentActions && (
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => attachmentInputRef.current?.click()}
                                        className="p-1 bg-gray-700 hover:bg-white/20 rounded text-gray-300" 
                                        title="Upload File"
                                    >
                                        <Paperclip size={12} />
                                    </button>
                                    <button 
                                        onClick={toggleRecording}
                                        className={`p-1 rounded text-white ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-700 hover:bg-white/20'}`}
                                        title="Record Audio"
                                    >
                                        <Mic size={12} />
                                    </button>
                                    <input type="file" ref={attachmentInputRef} className="hidden" onChange={(e) => handleFileUpload(e, false)} />
                                </div>
                            )}
                        </div>
                        
                        <div className="space-y-2">
                            {card.attachments?.map(att => (
                                <div key={att.id} className="bg-dark-800 p-2 rounded border border-white/5 flex items-center gap-2 group/att">
                                    {att.type === 'image' ? (
                                        <img src={att.url} alt="attachment" className="w-8 h-8 rounded object-cover border border-gray-600" />
                                    ) : (
                                        <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center">
                                            <Music size={14} className="text-gray-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] text-gray-500">{new Date(att.timestamp).toLocaleTimeString()}</div>
                                        {att.type === 'audio' && (
                                            <audio src={att.url} controls className="h-6 w-full mt-1" />
                                        )}
                                    </div>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdate(card.id, { attachments: card.attachments?.filter(a => a.id !== att.id) });
                                        }}
                                        className="opacity-0 group-hover/att:opacity-100 hover:text-red-400"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Metrics Download */}
                    {card.metrics && card.metrics.length > 0 && (
                        <div className="pt-2 border-t border-white/5">
                            <button 
                                onClick={() => {
                                    const blob = new Blob([JSON.stringify(card.metrics, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `metrics-${card.title.replace(/\s+/g, '-')}.json`;
                                    a.click();
                                }}
                                className="w-full py-2 bg-dark-800 hover:bg-dark-700 text-xs text-gray-400 rounded flex items-center justify-center gap-2"
                            >
                                <Activity size={12} /> Download Behavioral Metrics
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}


        {/* --- MAIN CARD FACE --- */}

        {/* Header/Drag Handle */}
        <div 
            className="h-7 bg-white/5 cursor-grab active:cursor-grabbing w-full flex items-center justify-between px-2 rounded-t-lg relative"
            onMouseDown={(e) => onStartDrag(e, card.id)}
        >
            <div className={`w-2 h-2 rounded-full bg-${card.color}-500`} />
            
            {/* Pause Button (Visible only when working) */}
            {card.status === 'active' && phase === 'active' && (
                <div className="absolute left-1/2 -translate-x-1/2">
                    <button 
                        onClick={initiatePause}
                        className="text-gray-400 hover:text-yellow-400 p-1"
                        title={`${behavior.maxPauses - pausesTaken} pauses left`}
                    >
                        <PauseCircle size={14} />
                    </button>
                </div>
            )}

            {/* Action Icons */}
            <div className="flex items-center gap-1 z-20">
                {settings.showAttachmentActions && (
                     <button onClick={() => attachmentInputRef.current?.click()} className="p-1 hover:bg-white/10 rounded-full text-gray-400" title="Quick Attach">
                         <Paperclip size={12} />
                     </button>
                )}
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                    className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-blue-300 transition"
                    title="Info & Stats"
                >
                    <Info size={14} />
                </button>
            </div>
        </div>

        {/* Image Area */}
        {settings.showImage && (
            <div className="h-32 w-full bg-dark-900 relative overflow-hidden group/img">
                {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <ImageIcon size={32} />
                    </div>
                )}
                
                {/* Image Overlay Controls */}
                {isEditing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover/img:opacity-100 transition-opacity z-10">
                        <button onClick={handleGenerateImage} className="p-2 bg-purple-600 rounded-full hover:bg-purple-500" disabled={isGeneratingImg}>
                        <Wand2 size={16} className={isGeneratingImg ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-blue-600 rounded-full hover:bg-blue-500">
                            <ImageIcon size={16} />
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, true)} />
                    </div>
                )}
            </div>
        )}

        {/* Content */}
        <div className="p-3 flex flex-col gap-2 relative">
            {/* Timer Overlay */}
            {settings.showTimer && (
                <div className={`absolute ${settings.showImage ? '-top-10' : '-top-2'} right-2 z-10 flex flex-col items-end gap-1`}>
                    <div 
                        className="cursor-pointer transition-transform hover:scale-110 active:scale-95 relative group/timer"
                        onClick={(e) => {
                            if (isEditing && onTimerClick) {
                                e.stopPropagation();
                                onTimerClick(card.id);
                            } else {
                                handleManualClick(e);
                            }
                        }}
                    >
                        <PizzaTimer 
                            total={card.timerTotal} 
                            remaining={card.timerRemaining} 
                            color={card.color} 
                            size={50}
                        />
                        
                        {/* Magic Duration Button */}
                        {isEditing && onAutoDuration && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAutoDuration(card.id); }}
                                className="absolute -left-6 top-1/2 -translate-y-1/2 bg-purple-600 text-white p-1 rounded-full shadow-lg hover:bg-purple-500"
                                title="Auto-Estimate Duration (AI)"
                            >
                                <Wand2 size={12} />
                            </button>
                        )}
                    </div>
                    
                    {/* Manual Duration Input */}
                    {isEditing && (
                        <input 
                            type="number" 
                            className="w-16 bg-black/50 text-white text-xs rounded px-1 text-right"
                            value={Math.round(card.timerTotal / 60)}
                            onChange={(e) => {
                                const mins = parseInt(e.target.value) || 0;
                                onUpdate(card.id, { timerTotal: mins * 60, timerRemaining: mins * 60 });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="min"
                        />
                    )}
                </div>
            )}

            {isEditing ? (
                <div className="space-y-2">
                    <input 
                        className="bg-transparent border-b border-gray-600 text-lg font-bold focus:outline-none w-full"
                        value={card.title}
                        onChange={(e) => onUpdate(card.id, { title: e.target.value })}
                        placeholder="Task Title"
                    />
                    <textarea 
                        className="bg-transparent border border-gray-700 rounded p-1 text-xs text-gray-300 focus:outline-none w-full h-16 resize-none"
                        value={card.description}
                        onChange={(e) => onUpdate(card.id, { description: e.target.value })}
                        placeholder="Description..."
                    />
                </div>
            ) : (
                <>
                    {settings.showTitle && (
                        <h3 className="text-lg font-bold truncate pr-14">{card.title}</h3>
                    )}
                    {settings.showDescription && (
                        <p className="text-xs text-gray-400 line-clamp-2 min-h-[2rem]">{card.description}</p>
                    )}
                </>
            )}

            {/* Actions */}
            {(settings.showCompleteBtn || settings.showDeleteBtn || settings.showAttachmentActions) && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
                    {settings.showCompleteBtn && (
                        <button 
                            onClick={handleComplete}
                            className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded transition-colors ${card.status === 'completed' ? 'text-green-500' : 'text-gray-400 hover:text-green-400'}`}
                        >
                            <CheckCircle size={14} /> {card.status === 'completed' ? 'Done' : 'Mark Done'}
                        </button>
                    )}

                    <div className="flex gap-1 ml-auto">
                        <button onClick={handleBreakdown} className="p-1 hover:bg-gray-700 rounded text-purple-400" title="AI Breakdown into subtasks">
                            <MoreHorizontal size={14} className={isBreakingDown ? 'animate-pulse' : ''} />
                        </button>
                        {settings.showDeleteBtn && (
                            <button onClick={() => onDelete(card.id)} className="p-1 hover:bg-gray-700 rounded text-red-400">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            {/* Notes/Stats Badge Row - Only show what is configured */}
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-gray-500">
                 {settings.showSchedule && card.scheduledStart && (
                     <span className="text-blue-400 flex items-center gap-0.5"><Clock size={10} /> {new Date(card.scheduledStart).getHours()}:{new Date(card.scheduledStart).getMinutes().toString().padStart(2,'0')}</span>
                 )}
                 {settings.showIntervals && card.intervals && card.intervals.count > 1 && (
                     <span className={`flex items-center gap-1 ${card.color === 'green' ? 'text-green-300 font-bold' : 'text-yellow-500'}`}>
                         <Layers size={10} /> 
                         {card.currentInterval || 1}/{card.intervals.count}
                     </span>
                 )}
                 {settings.showAttachmentIndicator && card.attachments && card.attachments.length > 0 && (
                     <span className="text-purple-400 flex items-center gap-0.5"><Paperclip size={10} /> {card.attachments.length}</span>
                 )}
                 {settings.showCompletionCount && card.completionCount > 0 && (
                     <span className="text-green-500 flex items-center gap-0.5"><CheckCircle size={10} /> {card.completionCount}</span>
                 )}
                 {settings.showLastCompleted && card.lastCompleted && (
                     <span className="text-gray-400">{formatTimeSince(card.lastCompleted)}</span>
                 )}
            </div>
            
            {/* Tags on Face */}
            {settings.showTags && card.tags && card.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {card.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[9px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">{tag}</span>
                    ))}
                    {card.tags.length > 3 && <span className="text-[9px] text-gray-500">+{card.tags.length - 3}</span>}
                </div>
            )}
        </div>
    </div>
  );
});

export default CardNode;
