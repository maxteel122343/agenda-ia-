import { GoogleGenAI, Type, Modality, LiveServerMessage, FunctionDeclaration } from "@google/genai";
import { CardData, CardColor } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- Audio Helpers ---

function floatTo16BitPCM(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output.buffer;
}

function base64ToUint8Array(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// --- Live API Implementation ---

export const connectLiveSession = async (
    onHabitDetected: (habit: string, implication: string) => void,
    onStatusChange: (isActive: boolean) => void,
    onStreamReady?: (stream: MediaStream) => void,
    onTranscript?: (text: string, isUser: boolean) => void
) => {
    let audioContext: AudioContext | null = null;
    let mediaStream: MediaStream | null = null;
    let audioProcessor: ScriptProcessorNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let nextStartTime = 0;
    let videoInterval: any = null;

    // Tool Definition
    const habitTool: FunctionDeclaration = {
        name: 'registerUserHabit',
        description: 'Registra um hábito, comportamento ou preferência percebido do usuário durante a conversa.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                habit: { type: Type.STRING, description: 'O hábito ou comportamento observado.' },
                implication: { type: Type.STRING, description: 'O que isso significa para a produtividade dele.' }
            },
            required: ['habit', 'implication']
        }
    };

    try {
        // 1. Setup Audio Input & Output Context
        // Ensure we create the context immediately to bind to user gesture if possible
        // Use 16kHz for better compatibility with speech models
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        // Always attempt to resume, as browsers often suspend new contexts until interaction
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Request both audio and video
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 16000
            },
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15 }
            }
        });

        if (onStreamReady && mediaStream) {
            onStreamReady(mediaStream);
        }

        // 2. Connect to Gemini Live
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }
                },
                // Enable transcription for both user input and model output
                // Note: The model field inside transcription config is optional/implied
                // @ts-ignore - The types might not be fully updated for these specific fields yet
                inputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
                outputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" },
                
                systemInstruction: `Você é a Chronos, uma assistente de produtividade super descontraída, divertida e parceira! Você fala Português do Brasil.
                
                Seu objetivo é ajudar o usuário a organizar a bagunça dos cards e lembrar dos compromissos, mas sempre com bom humor e leveza.
                Use uma linguagem informal, pode usar gírias leves e emojis na fala (expressando emoção). Nada de formalidade ou papo de robô!
                
                VOCÊ CONSEGUE VER O USUÁRIO PELA CÂMERA!
                ASSIM QUE A CONEXÃO COMEÇAR (AGORA):
                1. Diga "Opa, tô te vendo!" ou "Olha só quem apareceu!".
                2. Descreva IMEDIATAMENTE algo visual que você está vendo no vídeo (ex: "Gostei da camiseta", "Tá escuro aí hein", "Que fundo bonito").
                3. Faça uma brincadeira sobre a postura dele ou "cara de quem tem muita tarefa".
                4. Pergunte: "Bora organizar essa vida ou vamos procrastinar mais um pouco?"
                
                DURANTE A CONVERSA:
                - Se ele estiver parado sem fazer nada, brinque com isso (ex: "Tá meditando ou travou o Windows?").
                - Se ele fizer gestos, comente.
                - Se ele parecer confuso, ofereça ajuda.
                
                IMPORTANTE: Enquanto conversa, analise psicologicamente o usuário. Se você perceber um padrão, medo, hábito (ex: procrastinação, perfeccionismo, pressa) ou preferência, USE A FERRAMENTA 'registerUserHabit' imediatamente para salvar essa nota.
                
                Não precisa avisar que vai salvar. Apenas salve e continue o papo fluentemente.
                Seja breve nas falas, faça perguntas e dê sugestões rápidas para organizar a vida do usuário.`,
                tools: [{ functionDeclarations: [habitTool] }]
            },
            callbacks: {
                onopen: () => {
                    console.log("Live Session Connected");
                    onStatusChange(true);

                    // --- Audio Handling ---
                    source = audioContext!.createMediaStreamSource(mediaStream!);
                    audioProcessor = audioContext!.createScriptProcessor(4096, 1, 1);
                    
                    audioProcessor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcm16 = floatTo16BitPCM(inputData);
                        const base64Data = arrayBufferToBase64(pcm16);
                        
                        sessionPromise.then(session => {
                            session.sendRealtimeInput({
                                media: {
                                    mimeType: `audio/pcm;rate=${audioContext?.sampleRate || 16000}`,
                                    data: base64Data
                                }
                            });
                        });
                    };

                    source.connect(audioProcessor);
                    audioProcessor.connect(audioContext!.destination);

                    // --- Video Handling ---
                    // Use standard Video element + Canvas for broad browser support
                    const video = document.createElement('video');
                    video.srcObject = mediaStream;
                    video.muted = true;
                    video.playsInline = true; // Important for mobile
                    video.play().catch(e => console.warn("Video play error", e));

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    let hasSentInitialFrame = false;

                    videoInterval = setInterval(() => {
                        if (video.readyState >= 2 && ctx) { // HAVE_CURRENT_DATA or better
                            try {
                                canvas.width = video.videoWidth / 2; // Downscale
                                canvas.height = video.videoHeight / 2;
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                
                                const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                                
                                sessionPromise.then(session => {
                                    const payload: any = {
                                        media: {
                                            mimeType: 'image/jpeg',
                                            data: base64Image
                                        }
                                    };
                                    
                                    // Send text prompt ONLY with the very first frame to force a reaction
                                    if (!hasSentInitialFrame) {
                                        session.sendRealtimeInput(payload);
                                        // Send text as a separate input if supported, or just rely on the image context
                                        // For now, let's just send the image payload. The system instruction already tells it to react.
                                        // If we really need text, we might need to use a different method or format.
                                        // But to fix the type error, we remove the array.
                                        hasSentInitialFrame = true;
                                    } else {
                                        session.sendRealtimeInput(payload);
                                    }
                                }).catch(e => {
                                    // Session might be closed
                                });
                            } catch (e) {
                                // Ignore frame capture errors
                            }
                        }
                    }, 1000); // Send 1 frame per second
                },
                onmessage: async (msg: LiveServerMessage) => {
                    // Handle Tool Calls
                    if (msg.toolCall) {
                        for (const fc of msg.toolCall.functionCalls) {
                            if (fc.name === 'registerUserHabit') {
                                const args = fc.args as any;
                                onHabitDetected(args.habit, args.implication);
                                
                                sessionPromise.then(session => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: fc.id,
                                            name: fc.name,
                                            response: { result: "Habit saved successfully." }
                                        }
                                    });
                                });
                            }
                        }
                    }

                    // Handle Audio Output
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData && audioContext) {
                        try {
                            const audioBytes = base64ToUint8Array(audioData);
                            
                            // Create buffer for 24kHz (Standard Gemini Live output)
                            const buffer = audioContext.createBuffer(1, audioBytes.length / 2, 24000);
                            const channelData = buffer.getChannelData(0);
                            
                            // CRITICAL: Use DataView to enforce Little Endian decoding
                            const dataView = new DataView(audioBytes.buffer, audioBytes.byteOffset, audioBytes.byteLength);
                            for (let i = 0; i < channelData.length; i++) {
                                // Read 16-bit signed integer, Little Endian = true
                                const int16 = dataView.getInt16(i * 2, true);
                                channelData[i] = int16 / 32768.0;
                            }

                            const source = audioContext.createBufferSource();
                            source.buffer = buffer;
                            source.connect(audioContext.destination);
                            
                            // Schedule playback
                            const currentTime = audioContext.currentTime;
                            // If nextStartTime is in the past, reset it to now to avoid huge delays
                            if (nextStartTime < currentTime) {
                                nextStartTime = currentTime;
                            }
                            source.start(nextStartTime);
                            nextStartTime += buffer.duration;
                        } catch (e) {
                            console.error("Audio decoding error", e);
                        }
                    }

                    // Handle Transcription (if available)
                    // Check for model turn text (output transcription)
                    const modelText = msg.serverContent?.modelTurn?.parts?.find(p => p.text)?.text;
                    if (modelText && onTranscript) {
                        onTranscript(modelText, false);
                    }

                    // Check for user turn text (input transcription) - usually in a different message type or part
                    // Note: The SDK might expose this differently. We check standard places.
                    // For now, we rely on model output. User input transcription might come in 'clientContent' or similar if echoed, 
                    // but typically the server sends 'turnComplete' with input text? 
                    // Actually, for now let's just capture model output. User input visualization might need local STT if the API doesn't echo it.
                },
                onclose: () => {
                    console.log("Live Session Closed");
                    onStatusChange(false);
                },
                onerror: (e) => {
                    console.error("Live Session Error", e);
                    onStatusChange(false);
                }
            }
        });
        
        return () => {
            sessionPromise.then(session => session.close());
            if (source) source.disconnect();
            if (audioProcessor) audioProcessor.disconnect();
            if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
            if (audioContext) audioContext.close();
            if (videoInterval) clearInterval(videoInterval);
        };

    } catch (e) {
        console.error("Failed to connect live session", e);
        onStatusChange(false);
        speakText("Não foi possível conectar a sessão ao vivo. Verifique o microfone.");
        return () => {};
    }
};

// --- Existing REST Services ---

// Audio Decoding Helpers (Keeping existing ones for TTS fallback)
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Use DataView for safe endianness handling even in TTS fallback
  const frameCount = data.byteLength / 2 / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
       // Offset: i * 2 * numChannels + channel * 2
       const offset = (i * numChannels + channel) * 2;
       const int16 = dataView.getInt16(offset, true);
       channelData[i] = int16 / 32768.0;
    }
  }
  return buffer;
}

export const speakText = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' },
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBytes = decode(base64Audio);
    const audioBuffer = await decodeAudioData(audioBytes, audioCtx);
    
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.onended = () => {
        audioCtx.close();
    };
    source.start();

  } catch (error) {
    console.error("TTS Error:", error);
  }
};

export const generateCardImage = async (title: string, description: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `Create a futuristic, minimalist, cyberpunk style square icon/image representing the task: "${title}". Description: ${description}. High contrast, dark background.`,
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const breakDownTask = async (taskTitle: string): Promise<Array<{ title: string; description: string; duration: number }>> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Break down the task "${taskTitle}" into exactly 5 sequential sub-steps to help a user organize their routine. Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Short title of the sub-task" },
              description: { type: Type.STRING, description: "Brief description" },
              duration: { type: Type.NUMBER, description: "Estimated duration in minutes (integer)" }
            },
            required: ["title", "description", "duration"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Error breaking down task:", error);
    return [];
  }
};

export interface AiAction {
  type: 'chat' | 'create_card' | 'move_card' | 'connect_cards' | 'update_settings';
  text?: string;
  cardData?: {
    title: string;
    description: string;
    type?: 'task' | 'note';
    x?: number;
    y?: number;
    color?: string;
  };
  moveData?: {
    targetId: string; // ID of the card to move
    x: number;
    y: number;
  };
  connectData?: {
    fromId: string;
    toId: string;
    label?: string;
  };
  settingsData?: {
      requireClickToStart?: boolean;
      requireClickToFinish?: boolean;
      requireClickToStartTimer?: boolean;
      requireClickToStartInterval?: boolean;
      requireClickToEndInterval?: boolean;
      requireClickToStartPostTime?: boolean;
      requireClickToFinishPostTime?: boolean;
  };
}

export const getTaskSuggestions = async (currentCards: CardData[], query: string): Promise<AiAction[]> => {
    try {
        const cardContext = currentCards.map(c => 
            `ID: "${c.id}" | Title: "${c.title}" | Status: ${c.status} | Pos: (${Math.round(c.x)}, ${Math.round(c.y)})`
        ).join('\n');

        const systemPrompt = `You are Chronos, a relaxed, fun, and energetic productivity assistant. You speak Portuguese (Brazil) mostly, unless addressed in English.
        
        Current Cards on Canvas:
        ${cardContext}
        
        User Query: ${query}

        Instructions:
        1. You are here to help organize cards and remind the user of tasks/appointments with a fun, casual vibe. Use emojis!
        2. If the user asks to create cards, return 'create_card' actions. Default spacing is ~300px.
        3. If the user asks to create a NOTE or POST-IT, set 'type' to 'note'. Notes should usually be yellow or purple.
        4. If the user asks to organize, rearrange, or list cards, return 'move_card' actions with new X/Y coordinates to form a grid or list.
        5. If the user asks to connect cards, return 'connect_cards'.
        6. If the user asks to track behavior, clicks, or attention, return 'update_settings' to enable specific click requirements.
        7. Always include a 'chat' action to explain what you did or answer questions. Keep chat responses concise and fun.
        8. The center of the view is roughly 0,0.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: systemPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['chat', 'create_card', 'move_card', 'connect_cards', 'update_settings'] },
                            text: { type: Type.STRING, description: "Text for chat response" },
                            cardData: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ['task', 'note'] },
                                    x: { type: Type.NUMBER },
                                    y: { type: Type.NUMBER },
                                    color: { type: Type.STRING, enum: ['red', 'yellow', 'purple', 'blue', 'green'] }
                                }
                            },
                            moveData: {
                                type: Type.OBJECT,
                                properties: {
                                    targetId: { type: Type.STRING },
                                    x: { type: Type.NUMBER },
                                    y: { type: Type.NUMBER }
                                }
                            },
                            connectData: {
                                type: Type.OBJECT,
                                properties: {
                                    fromId: { type: Type.STRING },
                                    toId: { type: Type.STRING },
                                    label: { type: Type.STRING }
                                }
                            },
                            settingsData: {
                                type: Type.OBJECT,
                                properties: {
                                    requireClickToStart: { type: Type.BOOLEAN },
                                    requireClickToFinish: { type: Type.BOOLEAN },
                                    requireClickToStartTimer: { type: Type.BOOLEAN },
                                    requireClickToStartInterval: { type: Type.BOOLEAN },
                                    requireClickToEndInterval: { type: Type.BOOLEAN },
                                    requireClickToStartPostTime: { type: Type.BOOLEAN },
                                    requireClickToFinishPostTime: { type: Type.BOOLEAN }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        const text = response.text;
        if (!text) return [{ type: 'chat', text: "I couldn't process that." }];
        return JSON.parse(text) as AiAction[];

    } catch (e) {
        console.error(e);
        return [{ type: 'chat', text: "Error connecting to AI assistant." }];
    }
}

export const scheduleTasks = async (
    tasksToSchedule: { id: string; title: string; durationMinutes: number }[],
    startTimeISO: string,
    endTimeISO: string,
    busySlots: { start: string; end: string }[] = []
): Promise<Array<{ id: string; start: string; end: string }>> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `
                I have a list of new tasks to schedule between ${startTimeISO} and ${endTimeISO}.
                
                Constraints:
                1. You must find empty time slots for the NEW TASKS.
                2. You MUST NOT overlap with the following BUSY SLOTS: ${JSON.stringify(busySlots)}.
                3. The new tasks are: ${JSON.stringify(tasksToSchedule)}.
                4. Schedule as many new tasks as possible in the sequence provided, filling gaps.
                
                Return a JSON array of scheduled objects.
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            start: { type: Type.STRING, description: "ISO Date String" },
                            end: { type: Type.STRING, description: "ISO Date String" }
                        },
                        required: ["id", "start", "end"]
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);
    } catch (e) {
        console.error("Scheduling error", e);
        return [];
    }
};

export const estimateTaskDuration = async (title: string, description: string): Promise<number> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Estimate the duration in minutes for this task: "${title}". Description: "${description}". Return ONLY the number (integer). If unclear, default to 15.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        duration: { type: Type.NUMBER }
                    }
                }
            }
        });
        const text = response.text;
        if (!text) return 15;
        const json = JSON.parse(text);
        return json.duration || 15;
    } catch (e) {
        console.error("Duration estimation error", e);
        return 15;
    }
};

export async function optimizeTaskSchedule(
    card: CardData, 
    completedHistory: CardData[]
): Promise<{
    timerTotal: number;
    preTime: number;
    postTime: number;
    intervals: { count: number; duration: number };
    reasoning: string;
}> {
    const historySummary = completedHistory.map(c => 
        `- ${c.title}: ${Math.round(c.timerTotal/60)}m total, ${c.intervals?.count || 0} intervals`
    ).join('\n');

    const prompt = `
    Analyze this task and the user's history to determine the optimal timing configuration.
    
    Current Task:
    Title: ${card.title}
    Description: ${card.description}
    
    User History (Completed Tasks):
    ${historySummary}
    
    Determine:
    1. Total Duration (in seconds)
    2. Pre-Time (warmup in seconds)
    3. Post-Time (cooldown in seconds)
    4. Intervals (count and duration in seconds)
    5. Reasoning (Explain why you chose these times based on the task type and history)
    
    Return ONLY JSON:
    {
      "timerTotal": number,
      "preTime": number,
      "postTime": number,
      "intervals": { "count": number, "duration": number },
      "reasoning": "string"
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-latest',
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        
        const text = response.text;
        if (!text) throw new Error("No response from AI");
        
        return JSON.parse(text);
    } catch (error) {
        console.error("Error optimizing schedule:", error);
        return {
            timerTotal: 1800,
            preTime: 60,
            postTime: 60,
            intervals: { count: 1, duration: 1500 },
            reasoning: "Default fallback due to error."
        };
    }
}

export const analyzeScheduleDeeply = async (cards: CardData[]): Promise<Array<{id: string, thought: string}>> => {
    try {
        // We only analyze cards that have a title
        const taskList = cards.map(c => ({
            id: c.id,
            title: c.title,
            description: c.description,
            timerTotal: c.timerTotal,
            metrics: c.metrics, // Include behavioral metrics
            currentHistory: c.aiThoughts?.map(t => t.content).join(" | ") || "No history."
        }));

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `
                Perform a deep cognitive analysis on this user's task list to improve their productivity habits.
                
                For EACH task, I want you to:
                1. Reflect on the task's meaning and complexity.
                2. Consult the 'currentHistory' (previous thoughts) if available.
                3. Estimate realistic duration vs assigned duration.
                4. Identify potential psychological barriers (procrastination triggers) or habits.
                5. Think about the sequence (what should come before/after).
                6. ANALYZE BEHAVIORAL METRICS (if available): Look for 'delaySeconds' and 'negativeTime' in the 'metrics' array. 
                   - High delay before starting timer = Procrastination/Hesitation.
                   - High negative time (overtime) = Obsession or Flow State (or just forgetting to stop).
                   - Delay in intervals = Distraction.
                
                Tasks: ${JSON.stringify(taskList)}
                
                Return a JSON array where each object contains the card 'id' and a 'thought' string. The thought string should be a concise but deep paragraph of your analysis.
            `,
            config: {
                thinkingConfig: { thinkingBudget: 2048 }, // Enable Deep Thinking
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            thought: { type: Type.STRING }
                        },
                        required: ["id", "thought"]
                    }
                }
            }
        });

        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);

    } catch (error) {
        console.error("Deep Think Error:", error);
        return [];
    }
}