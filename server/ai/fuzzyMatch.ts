/**
 * Fuzzy matching utilities for finding objects by partial names
 */

export interface FuzzyMatchResult<T> {
  item: T;
  score: number;
}

/**
 * Calculate similarity score between two strings (0-1, higher is better)
 */
function similarityScore(search: string, target: string): number {
  const searchLower = search.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();
  
  // Exact match
  if (searchLower === targetLower) {
    return 1.0;
  }
  
  // Contains match (very strong)
  if (targetLower.includes(searchLower)) {
    return 0.9;
  }
  
  // Search term contained in target (strong)
  if (searchLower.includes(targetLower)) {
    return 0.8;
  }
  
  // Word-based matching (for multi-word names)
  const searchWords = searchLower.split(/[\s_-]+/);
  const targetWords = targetLower.split(/[\s_-]+/);
  
  let wordMatches = 0;
  for (const searchWord of searchWords) {
    for (const targetWord of targetWords) {
      if (targetWord.includes(searchWord) || searchWord.includes(targetWord)) {
        wordMatches++;
        break;
      }
    }
  }
  
  if (wordMatches > 0) {
    return 0.6 + (0.2 * (wordMatches / searchWords.length));
  }
  
  // Starts with match (moderate)
  if (targetLower.startsWith(searchLower)) {
    return 0.7;
  }
  
  // Character overlap (weak)
  let overlap = 0;
  for (const char of searchLower) {
    if (targetLower.includes(char)) {
      overlap++;
    }
  }
  const overlapScore = overlap / Math.max(searchLower.length, targetLower.length);
  return overlapScore * 0.5;
}

/**
 * Find best matching item by name with fuzzy matching
 * @param searchTerm - The search query
 * @param items - Array of items to search
 * @param nameExtractor - Function to extract name from item
 * @param threshold - Minimum score threshold (default: 0.5)
 * @returns Best matching item or null
 */
export function findBestMatch<T>(
  searchTerm: string,
  items: T[],
  nameExtractor: (item: T) => string,
  threshold: number = 0.5
): T | null {
  if (!searchTerm || items.length === 0) {
    return null;
  }
  
  const matches: FuzzyMatchResult<T>[] = items
    .map(item => ({
      item,
      score: similarityScore(searchTerm, nameExtractor(item))
    }))
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score);
  
  return matches.length > 0 ? matches[0].item : null;
}

/**
 * Find all matching items above a threshold
 * @param searchTerm - The search query
 * @param items - Array of items to search
 * @param nameExtractor - Function to extract name from item
 * @param threshold - Minimum score threshold (default: 0.5)
 * @returns Array of matching items sorted by score
 */
export function findAllMatches<T>(
  searchTerm: string,
  items: T[],
  nameExtractor: (item: T) => string,
  threshold: number = 0.5
): FuzzyMatchResult<T>[] {
  if (!searchTerm || items.length === 0) {
    return [];
  }
  
  return items
    .map(item => ({
      item,
      score: similarityScore(searchTerm, nameExtractor(item))
    }))
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

/**
 * Get suggestion text for when no match is found
 */
export function getSuggestionText<T>(
  searchTerm: string,
  items: T[],
  nameExtractor: (item: T) => string,
  itemType: string = 'item'
): string {
  if (items.length === 0) {
    return `No ${itemType}s available.`;
  }
  
  const suggestions = items
    .map(item => nameExtractor(item))
    .slice(0, 5)
    .join(', ');
  
  return `"${searchTerm}" not found. Available ${itemType}s: ${suggestions}${items.length > 5 ? ', ...' : ''}`;
}
