
export interface EloquenceMetrics {
  clarity: number; // 0-100
  assertiveness: number; // 0-100
  vocabularyRichness: number; // 0-100
  pace: 'Too Slow' | 'Good' | 'Too Fast';
}

export interface ImprovementSuggestion {
  original: string;
  improved: string;
  reason: string;
}

export interface EloquenceExercise {
  focusPoint: string; // The specific concept (e.g., "Supprimer les hésitations")
  explanation: string; // Why it matters (1 sentence)
  exampleOriginal: string; // A specific snippet from the user's text
  exampleImproved: string; // How it should be said
  instruction: string; // What the user should record now
}

export interface AnalysisResult {
  transcription?: string; // Optional here as it's usually on the parent, but useful for schema
  summary: string;
  mood: string;
  tags: string[];
  metrics: EloquenceMetrics;
  suggestions: ImprovementSuggestion[];
  eloquenceTip: EloquenceExercise | string; // Union type to support legacy string data from localstorage
  deepAnalysis: string;
}

export interface ExerciseFeedback {
  success: boolean;
  score: number; // 1-10
  critique: string; // Detailed feedback on the attempt
  transcription: string; // What the user said in the exercise
}

export interface JournalEntry {
  id: string;
  date: string; // ISO string
  transcription: string;
  analysis: AnalysisResult | null;
  audioUrl?: string; // Blob URL (session only)
  isProcessing: boolean;
  exerciseFeedback?: ExerciseFeedback; // Store the result of the practice
}

export interface AppSettings {
  reminderEnabled: boolean;
  reminderTime: string; // "HH:MM" 24h format
}

export enum ViewState {
  HOME = 'HOME',
  RECORDING = 'RECORDING',
  DETAILS = 'DETAILS',
  SEARCH = 'SEARCH',
  SETTINGS = 'SETTINGS'
}
