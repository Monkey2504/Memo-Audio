
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  isProcessing: boolean;
  compact?: boolean; // New prop for sizing
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, isProcessing, compact = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopVisualizer();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startVisualizer = (stream: MediaStream) => {
    if (!canvasRef.current) return;

    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyzerRef.current = audioContextRef.current.createAnalyser();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    
    sourceRef.current.connect(analyzerRef.current);
    analyzerRef.current.fftSize = 256;
    
    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyzerRef.current!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        ctx.fillStyle = `rgba(99, 102, 241, ${barHeight / 100})`; // Indigo-500 equivalent
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    audioContextRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startVisualizer(stream);
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        stopVisualizer();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); 
        onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Impossible d'accéder au microphone. Veuillez vérifier vos permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // UI Sizing Logic
  const canvasHeight = compact ? "64" : "128";
  const containerHeight = compact ? "h-16" : "h-32";
  const buttonSize = compact ? "w-16 h-16" : "w-24 h-24";
  const iconSize = compact ? "w-6 h-6" : "w-10 h-10";

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8 animate-pulse">
        <Loader2 className={`${compact ? 'w-8 h-8' : 'w-16 h-16'} text-indigo-500 animate-spin`} />
        {!compact && (
          <>
            <p className="text-gray-600 font-medium">Analyse en cours...</p>
            <p className="text-sm text-gray-400">Le miroir bienveillant vous écoute.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'space-y-3' : 'space-y-6'} w-full max-w-md mx-auto`}>
      <div className={`relative w-full ${containerHeight} bg-gray-50 rounded-xl overflow-hidden flex items-end justify-center border border-gray-200 shadow-inner`}>
        <canvas ref={canvasRef} width="400" height={canvasHeight} className="absolute bottom-0 w-full h-full" />
        {!isRecording && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            {compact ? "Enregistrement..." : "Prêt à vous écouter..."}
          </div>
        )}
      </div>

      <div className={`${compact ? 'text-xl' : 'text-3xl'} font-mono font-light text-gray-700`}>
        {formatTime(duration)}
      </div>

      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`relative group ${buttonSize} rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 ring-4 ring-red-200' 
            : 'bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-200'
        }`}
      >
        {isRecording ? (
          <Square className={`${iconSize} text-white fill-current`} />
        ) : (
          <Mic className={`${iconSize} text-white`} />
        )}
      </button>

      {!compact && (
        <p className="text-sm text-gray-500 text-center max-w-xs">
          {isRecording 
            ? "Parlez librement. Ne cherchez pas la perfection." 
            : "Racontez votre journée (30s à 5min). L'IA analysera votre style."}
        </p>
      )}
    </div>
  );
};
