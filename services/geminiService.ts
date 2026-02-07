
import { GoogleGenAI, Type } from "@google/genai";
import { ScanResponse, Severity, DarkPatternScan, CatalogAnchor, toSeverity, DefensiveStatus } from "../types";

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
# MISSION: DIGITAL BODYGUARD (FORENSIC AUDIT)
You are the ShadowGuard Auditor (Pro-Tier). Your objective is to PROTECT the user from deceptive UI patterns with mathematical and psychological precision.

# AUDIENCE
The END-USER. You are their cynical, highly-trained digital advocate.

# SENSITIVITY CALIBRATION
- FLAG ONLY clear deceptive intent or manipulative design.
- MARKETING IS NOT ALWAYS DECEPTION: A standard "Sale" banner or clear promotional discount is neutral. 
- DO NOT flag regular marketing unless it uses fake urgency (timers that reset) or hidden costs.
- FINANCIAL RISK IS PRIORITY ONE: Bait-and-Switch, Hidden Fees, Sneak-in-Basket, Visual Interference.
- PSYCHOLOGICAL RISK: Confirmshaming, Scarcity loops, and obfuscated cancellation.
- If a pattern is common marketing and does not explicitly lie, label it as LOW severity.

# COORDINATE ACCURACY (TACTICAL LOCK)
- Provide pixel-tight bounding boxes [ymin, xmin, ymax, xmax] relative to the image (0-1000).
- You are a precision instrument. Coordinates must wrap the deceptive element exactly.

# THE SECURITY BRIEF & DEEP REASONING
- CROSS-STEP AUDIT: Compare current UI states to the 'catalog_anchors'. 
- TEMPORAL REASONING: If prices change or "limited time" offers reset, EXPOSE it.
- THE CATALOG LOCK: Track items in 'catalog_anchors'. Flag even $0.01 discrepancies.
- REASONING PATH: In your 'reasoning_path', briefly explain the psychological lever being pulled by the deceptive design.

# DEFENSIVE MANEUVER INSTRUCTIONS
Your 'action_fix' MUST be a tactical instruction for the user to avoid the trap.
- RIGHT: "The 'X' button is hidden in the top-right. Click it carefully to avoid the subscription pop-up."
- RIGHT: "This 'Limited Time' timer is fake; it resets every time you refresh. Don't let it rush your decision."

# DECEPTION TAXONOMY
Expose: BAIT-AND-SWITCH, SCARCITY, VISUAL INTERFERENCE, SNEAK-IN, CONFIRMSHAMING.
TONE: Clinical, protective, and cynical.
`;

function calculateSafetyMetrics(scans: DarkPatternScan[]) {
  const threatCount = scans.length;
  let score = 0;
  
  scans.forEach(s => {
    if (s.severity === Severity.High) score += 10;
    else if (s.severity === Severity.Medium) score += 3;
    else score += 1;
  });

  const hasBaitSwitch = scans.some(s => s.pattern_type.includes('SWITCH') || s.pattern_type.includes('BAIT'));
  const hasFinancialRisk = scans.some(s => s.pattern_type.includes('SNEAK') || s.pattern_type.includes('HIDDEN_FEE'));

  let status = DefensiveStatus.Safe;
  let advice = "Interface appears transparent. Safe to proceed.";

  // High threshold for "CRITICAL DECEPTION" to avoid aggressive marketing flags
  if (score >= 15 || hasBaitSwitch || hasFinancialRisk) {
    status = DefensiveStatus.Compromised;
    advice = "High deceptive load or financial risk. Verify all totals.";
  } else if (score > 0) {
    status = DefensiveStatus.Caution;
    advice = "Manipulative patterns detected. Stay objective.";
  }

  return { threat_count: threatCount, status, advice };
}

function tryParsePartialJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    let recovered = text.trim();
    if (!recovered.startsWith('{')) {
      const firstBrace = recovered.indexOf('{');
      if (firstBrace !== -1) recovered = recovered.substring(firstBrace);
    }
    let openBraces = (recovered.match(/\{/g) || []).length - (recovered.match(/\}/g) || []).length;
    if (recovered.lastIndexOf('}') < recovered.length - 1 && openBraces > 0) {
       for(let i=0; i<openBraces; i++) recovered += '}';
    }
    try {
      return JSON.parse(recovered);
    } catch {
      const lastBrace = recovered.lastIndexOf('}');
      if (lastBrace > 0) return JSON.parse(recovered.substring(0, lastBrace + 1));
    }
    throw e;
  }
}

function stripMarkdown(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

function clampCoordinates(coords: any): [number, number, number, number] {
  if (!Array.isArray(coords) || coords.length < 4) return [0, 0, 0, 0];
  return coords.map(c => Math.max(0, Math.min(1000, Math.round(Number(c) || 0)))) as [number, number, number, number];
}

export async function analyzeUIScreen(
  imageBase64: string, 
  previousSignature: Record<string, any> = {},
  signal?: AbortSignal
): Promise<ScanResponse> {
  const maxRetries = 2;
  let retryCount = 0;

  const filteredPrevious = {
    catalog_anchors: (previousSignature.catalog_anchors as CatalogAnchor[]) || [],
    security_brief: previousSignature.security_brief || "Session Start.",
  };

  while (retryCount <= maxRetries) {
    if (signal?.aborted) throw new Error("AbortError");
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] || imageBase64 } },
            { text: `AUDIT CONTEXT: ${JSON.stringify(filteredPrevious)}\nPerform deep forensic analysis of this UI segment. Flag all deception.` }
          ]
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 16384 },
          maxOutputTokens: 20000,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              thought_signature: { 
                type: Type.OBJECT,
                properties: {
                  reasoning_path: { type: Type.STRING },
                  security_brief: { type: Type.STRING },
                  catalog_anchors: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                        price: { type: Type.STRING },
                        numeric_price: { type: Type.NUMBER },
                        original_price: { type: Type.STRING },
                        original_numeric_price: { type: Type.NUMBER },
                        coordinates: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                        is_violation: { type: Type.BOOLEAN },
                        is_currently_visible: { type: Type.BOOLEAN }
                      },
                      required: ["id", "name", "price", "numeric_price", "coordinates", "is_violation", "is_currently_visible"]
                    }
                  }
                },
                required: ["reasoning_path", "catalog_anchors", "security_brief"]
              },
              scans: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pattern_type: { type: Type.STRING },
                    coordinates: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    severity: { type: Type.STRING },
                    truth_label: { type: Type.STRING },
                    action_fix: { type: Type.STRING }
                  },
                  required: ["pattern_type", "coordinates", "severity", "truth_label", "action_fix"]
                }
              }
            },
            required: ["scans", "thought_signature"]
          }
        }
      });

      const parsed = tryParsePartialJSON(stripMarkdown(response.text || '{}'));

      const clampedScans = (parsed.scans || []).map((s: any) => ({ 
        ...s, 
        coordinates: clampCoordinates(s.coordinates),
        severity: toSeverity(s.severity)
      }));
      
      const incomingAnchors: CatalogAnchor[] = parsed.thought_signature.catalog_anchors || [];
      const mergedAnchors = [...filteredPrevious.catalog_anchors];
      
      incomingAnchors.forEach((inAnchor: CatalogAnchor) => {
        let existingIdx = mergedAnchors.findIndex(a => a.id === inAnchor.id);
        if (existingIdx === -1 && inAnchor.name) {
          existingIdx = mergedAnchors.findIndex(a => a.name.trim().toLowerCase() === inAnchor.name.trim().toLowerCase());
        }

        if (existingIdx > -1) {
          const existing = mergedAnchors[existingIdx];
          const origNumeric = existing.original_numeric_price ?? inAnchor.numeric_price;
          const priceDiff = Math.abs((inAnchor.numeric_price ?? 0) - (origNumeric ?? 0));
          const isViolation = (priceDiff > 0.01) || (inAnchor.is_violation && priceDiff > 0.01);
          
          mergedAnchors[existingIdx] = {
            ...inAnchor,
            id: existing.id, 
            original_price: existing.original_price || inAnchor.original_price,
            original_numeric_price: origNumeric,
            is_violation: isViolation
          };
        } else {
          mergedAnchors.push({
            ...inAnchor,
            original_price: inAnchor.price,
            original_numeric_price: inAnchor.numeric_price,
            is_violation: false 
          });
        }
      });

      const { threat_count, status, advice } = calculateSafetyMetrics(clampedScans);
      return { 
        viewport_meta: { threat_count, status, advice }, 
        scans: clampedScans, 
        thought_signature: { ...parsed.thought_signature, catalog_anchors: mergedAnchors } 
      };
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      // Exponentially backoff for Gemini 3 Pro rate limits
      if (retryCount < maxRetries) {
        retryCount++;
        await wait(retryCount * 5000);
        continue;
      }
      return { 
        viewport_meta: { threat_count: 0, status: DefensiveStatus.Caution, advice: "System Focus Failed." }, 
        scans: [], 
        thought_signature: { ...filteredPrevious, reasoning_path: "Audit halted due to resource constraints." }, 
        error: "Neural Link Failure (Rate Limited or Busy)." 
      };
    }
  }
  return { 
    viewport_meta: { threat_count: 0, status: DefensiveStatus.Caution, advice: "Audit Aborted." }, 
    scans: [], 
    thought_signature: { ...filteredPrevious, reasoning_path: "Max retries reached." }, 
    error: "Audit Halted." 
  };
}
