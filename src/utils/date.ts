/**
 * Format timestamp into human-readable relative time (e.g. "now", "15s", "10m", "1h", "2d", "3w")
 */
export function formatRelativeTime(timestamp?: string | null): string {
  if (!timestamp) return 'now';
  try {
    const now = new Date();
    const postDate = new Date(timestamp);
    const diffMs = now.getTime() - postDate.getTime();

    if (isNaN(diffMs) || diffMs < 0) return 'now';

    const secs = Math.floor(diffMs / 1000);
    if (secs < 60) return `${Math.max(1, secs)}s`;

    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;

    const years = Math.floor(days / 365);
    return `${years}y`;
  } catch {
    return 'now';
  }
}
