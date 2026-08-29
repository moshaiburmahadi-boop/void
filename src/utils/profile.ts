import { BirthdayDisplay, BirthdayVisibility, GenderOption, GenderVisibility } from '../types';

export const PRESET_INTERESTS: string[] = [
  'Technology',
  'Programming',
  'Design',
  'AI & ML',
  'Gaming',
  'Music',
  'Movies',
  'Photography',
  'Crypto & Web3',
  'Science',
  'Art & Illustration',
  'Writing',
  'Fitness & Health',
  'Travel',
  'Reading',
  'Startups',
  'Open Source',
  'Robotics',
  'Cybersecurity',
  'Coffee',
];

export function calculateAge(dobString?: string | null): number | null {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function formatBirthday(
  dobString?: string | null,
  displayPreference: BirthdayDisplay = 'month_day'
): string | null {
  if (!dobString || displayPreference === 'hidden') return null;

  // Handle YYYY-MM-DD safely without timezone shifts
  const parts = dobString.split('T')[0].split('-');
  if (parts.length < 3) return null;

  const year = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const dateObj = new Date(year, monthIndex, day);
  if (isNaN(dateObj.getTime())) return null;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[monthIndex] || '';

  if (displayPreference === 'full') {
    return `Born ${monthName} ${day}, ${year}`;
  }

  if (displayPreference === 'month_day') {
    return `Born ${monthName} ${day}`;
  }

  if (displayPreference === 'age') {
    const age = calculateAge(dobString);
    return age !== null ? `${age} years old` : null;
  }

  return null;
}

export function canViewField(
  visibility: BirthdayVisibility | GenderVisibility | 'public' | 'followers' | 'only_me' | null | undefined,
  isSelf: boolean,
  isFollowed: boolean
): boolean {
  if (isSelf) return true;
  if (!visibility || visibility === 'only_me') return false;
  if (visibility === 'followers') return isFollowed;
  if (visibility === 'public') return true;
  return false;
}

export function formatGender(
  gender?: GenderOption | string | null,
  customGender?: string | null
): string | null {
  if (!gender || gender === 'prefer_not_to_say') return null;
  if (gender === 'male') return 'Male';
  if (gender === 'female') return 'Female';
  if (gender === 'non_binary') return 'Non-binary';
  if (gender === 'custom') return customGender?.trim() || 'Custom';
  return gender;
}

export function sanitizeWebsiteUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

export function formatWebsiteDisplay(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  url = url.replace(/^https?:\/\//i, '');
  url = url.replace(/^www\./i, '');
  url = url.replace(/\/+$/, '');
  return url;
}
