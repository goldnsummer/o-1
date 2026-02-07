
import React from 'react';
import { DarkPatternScan, Severity, CONSTANTS } from '../types';

interface AuditOverlayProps {
  scan: DarkPatternScan;
  idx: number;
  renderIdx?: number;
  isSelected: boolean;
  isHovered?: boolean;
  isDarkMode: boolean;
  onSelect: (idx: number) => void;
}

export const AuditOverlay: React.FC<AuditOverlayProps> = ({ scan, idx, renderIdx = 0, isSelected, isHovered, isDarkMode, onSelect }) => {
  if (scan.coordinates.every(c => c === 0)) return null;
  
  const [ymin, xmin, ymax, xmax] = scan.coordinates;
  const isHighRisk = scan.severity === Severity.High;
  const isUnclear = scan.pattern_type.toLowerCase().includes('unclear') || scan.pattern_type.toLowerCase().includes('suspicious');
  
  const isNearRight = xmin > 700;
  const isNearLeft = xmin < 300;
  const isNearTop = ymin < 300; 
  const isNearBottom = ymin > 700; 

  const boxHeight = (ymax - ymin);
  const boxWidth = (xmax - xmin);

  // Adaptive Stroke Width: Linear Perimeter Scaling to prevent "choking" tiny elements
  const adaptiveStrokeWidth = Math.max(1, Math.min(3.5, (boxWidth + boxHeight) / 80));

  // Use renderIdx to ensure smallest boxes (rendered last) have highest stacking context
  const boxStyle: React.CSSProperties = {
    top: `${ymin / 10}%`,
    left: `${xmin / 10}%`,
    width: `${boxWidth / 10}%`,
    height: `${boxHeight / 10}%`,
    borderWidth: `${adaptiveStrokeWidth}px`,
    borderStyle: 'solid',
    zIndex: isSelected ? 9999 : (isHovered ? 9998 : Math.min(80, 50 + renderIdx)), 
    // Outer white glow/outline added via secondary boxShadow part for visibility on all backgrounds
    boxShadow: (isSelected ? '0 0 15px rgba(255,255,255,0.4), ' : (isHovered ? '0 0 20px rgba(79, 70, 229, 0.6), ' : '')) + '0 0 0 1px rgba(255,255,255,0.5)',
    transform: isHovered ? 'scale(1.02)' : 'scale(1)',
    pointerEvents: 'auto'
  };
  
  let colorClass = scan.pattern_type === CONSTANTS.DESIGN_VERIFIED_FAIR ? 'border-emerald-500 bg-emerald-500/10' :
    (isUnclear ? 'border-amber-500 bg-amber-500/20' : 
    (scan.severity === Severity.High ? 'border-red-600 bg-red-600/30' : 
    (scan.severity === Severity.Medium ? 'border-amber-500 bg-amber-500/20' : 'border-blue-500 bg-blue-500/15')));

  const arrowPositionClass = isNearLeft ? 'left-4' : isNearRight ? 'right-4' : 'left-1/2 -translate-x-1/2';
  // If we're near the top, flip the tooltip UP (Existing positioning logic preserved)
  const showBelow = isNearTop && !isNearBottom;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable="false"
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className={`absolute transition-all rounded-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white ${colorClass}`}
      style={boxStyle}
      onClick={(e) => { e.stopPropagation(); onSelect(idx); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onSelect(idx); } }}
      aria-label={`Audit Box ${idx + 1}: ${scan.severity} risk - ${scan.pattern_type}. ${scan.truth_label}`}
      aria-expanded={isSelected}
    >
      <div className="absolute -inset-3" />

      {(isSelected || isHovered) && (
        <div 
          className={`absolute p-4 rounded-xl border font-black uppercase tracking-wide animate-in fade-in zoom-in-95 duration-200 flex flex-col items-start gap-2 z-[10000]
            ${isDarkMode ? 'bg-zinc-900 text-zinc-100 border-zinc-500 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.1),0_0_15px_rgba(255,255,255,0.05)]' : 'bg-white text-zinc-900 border-zinc-200 shadow-2xl'}
            ${isNearRight ? 'right-0' : isNearLeft ? 'left-0' : 'left-1/2 -translate-x-1/2'}
            ${showBelow ? 'top-[calc(100%+14px)]' : 'bottom-[calc(100%+14px)]'}`}
          style={{ 
            minWidth: isHighRisk ? '220px' : '150px', 
            maxWidth: '280px',
            maxHeight: '280px',
            pointerEvents: isSelected ? 'auto' : 'none'
          }}
        >
          <div className={`absolute w-3.5 h-3.5 rotate-45 border-l border-t ${isDarkMode ? 'bg-zinc-900 border-zinc-500' : 'bg-white border-zinc-200'} 
            ${showBelow ? '-top-[7.5px]' : '-bottom-[7.5px]'} 
            ${arrowPositionClass}
            ${showBelow ? '' : 'rotate-[225deg]'}`} 
          />
          
          <div className={`flex items-center gap-2 w-full border-b pb-2 mb-1 relative z-10 ${isDarkMode ? 'border-zinc-800' : 'border-zinc-500/20'}`}>
            <div className={`w-2 h-2 rounded-full ${isUnclear ? 'bg-amber-500' : (isHighRisk ? 'bg-red-500' : 'bg-indigo-500')}`}></div>
            <span className="truncate text-[10px] font-black tracking-tight">{scan.pattern_type}</span>
          </div>

          <div className="overflow-y-auto pr-1 w-full flex flex-col gap-2 relative z-10 custom-scrollbar">
            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 4px; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 10px; }
            `}</style>
            <div className="text-[9px] font-black uppercase tracking-widest block text-indigo-400">DEFENSIVE MANEUVER:</div>
            <div className="text-[11px] text-left leading-tight normal-case font-black">{scan.action_fix}</div>
            <div className={`text-[10px] leading-tight normal-case font-bold text-left mt-1 border-t pt-1 ${isDarkMode ? 'text-zinc-300 border-zinc-800' : 'opacity-80 border-zinc-100'}`}>{scan.truth_label}</div>
          </div>
        </div>
      )}
    </div>
  );
};
