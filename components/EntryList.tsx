import React from 'react';
import { JournalEntry } from '../types';
import { Calendar, ChevronRight, Hash, Trophy } from 'lucide-react';

interface EntryListProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
}

export const EntryList: React.FC<EntryListProps> = ({ entries, onSelectEntry }) => {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Journal vide</h3>
        <p className="text-gray-500 mt-2">Commencez par enregistrer votre première pensée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {entries.map((entry) => {
        const isAssertive = entry.analysis?.metrics.assertiveness && entry.analysis.metrics.assertiveness >= 80;
        const isClear = entry.analysis?.metrics.clarity && entry.analysis.metrics.clarity >= 80;
        
        return (
          <div 
            key={entry.id} 
            onClick={() => onSelectEntry(entry)}
            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden"
          >
            {/* Micro-success indicator */}
            {(isAssertive || isClear) && (
              <div className="absolute top-0 right-0 p-2 opacity-50">
                 <Trophy className="w-12 h-12 text-yellow-100 -rotate-12" />
              </div>
            )}

            <div className="flex justify-between items-start mb-2 relative z-10">
              <div>
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(entry.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                isAssertive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-600'
              }`}>
                {isAssertive && <Trophy className="w-3 h-3" />}
                {entry.analysis?.mood || 'Neutre'}
              </div>
            </div>

            <h3 className="text-gray-900 font-medium mb-1 line-clamp-1 relative z-10">
              {entry.analysis?.summary || "Nouvelle entrée..."}
            </h3>

            <div className="flex flex-wrap gap-2 mt-3 relative z-10">
              {entry.analysis?.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="inline-flex items-center text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  <Hash className="w-3 h-3 mr-1 opacity-50" />
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0">
              Voir l'analyse <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
