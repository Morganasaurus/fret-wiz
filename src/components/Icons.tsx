/** Small line icons in the spirit of SF Symbols. They inherit the text colour. */

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const SidebarIcon = () => (
  <svg {...base}>
    <rect x="3" y="4.5" width="18" height="15" rx="3" />
    <path d="M9.5 4.5v15" />
    <path d="M5.5 8h1.8M5.5 11h1.8" />
  </svg>
);

export const KeysIcon = () => (
  <svg {...base}>
    <path d="M9 18V5.5l11-2v12.5" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </svg>
);

export const ChordsIcon = () => (
  <svg {...base}>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <path d="M5 9h14M5 15h14M9.7 3v18M14.3 3v18" />
  </svg>
);

export const ScalesIcon = () => (
  <svg {...base}>
    <path d="M3 19h4v-4h4v-4h4V7h6" />
  </svg>
);

export const NotesIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </svg>
);

export const GearIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" />
    <circle cx="12" cy="12" r="7" />
  </svg>
);

export const SpeakerIcon = ({ on }: { on: boolean }) => (
  <svg {...base}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
    {on ? (
      <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
    ) : (
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    )}
  </svg>
);

export const CloseIcon = () => (
  <svg {...base} width={18} height={18}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
