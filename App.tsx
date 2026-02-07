
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { analyzeUIScreen } from './services/geminiService';
import { getCaptureStream, captureFrame } from './services/captureService';
import { DarkPatternScan, Severity, HistoryItem, CatalogAnchor, DefensiveStatus } from './types';
import { PatternCard } from './components/PatternCard';
import { AuditOverlay } from './components/AuditOverlay';

const STORAGE_KEYS = {
  SIGNATURE: 'shadowguard_session_signature',
  HISTORY: 'shadowguard_audit_history',
  DARK_MODE: 'shadowguard_theme'
};

// Increased for Gemini 3 Pro rate-limit friendliness
const TILE_COOLDOWN = 5000; 

const THEATRICAL_STAGES = [
  "Synchronizing Neural Buffers...",
  "Deconstructing DOM Shadow layers...",
  "Isolating Manipulative Semantic patterns...",
  "Cross-referencing Price Integrity...",
  "Auditing Financial Bait-and-Switch vectors...",
  "Mapping Psychological Scarcity triggers...",
  "Verifying UI Transparency compliance...",
  "Finalizing Deep Forensic Scan..."
];

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [scans, setScans] = useState<DarkPatternScan[]>([]);
  const [auditHistory, setAuditHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [viewportMeta, setViewportMeta] = useState<{ threat_count: number; status: DefensiveStatus; advice: string } | null>(null);
  const [lastSignature, setLastSignature] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SIGNATURE);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; stage: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);
  const [hasCompletedInitialScan, setHasCompletedInitialScan] = useState(false);
  const [theatricalStageIndex, setTheatricalStageIndex] = useState(0);
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isScanningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [stream]);

  useEffect(() => {
    if (isCapturing && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isCapturing, stream]);

  // Theatrical Rotation Effect
  useEffect(() => {
    let interval: number;
    if (loading) {
      interval = window.setInterval(() => {
        setTheatricalStageIndex(prev => (prev + 1) % THEATRICAL_STAGES.length);
      }, 3500);
    } else {
      setTheatricalStageIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const stopCapturing = useCallback(() => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsCapturing(false);
  }, [stream]);

  const persistScanState = useCallback((signature: Record<string, any>, history: HistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SIGNATURE, JSON.stringify(signature));
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(-100)));
    } catch (e) {
      console.warn("Storage Quota Hit.");
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (abortControllerRef.current) {
        setIsCancelling(true);
        abortControllerRef.current.abort();
      }
      stopCapturing();
      setImage(e.target?.result as string);
      setScans([]);
      setViewportMeta(null);
      setError(null);
      setIsCancelling(false);
      setHasCompletedInitialScan(false);
    };
    reader.readAsDataURL(file);
  }, [stopCapturing]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) handleFile(blob);
        break;
      }
    }
  }, [handleFile]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleDiscard = () => {
    if (abortControllerRef.current) {
      setIsCancelling(true);
      abortControllerRef.current.abort();
    }
    stopCapturing();
    setImage(null);
    setScans([]);
    setViewportMeta(null);
    setError(null);
    setSelectedIndex(null);
    setHoveredIndex(null);
    setScanProgress(null);
    isScanningRef.current = false;
    setHasCompletedInitialScan(false);
    setTimeout(() => setIsCancelling(false), 300);
  };

  const handleClear = () => {
    handleDiscard();
    setLastSignature({});
    setAuditHistory([]);
    localStorage.removeItem(STORAGE_KEYS.SIGNATURE);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  };

  const onCaptureTab = async () => {
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const newStream = await getCaptureStream();
      if (stream) stream.getTracks().forEach(t => t.stop());
      setStream(newStream);
      setIsCapturing(true);
      setImage(null);
      setScans([]);
      setError(null);
      setHasCompletedInitialScan(false);
      newStream.getVideoTracks()[0].addEventListener('ended', () => {
        setIsCapturing(false);
        setStream(null);
      });
    } catch (err: any) {
      setError(err.message || "Capture restricted.");
    }
  };

  const handleSnap = async () => {
    if (!videoRef.current || !isCapturing) return;
    try {
      const dataUrl = captureFrame(videoRef.current);
      setImage(dataUrl);
      stopCapturing();
      setTimeout(() => handleScan(), 50);
    } catch (err: any) {
      setError(err.message || "Failed to snap frame.");
    }
  };

  const handleScan = async () => {
    if (loading || isScanningRef.current || !image) return;
    const imgSource = imageRef.current;
    if (!imgSource || !imgSource.complete) {
        setTimeout(handleScan, 100);
        return;
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    isScanningRef.current = true;
    setLoading(true);
    setError(null);
    setScans([]); // Clear scans at the beginning to allow progressive addition
    
    const fullWidth = imgSource.naturalWidth;
    const fullHeight = imgSource.naturalHeight;
    const maxTileHeight = 1536; 
    const overlap = 150; 
    const effectiveTileHeight = maxTileHeight - overlap;
    const numTiles = fullHeight <= maxTileHeight ? 1 : Math.ceil((fullHeight - overlap) / effectiveTileHeight);
    
    // Set initial progress immediately to avoid empty stage
    setScanProgress({ current: 0, total: numTiles, stage: THEATRICAL_STAGES[0] });

    let loopSignature = { ...lastSignature };
    let currentTotalScans: DarkPatternScan[] = [];
    let loopHistory: HistoryItem[] = [...auditHistory];
    let finalStatus = DefensiveStatus.Safe;
    let finalAdvice = "Interface appears transparent. Safe to proceed.";

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      for (let i = 0; i < numTiles; i++) {
        if (abortController.signal.aborted) throw new Error("AbortError");
        
        // Cooldown between requests to manage Pro-tier rate limits
        if (i > 0) {
            setScanProgress(prev => ({ ...prev!, current: i, stage: "Rate Limit Buffering..." }));
            await new Promise(r => setTimeout(r, TILE_COOLDOWN)); 
        }

        const stageMessage = THEATRICAL_STAGES[i % THEATRICAL_STAGES.length];
        setScanProgress({ current: i + 1, total: numTiles, stage: stageMessage });
        
        let offsetY = Math.floor(i * effectiveTileHeight);
        let currentTileHeight = Math.floor(Math.min(maxTileHeight, fullHeight - offsetY));
        
        canvas.width = fullWidth;
        canvas.height = currentTileHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imgSource, 0, offsetY, fullWidth, currentTileHeight, 0, 0, fullWidth, currentTileHeight);
        
        const tileDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const result = await analyzeUIScreen(tileDataUrl, loopSignature, abortController.signal);
        
        if (result.error) {
          setError(result.error);
          // If we have some scans from previous tiles, we still show them, but stop the loop.
          break;
        }

        const tileSpecificScans: DarkPatternScan[] = [];
        const catalogAnchors: CatalogAnchor[] = result.thought_signature.catalog_anchors || [];
        
        catalogAnchors.forEach(anchor => {
          if (anchor.is_violation && anchor.is_currently_visible && !anchor.coordinates.every(c => c === 0)) {
             const [lymin, lxmin, lymax, lxmax] = anchor.coordinates;
             const gy1 = (((lymin / 1000 * currentTileHeight) + offsetY) / fullHeight) * 1000;
             const gy2 = (((lymax / 1000 * currentTileHeight) + offsetY) / fullHeight) * 1000;
             
             tileSpecificScans.push({
               pattern_type: "BAIT-AND-SWITCH",
               coordinates: [gy1, lxmin, gy2, lxmax],
               severity: Severity.High,
               truth_label: `${anchor.name}: Price hiked since session start.`,
               action_fix: "Suspicious price movement detected. Re-verify the total before confirming."
             });
          }
        });

        result.scans.forEach(scan => {
          if (!scan.coordinates || scan.coordinates.every(c => c === 0)) return;
          const [lymin, lxmin, lymax, lxmax] = scan.coordinates;
          const gy1 = (((lymin / 1000 * currentTileHeight) + offsetY) / fullHeight) * 1000;
          const gy2 = (((lymax / 1000 * currentTileHeight) + offsetY) / fullHeight) * 1000;
          
          tileSpecificScans.push({ ...scan, coordinates: [gy1, lxmin, gy2, lxmax] });
        });

        // PROGRESSIVE UPDATE: Update results as they come in
        currentTotalScans = [...currentTotalScans, ...tileSpecificScans];
        loopHistory = [...loopHistory, ...tileSpecificScans.map(m => ({ type: m.pattern_type, label: m.truth_label }))];
        
        if (result.viewport_meta.status === DefensiveStatus.Compromised) {
          finalStatus = DefensiveStatus.Compromised;
          finalAdvice = result.viewport_meta.advice;
        } else if (result.viewport_meta.status === DefensiveStatus.Caution && finalStatus !== DefensiveStatus.Compromised) {
          finalStatus = DefensiveStatus.Caution;
          finalAdvice = result.viewport_meta.advice;
        }

        loopSignature = { ...loopSignature, ...result.thought_signature };
        
        // Push state updates for real-time visualization
        setScans(currentTotalScans);
        setAuditHistory(loopHistory);
        setViewportMeta({ threat_count: currentTotalScans.length, status: finalStatus, advice: finalAdvice });
        setLastSignature(loopSignature);
      }
      
      persistScanState(loopSignature, loopHistory);
      setHasCompletedInitialScan(true);
    } catch (err: any) {
      if (err.message !== "AbortError") setError("Audit Failure. System Overload.");
    } finally {
      setLoading(false);
      setScanProgress(null);
      isScanningRef.current = false;
    }
  };

  const sortedScansForOverlay = useMemo(() => {
    return [...scans]
      .map((s, originalIdx) => ({ ...s, originalIdx }))
      .sort((a, b) => {
        const areaA = (a.coordinates[2] - a.coordinates[0]) * (a.coordinates[3] - a.coordinates[1]);
        const areaB = (b.coordinates[2] - b.coordinates[0]) * (b.coordinates[3] - b.coordinates[1]);
        return areaB - areaA; 
      });
  }, [scans]);

  return (
    <div className={`min-h-screen flex flex-col transition-all ${isDarkMode ? 'bg-[#09090b] text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
      <canvas ref={canvasRef} className="hidden" />
      <header className={`sticky top-0 z-[100] border-b p-4 backdrop-blur-md ${isDarkMode ? 'bg-[#18181b]/95 border-zinc-700' : 'bg-white/95 border-zinc-200 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-tighter uppercase">OPTIC-1 <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-sm ml-1">PRO</span></h1>
            {viewportMeta && (
              <div className={`ml-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                viewportMeta.status === DefensiveStatus.Compromised ? 'bg-red-600 text-white animate-pulse' :
                viewportMeta.status === DefensiveStatus.Caution ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                <span>{viewportMeta.status}</span>
                <span className="opacity-50">|</span>
                <span className="font-bold">{viewportMeta.advice}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
             {image && !loading && (
               <button onClick={handleDiscard} className="px-4 py-2 text-[10px] font-black uppercase rounded-full border-2 border-zinc-500/30 text-zinc-500 hover:bg-zinc-500/10">Discard Viewport</button>
             )}
             <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${isDarkMode ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
                {isDarkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
             </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div 
            onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) handleFile(file); }}
            className={`relative w-full rounded-3xl border-2 min-h-[500px] flex items-center justify-center transition-all overflow-visible isolation-isolate z-[1] ${isDarkMode ? 'bg-[#09090b] border-zinc-700' : 'bg-white border-zinc-200 shadow-xl'} ${isDragging ? 'scale-[0.98] border-indigo-500 ring-4 ring-indigo-500/20' : ''}`}
          >
            {loading && !isCancelling && <div className="scanning-line" />}
            
            {!image && !isCapturing ? (
              <div className="text-center p-12 opacity-60">
                <h2 className="text-xl font-black mb-2 uppercase tracking-widest text-indigo-500">Shield Initialized</h2>
                <p className="text-sm">Upload or paste the suspicious interface.</p>
              </div>
            ) : isCapturing ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-black rounded-3xl overflow-hidden p-2">
                 <video ref={videoRef} autoPlay muted playsInline className="w-full h-auto max-h-[600px] rounded-2xl object-contain border border-zinc-800" />
                  <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-700/50">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-100">Live Viewfinder</span>
                  </div>
                  <button onClick={stopCapturing} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-zinc-700 transition-colors">X</button>
              </div>
            ) : (
              <div className="relative p-4 w-full h-full flex items-center justify-center overflow-visible">
                <div className="relative inline-block w-full overflow-visible cursor-default" onClick={() => setSelectedIndex(null)}>
                  <img ref={imageRef} src={image} alt="Audit" className="block w-full h-auto rounded-xl" />
                  <div className="absolute inset-0 pointer-events-none overflow-visible">
                    {!loading && sortedScansForOverlay.map((s, renderIdx) => (
                      <AuditOverlay key={s.originalIdx} scan={s} idx={s.originalIdx} renderIdx={renderIdx} isDarkMode={isDarkMode} isSelected={selectedIndex === s.originalIdx} isHovered={hoveredIndex === s.originalIdx} onSelect={(idx) => setSelectedIndex(prev => prev === idx ? null : idx)} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {(loading || isCancelling) && (
              <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-md text-white rounded-3xl">
                <div className="w-12 h-12 border-4 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <p className="font-black uppercase text-[10px] tracking-widest animate-pulse text-center px-4 max-w-[250px]">
                  {isCancelling ? 'CANCELLING AUDIT...' : THEATRICAL_STAGES[theatricalStageIndex]}
                </p>
                {!isCancelling && scanProgress && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                        <div className="flex gap-1">
                            {Array.from({length: scanProgress.total}).map((_, i) => (
                                <div key={i} className={`h-1 w-4 rounded-full transition-colors duration-500 ${i < scanProgress.current ? 'bg-indigo-500' : 'bg-zinc-800'}`}></div>
                            ))}
                        </div>
                        <span className="text-[8px] font-bold text-zinc-500 uppercase">Analyzing Tile {scanProgress.current} of {scanProgress.total}</span>
                    </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-4">
              {isCapturing ? (
                <button onClick={handleSnap} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-98 uppercase tracking-widest">Snap & Analyze</button>
              ) : (
                <>
                  {(!image || hasCompletedInitialScan) && <button onClick={() => document.getElementById('fileInput')?.click()} className={`flex-1 py-4 font-black rounded-2xl border-2 bg-indigo-600 text-white border-transparent transition-all hover:bg-indigo-700 uppercase`}>UPLOAD UI</button>}
                  {(!image || hasCompletedInitialScan) && <button onClick={onCaptureTab} className={`flex-1 py-4 font-black rounded-2xl border-2 transition-all uppercase ${isDarkMode ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-800/40' : 'border-zinc-300 text-zinc-400 hover:bg-zinc-100'}`}>CAPTURE TAB</button>}
                  
                  {image && !loading && !isCancelling && !hasCompletedInitialScan && (
                    <div className="flex flex-1 gap-2">
                       <button onClick={handleDiscard} className={`px-6 py-4 font-black rounded-2xl border-2 uppercase ${isDarkMode ? 'border-zinc-700 text-zinc-400' : 'border-zinc-300 text-zinc-500'}`}>Discard</button>
                       <button onClick={handleScan} className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-98 uppercase tracking-widest">{error ? 'RETRY FORENSIC AUDIT' : 'START FORENSIC AUDIT'}</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <input id="fileInput" type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} accept="image/*" className="hidden" />
        </div>
        <div className="lg:col-span-5">
          <div className={`sticky top-[88px] border-2 rounded-[2.5rem] flex flex-col h-[calc(100vh-140px)] min-h-[500px] overflow-hidden transition-colors self-start ${isDarkMode ? 'bg-[#18181b] border-zinc-700' : 'bg-white border-zinc-200 shadow-xl'}`}>
            <div className={`p-6 border-b-2 font-black text-xs uppercase tracking-widest flex justify-between items-center ${isDarkMode ? 'border-zinc-700/50' : 'border-zinc-100'}`}>
              <span className="text-indigo-500">Forensic Feed</span>
              <button onClick={handleClear} className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border-2 transition-colors ${isDarkMode ? 'border-red-500/20 text-red-500/60 hover:bg-red-500/10' : 'border-red-500/10 text-red-500/50 hover:bg-red-500/5'}`}>New Session</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
              {error && (
                <div className="p-6 border-2 rounded-2xl bg-red-950/20 border-red-500/30 text-red-400 flex flex-col gap-3">
                  <span className="font-bold uppercase text-[10px]">Neural Lock Failure: {error}</span>
                  <button onClick={!image ? onCaptureTab : handleScan} className="text-[10px] bg-red-500 text-white py-2 px-4 rounded-lg font-black uppercase self-start hover:bg-red-600 transition-colors">Re-Attempt Audit</button>
                </div>
              )}
              {scans.length === 0 && !loading && !error && (
                <div className={`py-24 text-center font-black uppercase text-xs flex flex-col gap-4 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-400/60'}`}>
                  <span>{hasCompletedInitialScan ? "No deception patterns found in current viewport." : "Ready for interface analysis..."}</span>
                  {hasCompletedInitialScan && <div className="text-[32px] animate-bounce">🛡️</div>}
                </div>
              )}
              {scans.map((s, i) => <PatternCard key={i} scan={s} index={i} isSelected={selectedIndex === i} onSelect={() => setSelectedIndex(prev => prev === i ? null : i)} onHover={setHoveredIndex} isDarkMode={isDarkMode} />)}
            </div>
            
            <div className={`border-t-2 transition-all duration-300 flex flex-col overflow-hidden bg-black ${lastSignature.reasoning_path && !loading ? (logExpanded ? 'h-64' : 'h-32') : 'h-0 opacity-0'} ${isDarkMode ? 'border-zinc-700' : ''}`}>
                <div className="p-4 flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center mb-2 border-b border-zinc-900 pb-1 sticky top-0 bg-black py-1 z-10">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                          <span className={`font-black uppercase text-[10px] mono tracking-tighter ${isDarkMode ? 'text-zinc-300' : 'text-zinc-500'}`}>REASONING_STDOUT</span>
                        </div>
                        <button onClick={() => setLogExpanded(!logExpanded)} className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 underline">
                          {logExpanded ? 'SHRINK' : 'EXPAND'}
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-[#050505] p-2 rounded-md">
                      <pre className="whitespace-pre-wrap font-mono text-[9px] text-[#00ff41] leather leading-relaxed drop-shadow-[0_0_2px_rgba(0,255,65,0.4)]">
                        {`> SESSION_CONTEXT_RAWS\n> MEMORY: ${lastSignature.security_brief || "None"}\n> AUDITING...\n> ${lastSignature.reasoning_path || ""}`}
                      </pre>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </main>
      <footer className={`p-10 border-t mt-auto text-[10px] font-black uppercase tracking-[0.3em] text-center ${isDarkMode ? 'text-zinc-500 border-zinc-800' : 'text-zinc-600 border-zinc-200'}`}>Optic-1 (c) 2026 Intelligence Lab</footer>
    </div>
  );
};

export default App;
