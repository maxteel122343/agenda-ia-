import React, { useState } from 'react';
import { CardVisualSettings, CardBehaviorSettings, CardShape, CardColor } from '../types';
import { X, Eye, Layout, Image, Clock, CheckCircle, Trash2, Calendar, Tag, Paperclip, Activity, FileText, Settings, Play, PauseCircle, MousePointerClick, Hourglass, Square, Circle, Hexagon, Diamond } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visualSettings: CardVisualSettings;
  behaviorSettings: CardBehaviorSettings;
  onUpdateVisual: (settings: CardVisualSettings) => void;
  onUpdateBehavior: (settings: CardBehaviorSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    visualSettings, 
    behaviorSettings,
    onUpdateVisual, 
    onUpdateBehavior 
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'behavior'>('visual');

  if (!isOpen) return null;

  const toggleVisual = (key: keyof CardVisualSettings) => {
    onUpdateVisual({ ...visualSettings, [key]: !visualSettings[key] });
  };

  const toggleBehavior = (key: keyof CardBehaviorSettings) => {
      // Only toggle boolean values safely
      const val = behaviorSettings[key];
      if (typeof val === 'boolean') {
          onUpdateBehavior({ ...behaviorSettings, [key]: !val });
      }
  };

  const updateBehaviorValue = (key: keyof CardBehaviorSettings, value: any) => {
      onUpdateBehavior({ ...behaviorSettings, [key]: value });
  };

  const Option = ({ label, icon: Icon, settingKey }: { label: string, icon: any, settingKey: keyof CardVisualSettings }) => (
    <div 
        onClick={() => toggleVisual(settingKey)}
        className="flex items-center justify-between p-3 bg-dark-700 rounded-lg border border-white/5 hover:bg-dark-600 cursor-pointer transition select-none"
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${visualSettings[settingKey] ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-700/50 text-gray-500'}`}>
                <Icon size={18} />
            </div>
            <span className={`text-sm font-medium ${visualSettings[settingKey] ? 'text-white' : 'text-gray-400'}`}>{label}</span>
        </div>
        <div className={`w-10 h-5 rounded-full relative transition-colors ${visualSettings[settingKey] ? 'bg-blue-600' : 'bg-gray-600'}`}>
            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${visualSettings[settingKey] ? 'translate-x-5' : ''}`} />
        </div>
    </div>
  );

  const ToggleBehaviorOption = ({ label, icon: Icon, settingKey }: { label: string, icon: any, settingKey: keyof CardBehaviorSettings }) => (
    <div 
        onClick={() => toggleBehavior(settingKey)}
        className="flex items-center justify-between p-3 bg-dark-700 rounded-lg border border-white/5 hover:bg-dark-600 cursor-pointer transition select-none"
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${(behaviorSettings[settingKey] as boolean) ? 'bg-purple-600/20 text-purple-400' : 'bg-gray-700/50 text-gray-500'}`}>
                <Icon size={18} />
            </div>
            <span className={`text-sm font-medium ${(behaviorSettings[settingKey] as boolean) ? 'text-white' : 'text-gray-400'}`}>{label}</span>
        </div>
        <div className={`w-10 h-5 rounded-full relative transition-colors ${(behaviorSettings[settingKey] as boolean) ? 'bg-purple-600' : 'bg-gray-600'}`}>
            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${(behaviorSettings[settingKey] as boolean) ? 'translate-x-5' : ''}`} />
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 border border-white/10 rounded-xl w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-dark-900 rounded-t-xl">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="text-gray-400" /> Configuration
            </h2>
            <div className="flex bg-dark-800 rounded p-1 border border-white/5">
                <button 
                  onClick={() => setActiveTab('visual')}
                  className={`px-3 py-1 text-xs rounded transition flex items-center gap-2 ${activeTab === 'visual' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    <Eye size={14} /> Visuals
                </button>
                <button 
                  onClick={() => setActiveTab('behavior')}
                  className={`px-3 py-1 text-xs rounded transition flex items-center gap-2 ${activeTab === 'behavior' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                    <Activity size={14} /> Behavior & Timing
                </button>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            
            {/* --- VISUAL SETTINGS --- */}
            {activeTab === 'visual' && (
                <div className="space-y-6">
                    
                    {/* Default Style Section */}
                    <div className="bg-dark-700/50 p-4 rounded-lg border border-white/5">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Default Card Style</h3>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Default Shape</label>
                                <div className="flex gap-2">
                                    {(['rectangle', 'circle', 'hexagon', 'diamond'] as CardShape[]).map(shape => (
                                        <button
                                            key={shape}
                                            onClick={() => onUpdateVisual({ ...visualSettings, defaultShape: shape })}
                                            className={`p-2 rounded border transition ${visualSettings.defaultShape === shape ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-dark-900 border-white/10 text-gray-500 hover:text-white'}`}
                                            title={shape.charAt(0).toUpperCase() + shape.slice(1)}
                                        >
                                            {shape === 'rectangle' && <Square size={20} />}
                                            {shape === 'circle' && <Circle size={20} />}
                                            {shape === 'hexagon' && <Hexagon size={20} />}
                                            {shape === 'diamond' && <Diamond size={20} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Default Color</label>
                                <div className="flex gap-2">
                                    {(['red', 'yellow', 'purple', 'blue', 'green'] as CardColor[]).map(color => (
                                        <button
                                            key={color}
                                            onClick={() => onUpdateVisual({ ...visualSettings, defaultColor: color })}
                                            className={`w-8 h-8 rounded-full border-2 transition ${visualSettings.defaultColor === color ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                            style={{ backgroundColor: color === 'red' ? '#ef4444' : color === 'yellow' ? '#eab308' : color === 'purple' ? '#a855f7' : color === 'blue' ? '#3b82f6' : '#22c55e' }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Core Content</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Option label="Show Cover Image" icon={Image} settingKey="showImage" />
                            <Option label="Show Title" icon={Layout} settingKey="showTitle" />
                            <Option label="Show Description" icon={FileText} settingKey="showDescription" />
                            <Option label="Show Timer (Pizza Chart)" icon={Clock} settingKey="showTimer" />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Actions & Controls</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Option label="Complete Button" icon={CheckCircle} settingKey="showCompleteBtn" />
                            <Option label="Delete Button" icon={Trash2} settingKey="showDeleteBtn" />
                            <Option label="Upload/Record Buttons" icon={Paperclip} settingKey="showAttachmentActions" />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Indicators & Metadata</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Option label="Schedule Time" icon={Calendar} settingKey="showSchedule" />
                            <Option label="Intervals" icon={Activity} settingKey="showIntervals" />
                            <Option label="Tags" icon={Tag} settingKey="showTags" />
                            <Option label="Attachments Count" icon={Paperclip} settingKey="showAttachmentIndicator" />
                            <Option label="Time Since Last Done" icon={Clock} settingKey="showLastCompleted" />
                            <Option label="Total Completion Count" icon={CheckCircle} settingKey="showCompletionCount" />
                        </div>
                    </div>
                </div>
            )}

            {/* --- BEHAVIOR SETTINGS --- */}
            {activeTab === 'behavior' && (
                <div className="space-y-6">
                    <p className="text-sm text-gray-400 mb-4 bg-dark-700/50 p-3 rounded border border-white/5">
                        These settings control how cards behave when tasks are started, paused, or completed.
                    </p>

                    {/* TIMING */}
                    <div>
                         <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Timing Phases</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="bg-dark-700 p-3 rounded-lg border border-white/5">
                                 <label className="text-sm font-medium text-white flex items-center gap-2 mb-2">
                                     <Hourglass size={16} className="text-yellow-400" /> Pre-Time (Warm Up)
                                 </label>
                                 <div className="flex items-center gap-2">
                                     <input 
                                        type="number" 
                                        min="0"
                                        value={behaviorSettings.preTimeSeconds}
                                        onChange={(e) => updateBehaviorValue('preTimeSeconds', parseInt(e.target.value) || 0)}
                                        className="bg-dark-900 border border-gray-600 rounded p-1 text-sm w-20 text-center"
                                     />
                                     <span className="text-xs text-gray-400">seconds before start</span>
                                 </div>
                             </div>

                             <div className="bg-dark-700 p-3 rounded-lg border border-white/5">
                                 <label className="text-sm font-medium text-white flex items-center gap-2 mb-2">
                                     <Clock size={16} className="text-blue-400" /> Post-Time (Interval)
                                 </label>
                                 <div className="flex items-center gap-2">
                                     <input 
                                        type="number" 
                                        min="0"
                                        value={behaviorSettings.postTimeSeconds}
                                        onChange={(e) => updateBehaviorValue('postTimeSeconds', parseInt(e.target.value) || 0)}
                                        className="bg-dark-900 border border-gray-600 rounded p-1 text-sm w-20 text-center"
                                     />
                                     <span className="text-xs text-gray-400">seconds after finish</span>
                                 </div>
                             </div>
                         </div>
                    </div>

                    {/* PAUSES */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Pauses</h3>
                        <div className="bg-dark-700 p-3 rounded-lg border border-white/5 space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm text-gray-300">Max Pauses Allowed</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={behaviorSettings.maxPauses}
                                    onChange={(e) => updateBehaviorValue('maxPauses', parseInt(e.target.value) || 0)}
                                    className="bg-dark-900 border border-gray-600 rounded p-1 text-sm w-16 text-center"
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                <span className="text-sm text-gray-300">Duration per Pause:</span>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={behaviorSettings.pauseDuration}
                                    onChange={(e) => updateBehaviorValue('pauseDuration', parseInt(e.target.value) || 0)}
                                    className="bg-dark-900 border border-gray-600 rounded p-1 text-sm w-20 text-center"
                                />
                                <div className="flex bg-dark-900 rounded border border-gray-600 p-0.5">
                                    <button 
                                        onClick={() => updateBehaviorValue('pauseDurationMode', 'fixed')}
                                        className={`text-xs px-2 py-0.5 rounded ${behaviorSettings.pauseDurationMode === 'fixed' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
                                    >
                                        Sec
                                    </button>
                                    <button 
                                        onClick={() => updateBehaviorValue('pauseDurationMode', 'percent')}
                                        className={`text-xs px-2 py-0.5 rounded ${behaviorSettings.pauseDurationMode === 'percent' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
                                    >
                                        %
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TOGGLES */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Interaction Rules</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <ToggleBehaviorOption label="Require Click to Start Task" icon={Play} settingKey="requireClickToStart" />
                            <ToggleBehaviorOption label="Require Click to Finish Task" icon={CheckCircle} settingKey="requireClickToFinish" />
                            <ToggleBehaviorOption label="Auto-Advance after Post-Time" icon={MousePointerClick} settingKey="autoFlowAfterPostTime" />
                        </div>
                        
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-6 mb-3">Granular Click Tracking</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <ToggleBehaviorOption label="Click to Start Timer (after Pre-Time)" icon={Play} settingKey="requireClickToStartTimer" />
                            <ToggleBehaviorOption label="Click to Start Interval" icon={Activity} settingKey="requireClickToStartInterval" />
                            <ToggleBehaviorOption label="Click to End Interval" icon={Activity} settingKey="requireClickToEndInterval" />
                            <ToggleBehaviorOption label="Click to Start Post-Time" icon={Clock} settingKey="requireClickToStartPostTime" />
                            <ToggleBehaviorOption label="Click to Finish Post-Time" icon={CheckCircle} settingKey="requireClickToFinishPostTime" />
                        </div>
                    </div>
                </div>
            )}
        </div>
        
        <div className="p-4 border-t border-white/10 bg-dark-900 rounded-b-xl flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-white text-black font-bold rounded hover:bg-gray-200 transition">
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;