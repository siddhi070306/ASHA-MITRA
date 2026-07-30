/**
 * Utility to format dates & times consistently across Doctor Dashboard, ANM Dashboard, and Main Dashboard.
 * Formats any date string, ISO timestamp, or Date object to local format (e.g. "30 Jul 2026, 09:58 AM").
 */
export function formatDateTime(dateInput) {
  if (!dateInput) {
    return new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // If it's already a formatted string containing AM/PM or formatted text, check if valid Date
  const dateObj = new Date(dateInput);

  if (isNaN(dateObj.getTime())) {
    // Return original string if string cannot be parsed as JS Date
    return String(dateInput);
  }

  return dateObj.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
