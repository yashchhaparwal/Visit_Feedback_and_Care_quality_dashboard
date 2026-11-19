/* Small inline icon set (no icon library needed). All decorative unless given a title. */
const Svg = ({ children, size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const HeartIcon = (p) => (
  <Svg {...p}><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" fill="currentColor" stroke="none" /></Svg>
);
export const StarIcon = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M12 2.8l2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3L2.84 9.45l6.33-.92z" />
  </svg>
);
export const ChartIcon = (p) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;
export const ListIcon = (p) => <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>;
export const LinkIcon = (p) => <Svg {...p}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></Svg>;
export const MailIcon = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>;
export const AlertIcon = (p) => <Svg {...p}><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Svg>;
export const CheckIcon = (p) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
export const ClockIcon = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const EyeOffIcon = (p) => <Svg {...p}><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-10-8-10-8a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.16 3.19M1 1l22 22" /></Svg>;
export const DownloadIcon = (p) => <Svg {...p}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></Svg>;
export const PhoneIcon = (p) => <Svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></Svg>;
export const CopyIcon = (p) => <Svg {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>;
export const ArrowUp = (p) => <Svg size={12} strokeWidth="2.5" {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Svg>;
export const ArrowDown = (p) => <Svg size={12} strokeWidth="2.5" {...p}><path d="M12 5v14M19 12l-7 7-7-7" /></Svg>;
