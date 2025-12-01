import React, { useState, useEffect } from 'react';
import { processAudioEntry } from './services/geminiService';
import { JournalEntry, ViewState, AppSettings } from './types';
import { AudioRecorder } from './components/AudioRecorder';
import { EntryList } from './components/EntryList';
import { EntryDetail } from './components/EntryDetail';
import { SettingsView } from './components/SettingsView';
import { Mic, BookOpen, Search, Settings } from 'lucide-react';

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:audio/webm;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const DEFAULT_SETTINGS: AppSettings = {
  reminderEnabled: false,
  reminderTime: "20:00"
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Load data from localStorage
  useEffect(() => {
    const savedEntries = localStorage.getItem('eloquent_journal_entries');
    if (savedEntries) {
      try {
        const parsed = JSON.parse(savedEntries);
        setEntries(parsed);
      } catch (e) {
        console.error("Failed to load entries", e);
      }
    }

    const savedSettings = localStorage.getItem('eloquent_journal_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  // Save entries
  useEffect(() => {
    const entriesToSave = entries.map(({ audioUrl, ...rest }) => rest);
    localStorage.setItem('eloquent_journal_entries', JSON.stringify(entriesToSave));
  }, [entries]);

  // Save settings
  useEffect(() => {
    localStorage.setItem('eloquent_journal_settings', JSON.stringify(settings));
  }, [settings]);

  // Reminder Logic
  useEffect(() => {
    if (!settings.reminderEnabled) return;

    const checkReminder = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      
      if (timeString === settings.reminderTime) {
        const lastDate = localStorage.getItem('last_reminder_date');
        const today = now.toDateString();

        if (lastDate !== today) {
          if (Notification.permission === 'granted') {
            new Notification("Journal Éloquent", {
              body: "C'est l'heure de votre session d'éloquence quotidienne !",
              icon: '/vite.svg'
            });
            localStorage.setItem('last_reminder_date', today);
          }
        }
      }
    };

    const interval = setInterval(checkReminder, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [settings]);

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    // Create temporary entry
    const newId = Date.now().toString();
    const tempAudioUrl = URL.createObjectURL(audioBlob);

    try {
      const base64Audio = await blobToBase64(audioBlob);
      // Determine mime type based on blob or fallback
      const mimeType = audioBlob.type || 'audio/webm';
      
      const { transcription, analysis } = await processAudioEntry(base64Audio, mimeType);

      const newEntry: JournalEntry = {
        id: newId,
        date: new Date().toISOString(),
        transcription,
        analysis,
        audioUrl: tempAudioUrl,
        isProcessing: false,
      };

      setEntries(prev => [newEntry, ...prev]);
      setSelectedEntry(newEntry);
      setView(ViewState.DETAILS);

    } catch (error) {
      console.error("Processing failed", error);
      alert("Une erreur est survenue lors de l'analyse. Veuillez réessayer.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setView(ViewState.DETAILS);
  };

  const filteredEntries = entries.filter(e => {
    if (!searchQuery) return true;
    const lowerQ = searchQuery.toLowerCase();
    return (
      e.transcription.toLowerCase().includes(lowerQ) ||
      e.analysis?.summary.toLowerCase().includes(lowerQ) ||
      e.analysis?.tags.some(t => t.toLowerCase().includes(lowerQ))
    );
  });

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        
        {view === ViewState.HOME && (
          <div className="p-6 pt-12 space-y-8">
            <header className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Journal Éloquent</h1>
                <p className="text-gray-500">Votre miroir bienveillant.</p>
              </div>
            </header>

            <div className="py-8">
               <AudioRecorder onRecordingComplete={handleRecordingComplete} isProcessing={isProcessing} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-700">Récemment</h2>
                <button 
                  onClick={() => setView(ViewState.SEARCH)} 
                  className="text-indigo-600 text-sm font-medium hover:underline"
                >
                  Tout voir
                </button>
              </div>
              <EntryList entries={entries.slice(0, 3)} onSelectEntry={handleSelectEntry} />
            </div>
          </div>
        )}

        {view === ViewState.SEARCH && (
           <div className="p-6 space-y-6 h-full flex flex-col">
             <div className="flex items-center space-x-4">
               <button onClick={() => setView(ViewState.HOME)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                 <Mic className="w-5 h-5 text-gray-500" />
               </button>
               <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input 
                    type="text" 
                    placeholder="Rechercher..." 
                    className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                 />
               </div>
             </div>
             <div className="flex-1 overflow-y-auto">
               <EntryList entries={filteredEntries} onSelectEntry={handleSelectEntry} />
             </div>
           </div>
        )}

        {view === ViewState.DETAILS && selectedEntry && (
          <EntryDetail 
            entry={selectedEntry}
            allEntries={entries}
            onBack={() => setView(ViewState.HOME)} 
          />
        )}

        {view === ViewState.SETTINGS && (
          <SettingsView 
            settings={settings}
            onUpdateSettings={setSettings}
            onBack={() => setView(ViewState.HOME)}
          />
        )}
      </main>

      {/* Sticky Navigation */}
      {view !== ViewState.DETAILS && (
        <nav className="bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center z-20 pb-safe">
          <button 
            onClick={() => setView(ViewState.HOME)}
            className={`flex flex-col items-center space-y-1 ${view === ViewState.HOME ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <Mic className="w-6 h-6" />
            <span className="text-[10px] font-medium">Parler</span>
          </button>
          
          <button 
            onClick={() => setView(ViewState.SEARCH)}
            className={`flex flex-col items-center space-y-1 ${view === ViewState.SEARCH ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <BookOpen className="w-6 h-6" />
            <span className="text-[10px] font-medium">Journal</span>
          </button>

          <button 
            onClick={() => setView(ViewState.SETTINGS)}
            className={`flex flex-col items-center space-y-1 ${view === ViewState.SETTINGS ? 'text-indigo-600' : 'text-gray-400'}`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-medium">Réglages</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default App;