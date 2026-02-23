export type CardStatus = 'pending' | 'active' | 'completed' | 'skipped';
export type CardColor = 'red' | 'yellow' | 'purple' | 'blue' | 'green';
export type CardShape = 'rectangle' | 'circle' | 'hexagon' | 'diamond';

export interface Attachment {
  id: string;
  type: 'image' | 'audio';
  url: string; // Base64 data or URL
  timestamp: number;
}

export interface IntervalSettings {
  count: number;
  duration: number; // seconds per interval
}

export interface AiThought {
  timestamp: number;
  content: string;
}

export interface CardVisualSettings {
  showImage: boolean;
  showTitle: boolean;
  showDescription: boolean;
  showTimer: boolean;
  showCompleteBtn: boolean;
  showDeleteBtn: boolean;
  showSchedule: boolean;
  showIntervals: boolean;
  showTags: boolean;
  showLastCompleted: boolean;
  showCompletionCount: boolean;
  showAttachmentIndicator: boolean; // "Indicator of attached images"
  showAttachmentActions: boolean;   // "Icon to attach image/audio"
  
  // Defaults
  defaultShape?: CardShape;
  defaultColor?: CardColor;
}

export interface CardBehaviorSettings {
  // Timing
  preTimeSeconds: number; // Warm-up time before task starts
  postTimeSeconds: number; // Cooldown/Buffer time after task ends
  
  // Pauses
  maxPauses: number;
  pauseDuration: number; // Duration value
  pauseDurationMode: 'fixed' | 'percent'; // 'fixed' = seconds, 'percent' = % of total card time
  
  // Interaction Toggles
  requireClickToStart: boolean; // If true, routine won't auto-start card, user must click
  requireClickToFinish: boolean; // If true, timer ending won't auto-complete, user must click done
  autoFlowAfterPostTime: boolean; // If true, automatically goes to next card after post-time ends
  
  // Granular Click Toggles
  requireClickToStartTimer: boolean; // After pre-time ends, wait for click to start main timer
  requireClickToStartInterval: boolean; // When interval is due, wait for click to start interval
  requireClickToEndInterval: boolean; // When interval ends, wait for click to resume main task
  requireClickToStartPostTime: boolean; // After task finishes, wait for click to start post-time
  requireClickToFinishPostTime: boolean; // After post-time ends, wait for click to finalize
}

export interface InteractionMetric {
  phase: 'pre-start' | 'timer-start' | 'interval-start' | 'interval-end' | 'task-end' | 'post-start' | 'post-end';
  expectedTime: number; // Timestamp when it *should* have happened
  actualTime: number;   // Timestamp when it *did* happen
  delaySeconds: number; // Difference
  negativeTime?: number; // For intervals/timers running over
}

export interface CardData {
  id: string;
  type?: 'task' | 'note';
  x: number;
  y: number;
  title: string;
  description: string;
  color: CardColor;
  shape?: CardShape;
  timerTotal: number; // in seconds
  timerRemaining: number; // in seconds
  status: CardStatus;
  imageUrl?: string; // Main cover image
  parentId?: string; // For nesting visualization
  notes: string[];
  isExpanded?: boolean; // If expanded, shows children
  
  // Detailed Info Fields
  tags: string[];
  completionCount: number;
  lastCompleted?: number; // Timestamp
  attachments: Attachment[];
  intervals?: IntervalSettings;
  currentInterval?: number; // 1-based index of current interval
  metrics?: InteractionMetric[]; // Behavioral tracking
  
  // Card-specific Behavior Overrides
  preTimeSeconds?: number;
  postTimeSeconds?: number;
  
  // Scheduling
  scheduledStart?: string; // ISO String
  scheduledEnd?: string;   // ISO String

  // Deep Thinking
  aiThoughts?: AiThought[]; // History of AI analysis
}

export interface EventGroup {
  id: string;
  title: string;
  cardIds: string[];
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}