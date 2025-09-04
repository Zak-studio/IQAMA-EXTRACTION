/**
 * Parses a date string (expects YYYY-MM-DD) and checks its expiry status.
 * @param dateStr The date string to parse.
 * @returns An object indicating if the date is expired, expiring soon (within 30 days), and the number of days past expiry.
 */
export function parseAndCheckExpiry(dateStr: string): { isExpired: boolean; isExpiringSoon: boolean; daysAfterExpiry: number } {
  // Try to create a date object. Handle potential invalid formats gracefully.
  const expiryDate = new Date(dateStr);
  if (isNaN(expiryDate.getTime())) {
    // Invalid date string provided
    return { isExpired: false, isExpiringSoon: false, daysAfterExpiry: 0 };
  }

  // Get today's date, but set the time to 00:00:00 to compare dates only.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Also normalize expiryDate to midnight to avoid time zone issues.
  expiryDate.setHours(0, 0, 0, 0);

  // Positive if in future, negative if in past.
  const timeDiff = expiryDate.getTime() - today.getTime(); 
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  // Expired: daysDiff is negative.
  if (daysDiff < 0) {
    return { isExpired: true, isExpiringSoon: false, daysAfterExpiry: Math.abs(daysDiff) };
  }
  
  // Expiring soon: today or in the next 30 days.
  if (daysDiff >= 0 && daysDiff <= 30) {
    return { isExpired: false, isExpiringSoon: true, daysAfterExpiry: 0 };
  }

  // Valid and not expiring soon.
  return { isExpired: false, isExpiringSoon: false, daysAfterExpiry: 0 };
}