
import React, { useEffect } from 'react';
import { AppSettings } from '../types';
import { Bell, Clock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings, onBack }) => {
  const [permission, setPermission] = React.useState<NotificationPermission>(Notification.permission);

  useEffect(() => {
    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  };

  const handleToggleReminder = async () => {
    const newValue = !settings.reminderEnabled;
    
    if (newValue && permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        alert("Les notifications doivent être autorisées pour activer le rappel.");
        return;
      }
    }

    onUpdateSettings({
      ...settings,
      reminderEnabled: newValue
    });
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({
      ...settings,
      reminderTime: e.target.value
    });
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h2 className="ml-3 text-lg font-bold text-gray-900">Réglages</h2>
      </div>

      <div className="p-6 space-y-6">
        
        {/* Reminder Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-indigo-50/50 flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-full">
              <Bell className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Rappel quotidien</h3>
              <p className="text-xs text-gray-500">N'oubliez jamais votre session d'éloquence.</p>
            </div>
          </div>

          <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Activer le rappel</label>
              <button 
                onClick={handleToggleReminder}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${settings.reminderEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${settings.reminderEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {settings.reminderEnabled && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-gray-700 mb-2">Heure du rappel</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Clock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="time"
                    value={settings.reminderTime}
                    onChange={handleTimeChange}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                {permission === 'denied' && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-md">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Les notifications sont bloquées par votre navigateur. Veuillez les autoriser dans les paramètres du site.</span>
                  </div>
                )}
                
                {permission === 'granted' && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded-md">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Notifications actives. Vous serez notifié à {settings.reminderTime}.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 mt-8">
          <p>Journal Éloquent v1.0</p>
          <p>Vos données sont stockées localement.</p>
        </div>

      </div>
    </div>
  );
};
