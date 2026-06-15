import React, { useState, useEffect } from 'react';
import { Terminal, FileCode2, ArrowLeft, RefreshCw, AlertCircle, Play, ServerCrash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LogLine {
  time: string;
  text: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

const INITIAL_LOGS: LogLine[] = [
  { time: '03:53:57', text: 'Build queued successfully! BuildID: build_67304068-916c-4d9d-bbb1-ed00102ff4df', type: 'success' },
  { time: '03:53:57', text: 'Connecting to live compiler log stream...', type: 'info' },
  { time: '03:53:57', text: 'Log stream connection lost. Attempting to recover', type: 'error' }
];

export default function GradleCompilerLogs({ onBack }: { onBack?: () => void }) {
  const [logs, setLogs] = useState<LogLine[]>(INITIAL_LOGS);
  const [isActive, setIsActive] = useState(true);
  
  // Simulate attempting to recover
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isActive) {
      timeoutId = setTimeout(() => {
        setLogs(prev => [
          ...prev,
          { time: '03:54:05', text: 'Attempting to reconnect to daemon...', type: 'warn' },
          { time: '03:54:10', text: 'Connection failed. Gradle daemon unresponsive.', type: 'error' }
        ]);
        setIsActive(false);
      }, 3000);
    }
    
    return () => clearTimeout(timeoutId);
  }, [isActive]);

  const handleRetry = () => {
    setLogs([{ time: new Date().toLocaleTimeString('en-US', { hour12: false }), text: 'Initializing Gradle Build Daemon...', type: 'info' }]);
    setIsActive(true);
    
    setTimeout(() => {
      setLogs(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString('en-US', { hour12: false }), text: 'Build queued successfully! BuildID: new_build_' + Math.random().toString(36).substring(7), type: 'success' },
      ]);
    }, 1500);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0A0E17] text-gray-300 font-mono h-full w-full overflow-hidden select-none">
      {/* Header */}
      <div className="bg-[#111928] border-b border-gray-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="bg-[#1F2937] p-1.5 rounded-md border border-gray-700">
              <Terminal className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm tracking-wide">Gradle Compiler Logs</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5 font-sans">
                {isActive ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold tracking-widest uppercase">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    ACTIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-400 font-bold tracking-widest uppercase">
                    <ServerCrash className="w-3 h-3" />
                    DISCONNECTED
                  </span>
                )}
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">Android Build Terminal</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRetry}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition-colors border border-gray-700 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isActive ? 'animate-spin text-emerald-400' : 'text-gray-400'}`} />
            Restart Stream
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 relative group">
        <AnimatePresence initial={false}>
          {logs.map((log, index) => (
            <motion.div 
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              key={index} 
              className={`flex items-start gap-3 text-[11px] sm:text-xs leading-relaxed ${
                log.type === 'error' ? 'text-rose-400 bg-rose-500/10 py-1 px-2 rounded -mx-2' : 
                log.type === 'warn' ? 'text-amber-400' : 
                log.type === 'success' ? 'text-emerald-400' : 'text-gray-300'
              }`}
            >
              <span className="text-gray-600 shrink-0 select-none">[{log.time}]</span>
              <span className="font-medium break-all">{log.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex items-center gap-2 text-gray-500 text-xs mt-2"
          >
            <span className="w-2 h-4 bg-gray-500 animate-pulse"></span>
            Awaiting response...
          </motion.div>
        )}
      </div>
      
      {/* Footer Status */}
      <div className="bg-[#0A0E17] border-t border-gray-800 p-2 px-4 flex items-center justify-between text-[10px] text-gray-500 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><FileCode2 className="w-3 h-3" /> build.gradle.kts</span>
          <span>JVM: 17.0.2</span>
        </div>
        <span>Powered by Gradle</span>
      </div>
    </div>
  );
}
