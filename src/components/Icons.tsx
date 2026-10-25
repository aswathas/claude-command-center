import type { ReactElement } from 'react';

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const paths: Record<string, ReactElement> = {
    overview: (
      <>
        <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
        <rect x="10.5" y="2.5" width="5" height="5" rx="1" />
        <rect x="2.5" y="10.5" width="5" height="5" rx="1" />
        <rect x="10.5" y="10.5" width="5" height="5" rx="1" />
      </>
    ),
    skills: (
      <>
        <path d="M3 4.5h7.5L13 7v8.5H3z" />
        <path d="M10.5 4.5V7H13" />
        <path d="M5.5 10h5M5.5 12.5h3" />
      </>
    ),
    plugins: (
      <>
        <path d="M8 1.8v4.4M4.4 4.2h7.2" />
        <path d="M4.2 6.2v1.3a3.6 3.6 0 0 0 7.6 0V6.2" />
        <rect x="2.6" y="6.2" width="3" height="7.4" rx="1.2" />
        <rect x="10.4" y="6.2" width="3" height="7.4" rx="1.2" />
      </>
    ),
    mcp: (
      <>
        <rect x="4" y="4" width="8" height="8" rx="2" />
        <path d="M8 1.6v2.4M8 12v2.4M1.6 8h2.4M12 8h2.4" />
      </>
    ),
    settings: (
      <>
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 1.8v1.8M8 12.4v1.8M14.2 8h-1.8M3.6 8H1.8M12.4 3.6l-1.3 1.3M4.9 11.1l-1.3 1.3M12.4 12.4l-1.3-1.3M4.9 4.9 3.6 3.6" />
      </>
    ),
    memory: (
      <>
        <path d="M5.5 3.5a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3v-3a3 3 0 0 0-3-3z" />
        <path d="M6.5 6.5h3M6.5 9.5h3" />
      </>
    ),
    search: (
      <>
        <circle cx="7" cy="7" r="4.2" />
        <path d="M10.2 10.2 13.6 13.6" />
      </>
    ),
    refresh: (
      <>
        <path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8" />
        <path d="M13.6 2.4v3.2h-3.2" />
      </>
    ),
    sun: (
      <>
        <circle cx="8" cy="8" r="3.1" />
        <path d="M8 1.4v1.8M8 12.8v1.8M14.6 8h-1.8M3.2 8H1.4M12.7 3.3l-1.3 1.3M4.6 11.4l-1.3 1.3M12.7 12.7l-1.3-1.3M4.6 4.6 3.3 3.3" />
      </>
    ),
    moon: <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.8 5.8 0 1 0 6.8 6.8z" />,
  };
  return (
    <svg
      className="navitem__icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.overview}
    </svg>
  );
}
