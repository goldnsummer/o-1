
/**
 * Utility functions for ShadowGuard
 */

/**
 * Normalizes price strings into numeric values for mathematical auditing.
 * Handles various global currency formats and free-tier terminology.
 */
export const cleanPrice = (val: string | undefined | null): number => {
  if (!val || val.trim() === "") return NaN;
  const lower = val.toLowerCase();
  if (lower.includes('free') || lower.includes('gratis')) return 0;
  
  // Use a targeted regex to look for numeric patterns adjacent to currency anchors
  // This prevents merging separate numbers like quantity or date into the price.
  const priceMatch = val.match(/([\$€£¥]|USD|EUR|GBP|CAD|AUD)\s?([\d,.]+\d)|([\d,.]+\d)\s?([\$€£¥]|USD|EUR|GBP|CAD|AUD)/i);
  
  let raw = "";
  if (priceMatch) {
    // Priority 1: Pick the numeric part of the currency-anchored match
    raw = (priceMatch[2] || priceMatch[3]).replace(/[^\d,.]/g, '');
  } else {
    // Priority 2: Fallback to the first numeric word in the string
    const parts = val.trim().split(/\s+/);
    raw = parts[0].replace(/[^\d,.]/g, '');
  }
  
  if (!/\d/.test(raw)) return NaN;
  
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  
  let cleaned = '';
  if (lastComma !== -1 && lastDot !== -1) {
    // Mixed format: 1.200,50 or 1,200.50
    if (lastComma > lastDot) cleaned = raw.replace(/\./g, '').replace(',', '.');
    else cleaned = raw.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // Comma only: 1200,50 or 1,200
    cleaned = (raw.length - 1 - lastComma === 2) ? raw.replace(',', '.') : raw.replace(',', '');
  } else if (lastDot !== -1) {
    // Dot only: 1200.50 or 1.200
    cleaned = (raw.length - 1 - lastDot === 2) ? raw : raw.replace(/\./g, '');
  } else {
    cleaned = raw;
  }
  
  const result = parseFloat(cleaned);
  return isNaN(result) ? NaN : result;
};
