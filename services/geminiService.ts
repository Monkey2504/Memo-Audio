
import { GoogleGenAI, Schema, Type, Modality } from "@google/genai";
import { AnalysisResult, ExerciseFeedback } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the response schema for structured output
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    transcription: {
      type: Type.STRING,
      description: "The full verbatim transcription of the audio in French.",
    },
    summary: {
      type: Type.STRING,
      description: "A concise 1-sentence summary of the entry.",
    },
    mood: {
      type: Type.STRING,
      description: "The emotional tone of the speaker.",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 relevant semantic tags.",
    },
    metrics: {
      type: Type.OBJECT,
      properties: {
        clarity: { type: Type.INTEGER },
        assertiveness: { type: Type.INTEGER },
        vocabularyRichness: { type: Type.INTEGER },
        pace: { type: Type.STRING, enum: ["Too Slow", "Good", "Too Fast"] },
      },
      required: ["clarity", "assertiveness", "vocabularyRichness", "pace"],
    },
    deepAnalysis: {
      type: Type.STRING,
      description: "A comprehensive, multi-paragraph literary critique of the speaker's style, rhetoric, and emotional coherence. Markdown formatted.",
    },
    suggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          improved: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["original", "improved", "reason"],
      },
    },
    eloquenceTip: {
      type: Type.OBJECT,
      description: "A structured, simple, and focused micro-lesson based on the most obvious mistake.",
      properties: {
        focusPoint: { type: Type.STRING, description: "Title of the lesson (e.g., 'La voix passive')." },
        explanation: { type: Type.STRING, description: "Simple explanation of why this matters (1 sentence)." },
        exampleOriginal: { type: Type.STRING, description: "A short snippet from the user's transcript containing the issue." },
        exampleImproved: { type: Type.STRING, description: "The same snippet rewritten perfectly." },
        instruction: { type: Type.STRING, description: "The specific sentence the user must record to practice." },
      },
      required: ["focusPoint", "explanation", "exampleOriginal", "exampleImproved", "instruction"],
    },
  },
  required: ["transcription", "summary", "mood", "tags", "metrics", "deepAnalysis", "suggestions", "eloquenceTip"],
};

export const processAudioEntry = async (audioBase64: string, mimeType: string): Promise<{ transcription: string, analysis: AnalysisResult }> => {
  try {
    const modelId = "gemini-2.5-flash"; 

    // Instructions based on the "Cahier d'instructions" - Miroir bienveillant mais exigeant
    const systemInstruction = `
      Tu es le "Journal Éloquent", un critique littéraire sophistiqué et un coach vocal de haut niveau.
      
      TES OBJECTIFS :
      1. **Transcription** : Transcris l'audio en français.
      2. **Analyse Profonde (deepAnalysis)** : 
         - Critique littéraire dense (200 mots) sur la structure, la rhétorique et la congruence émotionnelle.
         - Sois un "miroir exigeant" : pointe les faiblesses avec précision.
      
      3. **Exercice (eloquenceTip)** : C'est le cœur de l'amélioration.
         - Choisis UNE SEULE chose à améliorer (ex: retirer les "euh", changer la voix passive, utiliser des verbes forts).
         - Ne demande pas de tout changer. Focus sur UN détail.
         - L'exemple "Original" DOIT venir du texte de l'utilisateur.
         - L'exemple "Improved" DOIT être une version corrigée de cet extrait.
         - La "consigne" (instruction) doit être simple : demander de répéter la version améliorée.
      
      TON STYLE :
      Pour l'analyse : Élégant, universitaire.
      Pour l'exercice : Pédagogue, clair, encourageant, simple.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64,
            },
          },
          {
            text: "Transcribe and provide a deep literary analysis and a focused micro-exercise.",
          },
        ],
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response from Gemini");

    const parsed = JSON.parse(resultText);

    return {
      transcription: parsed.transcription,
      analysis: {
        summary: parsed.summary,
        mood: parsed.mood,
        tags: parsed.tags,
        metrics: parsed.metrics,
        deepAnalysis: parsed.deepAnalysis,
        suggestions: parsed.suggestions,
        eloquenceTip: parsed.eloquenceTip,
      },
    };
  } catch (error) {
    console.error("Error processing audio with Gemini:", error);
    throw error;
  }
};

const exerciseFeedbackSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    transcription: { type: Type.STRING },
    success: { type: Type.BOOLEAN },
    score: { type: Type.INTEGER, description: "Score out of 10" },
    critique: { type: Type.STRING, description: "Detailed feedback on the attempt." },
  },
  required: ["transcription", "success", "score", "critique"]
};

export const evaluateExercise = async (
  audioBase64: string, 
  mimeType: string, 
  goal: string
): Promise<ExerciseFeedback> => {
  try {
    const modelId = "gemini-2.5-flash";
    
    const systemInstruction = `
      Tu es le coach du "Journal Éloquent". L'utilisateur vient de réaliser un exercice oral.
      La consigne exacte était : "${goal}".
      
      Ton rôle :
      1. Transcrire ce qu'il a dit.
      2. Vérifier s'il a bien dit la phrase demandée (ou reformulé comme demandé).
      3. Évaluer la fluidité et l'assurance.
      4. Feedback très court et motivant.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: audioBase64 } },
          { text: "Evaluate this exercise attempt." },
        ],
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: exerciseFeedbackSchema,
      },
    });

    const parsed = JSON.parse(response.text!);
    return parsed as ExerciseFeedback;

  } catch (error) {
    console.error("Error evaluating exercise:", error);
    throw error;
  }
};

// --- Audio Helper Functions for TTS ---

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
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const playEloquenceTTS = async (text: string): Promise<void> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore: Calm and assertive
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await decodeAudioData(
      decode(base64Audio),
      audioContext,
      24000,
      1
    );

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();

  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};
