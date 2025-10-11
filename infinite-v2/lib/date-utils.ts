/**
 * Date formatting utilities that ensure consistent server/client rendering
 * to prevent hydration mismatches
 */

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Neplatný dátum';
  }
  
  // Use a consistent format that works the same on server and client
  if (typeof window !== 'undefined') {
    return dateObj.toLocaleDateString('sk-SK', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC' // Ensure consistent timezone
    });
  }
  
  // Fallback for server-side rendering
  return dateObj.toISOString().split('T')[0];
}

export function formatDateShort(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Neplatný dátum';
  }
  
  // Use consistent format for both server and client to avoid hydration mismatch
  return dateObj.toLocaleDateString('sk-SK', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export function formatDateForDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // ISO format for datetime attributes
  return dateObj.toISOString();
}
