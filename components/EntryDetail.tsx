
import React, { useState, useMemo } from 'react';
import { JournalEntry, ExerciseFeedback, EloquenceExercise } from '../types';
import { ArrowLeft, Play, Pause, Quote, Sparkles, AlertCircle, CheckCircle2, TrendingUp, Volume2, Loader2, Mic, ArrowRight, Info } from 'lucide-react';
import { playEloquenceTTS, evaluateExercise } from '../services/geminiService';
import { AudioRecorder } from './AudioRecorder';

// Helper for blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- SVG Chart Component ---
const EloquenceChart = ({ currentEntry, allEntries }: { currentEntry: JournalEntry, allEntries: JournalEntry[] }) => {
  const data = useMemo(() => {
    // Get entries up to the current one, sort by date, take last 5
    return allEntries
      .filter(e => e.analysis && new Date(e.date) <= new Date(currentEntry.date))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-5);
  }, [currentEntry, allEntries]);

  if (data.length < 2) return null;

  const width = 100;
  const height = 50;
  const padding = 5;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const makePath = (metric: 'clarity' | 'assertiveness') => {
    return data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * graphWidth;
      const val = d.analysis?.metrics[metric] || 0;
      const y = height - padding - (val / 100) * graphHeight;
      return `${x},${y}`;
    }).join(' ');
  };

  const clarityPoints = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * graphWidth;
    const y = height - padding - ((d.analysis?.metrics.clarity || 0) / 100) * graphHeight;
    return { x, y, val: d.analysis?.metrics.clarity };
  });

  const assertivenessPoints = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * graphWidth;
    const y = height - padding - ((d.analysis?.metrics.assertiveness || 0) / 100) * graphHeight;
    return { x, y, val: d.analysis?.metrics.assertiveness };
  });

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Progression</h3>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div>Clarté</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-teal-500"></div>Affirmation</div>
        </div>
      </div>
      
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f3f4f6" strokeWidth="0.5" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#f3f4f6" strokeWidth="0.5" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#f3f4f6" strokeWidth="0.5" />

        {/* Lines */}
        <polyline 
          points={makePath('clarity')} 
          fill="none" 
          stroke="#6366f1" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <polyline 
          points={makePath('assertiveness')} 
          fill="none" 
          stroke="#14b8a6" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />

        {/* Dots */}
        {clarityPoints.map((p, i) => (
          <circle key={`c-${i}`} cx={p.x} cy={p.y} r="1.5" fill="white" stroke="#6366f1" strokeWidth="1" />
        ))}
        {assertivenessPoints.map((p, i) => (
          <circle key={`a-${i}`} cx={p.x} cy={p.y} r="1.5" fill="white" stroke="#14b8a6" strokeWidth="1" />
        ))}

        {/* Labels for X axis */}
        {data.map((d, i) => {
             const x = padding + (i / (data.length - 1)) * graphWidth;
             return (
               <text key={i} x={x} y={height + 5} fontSize="3" textAnchor="middle" fill="#9ca3af">
                 {new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
               </text>
             );
        })}
      </svg>
    </div>
  );
};

interface EntryDetailProps {
  entry: JournalEntry;
  allEntries: JournalEntry[];
  onBack: () => void;
}

export const EntryDetail: React.FC<EntryDetailProps> = ({ entry, allEntries, onBack }) => {
  const [activeTab, setActiveTab] = useState<'transcription' | 'analysis' | 'exercise'>('transcription');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingTTS, setPlayingTTS] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  
  // Exercise State
  const [exerciseState, setExerciseState] = useState<'IDLE' | 'RECORDING' | 'ANALYZING' | 'FEEDBACK'>('IDLE');
  const [exerciseFeedback, setExerciseFeedback] = useState<ExerciseFeedback | null>(null);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handlePlayTTS = async (text: string, id: string) => {
    if (playingTTS) return;
    setPlayingTTS(id);
    try {
      await playEloquenceTTS(text);
    } catch (e) {
      console.error(e);
      alert("Impossible de lire l'audio pour le moment.");
    } finally {
      setPlayingTTS(null);
    }
  };

  const handleExerciseRecordingComplete = async (blob: Blob) => {
    setExerciseState('ANALYZING');
    try {
      const base64 = await blobToBase64(blob);
      const tipGoal = typeof entry.analysis?.eloquenceTip === 'string' 
        ? entry.analysis.eloquenceTip 
        : entry.analysis?.eloquenceTip?.instruction || "";

      const feedback = await evaluateExercise(base64, blob.type || 'audio/webm', tipGoal);
      setExerciseFeedback(feedback);
      setExerciseState('FEEDBACK');
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'analyse de l'exercice.");
      setExerciseState('IDLE');
    }
  };

  const analysis = entry.analysis;

  if (!analysis) return <div>Données manquantes</div>;

  // Type guard or fallback for legacy data
  const exerciseTip: EloquenceExercise | null = typeof analysis.eloquenceTip === 'object' 
    ? analysis.eloquenceTip 
    : null;
    
  // Fallback string for legacy entries
  const legacyTipString = typeof analysis.eloquenceTip === 'string' ? analysis.eloquenceTip : null;

  const metricsList = [
    {
      label: 'Clarté',
      value: analysis.metrics.clarity,
      color: 'text-indigo-600',
      barColor: 'bg-indigo-500',
      tooltip: 'Mesure la limpidité et la structure du propos. Un score élevé indique un message intelligible et logique.'
    },
    {
      label: 'Affirmation',
      value: analysis.metrics.assertiveness,
      color: 'text-teal-600',
      barColor: 'bg-teal-500',
      tooltip: 'Évalue la confiance et la fermeté. Un score élevé signale une absence de langage auto-effacé.'
    },
    {
      label: 'Vocabulaire',
      value: analysis.metrics.vocabularyRichness || 0,
      color: 'text-fuchsia-600',
      barColor: 'bg-fuchsia-500',
      tooltip: 'Indique la richesse lexicale et la variété des termes utilisés pour éviter les répétitions.'
    }
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-200 p-4 flex items-center z-10">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="ml-3 flex-1">
          <h2 className="text-sm font-bold text-gray-900">
            {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <p className="text-xs text-gray-500">{analysis.mood}</p>
        </div>
      </div>

      {/* Audio Player */}
      {entry.audioUrl && (
        <div className="bg-white p-4 border-b border-gray-100 flex items-center justify-between">
          <button 
            onClick={toggleAudio}
            className="flex items-center space-x-3 bg-indigo-50 px-4 py-2 rounded-full text-indigo-700 font-medium hover:bg-indigo-100 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="text-sm">{isPlaying ? 'Pause' : 'Réécouter'}</span>
          </button>
          <audio 
            ref={audioRef} 
            src={entry.audioUrl} 
            onEnded={() => setIsPlaying(false)} 
            className="hidden" 
          />
          <div className="text-xs text-gray-400">Audio de session</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex p-2 bg-white border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'transcription', label: 'Texte' },
          { id: 'analysis', label: 'Analyse' },
          { id: 'exercise', label: 'Exercice' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* TRANSCRIPTION TAB */}
        {activeTab === 'transcription' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <Quote className="w-8 h-8 text-indigo-100 mb-4" />
            <p className="text-gray-700 leading-relaxed font-serif text-lg">
              {entry.transcription}
            </p>
          </div>
        )}

        {/* ANALYSIS TAB */}
        {activeTab === 'analysis' && (
          <div className="space-y-6">
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              {metricsList.map((metric, idx) => (
                <div 
                  key={metric.label} 
                  className={`bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative group ${idx === 2 ? 'col-span-2' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="text-xs text-gray-500">{metric.label}</div>
                    <Info className="w-3 h-3 text-gray-300 cursor-help" />
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    {metric.tooltip}
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>

                  <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}%</div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full mt-2">
                    <div className={`h-full ${metric.barColor} rounded-full`} style={{ width: `${metric.value}%` }}></div>
                  </div>
                </div>
              ))}
            </div>

             {/* Chart */}
             <EloquenceChart currentEntry={entry} allEntries={allEntries} />

            {/* Deep Analysis Card */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center mb-4">
                <Sparkles className="w-5 h-5 text-indigo-600 mr-2" />
                <h3 className="text-lg font-serif font-bold text-gray-900">Analyse Littéraire</h3>
              </div>
              <div className="prose prose-indigo prose-sm text-gray-600 whitespace-pre-wrap font-serif leading-relaxed">
                {analysis.deepAnalysis || "Analyse approfondie non disponible."}
              </div>
            </div>

            {/* Suggestions */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <div className="flex items-center">
                  <Sparkles className="w-4 h-4 text-indigo-600 mr-2" />
                  <h3 className="font-semibold text-indigo-900">Reformulations</h3>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {analysis.suggestions.map((sug, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex items-start mb-3">
                      <AlertCircle className="w-4 h-4 text-orange-400 mt-1 mr-2 flex-shrink-0" />
                      <p className="text-gray-500 line-through text-sm italic">"{sug.original}"</p>
                    </div>
                    <div className="flex items-start pl-6 justify-between">
                      <div className="flex items-start">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-1 mr-2 flex-shrink-0" />
                        <div>
                          <p className="text-gray-800 font-medium text-sm">"{sug.improved}"</p>
                          <p className="text-xs text-gray-400 mt-1">{sug.reason}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePlayTTS(sug.improved, `sug-${idx}`)}
                        className="ml-2 p-2 rounded-full hover:bg-gray-100 text-indigo-500 flex-shrink-0"
                        disabled={playingTTS !== null}
                      >
                         {playingTTS === `sug-${idx}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* EXERCISE TAB */}
        {activeTab === 'exercise' && (
          <div className="space-y-6">
            
            {/* Lesson Card */}
            {exerciseTip ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                <div className="bg-indigo-600 p-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-indigo-200" />
                    <span className="text-indigo-200 text-xs font-bold uppercase tracking-wider">Focus du jour</span>
                  </div>
                  <h3 className="text-2xl font-bold font-serif">{exerciseTip.focusPoint}</h3>
                  <p className="text-indigo-100 mt-2 text-sm">{exerciseTip.explanation}</p>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Before/After Comparison */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <div className="text-xs font-bold text-red-500 uppercase mb-1">Dans votre texte</div>
                      <p className="text-gray-600 italic">"{exerciseTip.exampleOriginal}"</p>
                    </div>

                    <div className="flex justify-center -my-2 z-10">
                      <div className="bg-white rounded-full p-1 border border-gray-100 shadow-sm">
                        <ArrowRight className="w-5 h-5 text-gray-400 rotate-90" />
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 relative">
                      <div className="flex justify-between items-start">
                         <div>
                            <div className="text-xs font-bold text-green-600 uppercase mb-1">Version Éloquente</div>
                            <p className="text-gray-800 font-medium text-lg">"{exerciseTip.exampleImproved}"</p>
                         </div>
                         <button 
                            onClick={() => handlePlayTTS(exerciseTip.exampleImproved, 'improved')}
                            className="p-2 bg-white rounded-full text-green-600 shadow-sm hover:scale-105 transition-transform"
                            disabled={playingTTS !== null}
                          >
                            {playingTTS === 'improved' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
                          </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                    <p className="text-center text-gray-500 text-sm mb-4">À vous ! Répétez cette phrase pour ancrer l'habitude :</p>
                    <div className="text-center font-medium text-indigo-900 bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-6">
                       {exerciseTip.instruction}
                    </div>

                    {exerciseState === 'IDLE' && (
                       <button 
                         onClick={() => setExerciseState('RECORDING')}
                         className="w-full bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                       >
                         <Mic className="w-5 h-5" />
                         Commencer l'exercice
                       </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Legacy view for old entries
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-gray-600 italic mb-4">"{legacyTipString}"</p>
                 {exerciseState === 'IDLE' && (
                   <button onClick={() => setExerciseState('RECORDING')} className="bg-indigo-600 text-white px-6 py-2 rounded-full">Commencer</button>
                 )}
              </div>
            )}

            {/* Recording Area */}
            {(exerciseState === 'RECORDING' || exerciseState === 'ANALYZING') && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-gray-900">Enregistrement...</h4>
                  {exerciseState === 'RECORDING' && (
                     <button onClick={() => setExerciseState('IDLE')} className="text-xs text-gray-500 hover:text-red-500">Annuler</button>
                  )}
                </div>
                <AudioRecorder 
                  onRecordingComplete={handleExerciseRecordingComplete} 
                  isProcessing={exerciseState === 'ANALYZING'} 
                  compact={true}
                />
              </div>
            )}

            {/* Feedback Result */}
            {exerciseState === 'FEEDBACK' && exerciseFeedback && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between mb-4">
                   <h4 className="font-bold text-gray-900">Résultat</h4>
                   <div className={`px-3 py-1 rounded-full text-sm font-bold ${exerciseFeedback.score >= 7 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                     Score : {exerciseFeedback.score}/10
                   </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600 italic mb-4">
                  "{exerciseFeedback.transcription}"
                </div>

                <div className="prose prose-sm text-gray-700">
                  <p>{exerciseFeedback.critique}</p>
                </div>

                <div className="mt-6 flex justify-center">
                  <button 
                    onClick={() => setExerciseState('IDLE')}
                    className="text-indigo-600 font-medium text-sm hover:underline"
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
