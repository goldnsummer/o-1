
export enum Severity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High'
}

export enum DefensiveStatus {
  Safe = 'DESIGN VERIFIED',
  Caution = 'MANIPULATIVE DESIGN',
  Compromised = 'CRITICAL DECEPTION'
}

export const CONSTANTS = {
  DESIGN_VERIFIED_FAIR: "Design Verified Fair"
} as const;

export function toSeverity(val: any): Severity {
  const s = String(val || '').toLowerCase();
  if (s.includes('high')) return Severity.High;
  if (s.includes('low')) return Severity.Low;
  return Severity.Medium;
}

export interface CatalogAnchor {
  id: string;
  name: string;
  price: string;
  numeric_price: number;
  original_price: string;
  original_numeric_price: number;
  coordinates: [number, number, number, number];
  is_violation: boolean;
  is_currently_visible: boolean;
}

export interface DarkPatternScan {
  pattern_type: string;
  coordinates: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  severity: Severity;
  truth_label: string;
  action_fix: string;
}

export interface HistoryItem {
  type: string;
  label: string;
}

export interface ScanResponse {
  viewport_meta: {
    threat_count: number;
    status: DefensiveStatus;
    advice: string;
  };
  scans: DarkPatternScan[];
  thought_signature: {
    reasoning_path: string;
    thinking_level?: number;
    catalog_anchors: CatalogAnchor[];
    security_brief?: string;
    [key: string]: any;
  };
  error?: string;
}
