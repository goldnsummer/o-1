
import React, { useEffect, useRef } from 'react';
import { DarkPatternScan, Severity, CONSTANTS } from '../types';

interface PatternCardProps {
  scan: DarkPatternScan;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onHover: (idx: number | null) => void;
  isDarkMode: boolean;
}

export const PatternCard: React.FC<PatternCardProps> = ({ scan, index, isSelected, onSelect, onHover, isDarkMode }) => {
  const cardRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (isSelected && cardRef.current) {
      const scrollHandler = () => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
        });
      };
      const rafId = requestAnimationFrame(scrollHandler);
      return () => cancelAnimationFrame(rafId);
    }
  }, [isSelected]);

  const isClean = scan.pattern_type === CONSTANTS.DESIGN_VERIFIED_FAIR;
  const isUnclear = scan.pattern_type.toLowerCase().includes('unclear') || scan.pattern_type.toLowerCase().includes('suspicious');

  const accentColors = {
    [Severity.Low]: isClean ? 'bg-emerald-500' : 'bg-blue-500',
    [Severity.Medium]: 'bg-amber-500',
    [Severity.High]: isUnclear ? 'bg-amber-500' : 'bg-red-600',
  };

  const bgClasses = isDarkMode 
    ? (isSelected ? 'bg-zinc-800 border-zinc-600 shadow-inner' : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800')
    : (isSelected ? 'bg-zinc-100 border-zinc-300 shadow-inner' : 'bg-transparent hover:bg-black/5 border-zinc-100');

  return (
    <button 
      ref={cardRef}
      type="button"
      draggable="false"
      onClick={onSelect}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      className={`w-full text-left relative pl-6 pr-4 py-6 cursor-pointer transition-all duration-300 border-2 rounded-2xl m-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${bgClasses}`}
      aria-pressed={isSelected}
    >
      <div className={`absolute left-2 top-4 bottom-4 w-[4px] rounded-full ${accentColors[scan.severity]} ${isSelected ? 'opacity-100' : 'opacity-40'}`}></div>
      <div className="flex justify-between items-start mb-3">
        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-zinc-400' : 'opacity-60'}`}>
          {isClean ? "VERIFIED" : `AUDIT ${index + 1}`} • {scan.pattern_type}
        </span>
      </div>
      <p className={`text-[13px] leading-relaxed mb-4 font-bold ${isDarkMode ? 'text-zinc-100' : 'text-zinc-800'}`}>
        {scan.truth_label}
      </p>
      <div className={`mt-2 p-3.5 rounded-2xl border-l-4 border-2 transition-colors ${isDarkMode ? 'bg-black/40 border-zinc-800' : 'bg-zinc-100/50 border-zinc-200'}`}>
        <span className="text-[9px] font-black uppercase tracking-widest block mb-1 text-indigo-400">DEFENSIVE MANEUVER:</span>
        <p className={`text-sm font-black leading-snug ${isDarkMode ? 'text-zinc-200' : 'text-zinc-900'}`}>{scan.action_fix}</p>
      </div>
    </button>
  );
};
