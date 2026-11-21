/** Brand glyphs (lucide v1 ships no brand icons). Simple, recognisable shapes. */
type IconProps = { className?: string };

export function TelegramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M21.94 4.3a1 1 0 0 0-1.35-1.1L2.86 10.02a1 1 0 0 0 .06 1.88l4.35 1.4 1.66 5.3a1 1 0 0 0 1.66.42l2.47-2.38 4.33 3.2a1 1 0 0 0 1.57-.58l3-14.96ZM9.7 13.6l7.53-5.68-6.03 6.73-.24 2.86-1.26-3.91Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.2.4-2.5.4-3.8s-.1-2.6-.4-3.8ZM10 15.2V8.8l5.2 3.2-5.2 3.2Z" />
    </svg>
  );
}
