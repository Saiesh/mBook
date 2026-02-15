// Utility functions for the application

/**
 * Format currency value
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format area with unit
 */
export function formatArea(area: number, unit: string = 'sq ft'): string {
  return `${area.toFixed(2)} ${unit}`;
}

/**
 * Calculate area from length and width
 */
export function calculateArea(length: number, width: number): number {
  return length * width;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}
