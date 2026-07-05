import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { Moon, Sun, Star, ArrowUpRight, Loader2 } from 'lucide-react';
import { Place, ChatMessage, Citation } from '../lib/types';

// --- Utils ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Magnetic hover (soft app signature interaction) ---
// Attach to onMouseMove/onMouseLeave of a button to give it a subtle pull.
export const magnetMove = (e: React.MouseEvent<HTMLElement>) => {
  const t = e.currentTarget;
  const r = t.getBoundingClientRect();
  const x = (e.clientX - r.left - r.width / 2) * 0.15;
  const y = (e.clientY - r.top - r.height / 2) * 0.15;
  t.style.transition = 'transform 0.08s linear, background-color 0.25s, color 0.25s';
  t.style.transform = `translate(${x}px, ${y}px)`;
};
export const magnetLeave = (e: React.MouseEvent<HTMLElement>) => {
  const t = e.currentTarget;
  t.style.transition = 'transform 0.45s cubic-bezier(0.22,1,0.36,1), background-color 0.25s, color 0.25s';
  t.style.transform = 'translate(0, 0)';
};

// Severity → soft palette. Each level maps to a hue used for the text accent,
// a soft tint background (badges/score chips), and a solid bar/rule.
export type RiskLevel = 'Emergency' | 'Urgent' | 'Consult' | 'Self-Care';

export const riskStyle = (level: string) => {
  switch (level) {
    case 'Emergency':
      return { hex: '#DC2626', tint: 'rgba(220,38,38,0.12)', code: 'EMG' };
    case 'Urgent':
      return { hex: '#D97706', tint: 'rgba(217,119,6,0.12)', code: 'URG' };
    case 'Self-Care':
      return { hex: '#0E7569', tint: 'rgba(14,117,105,0.12)', code: 'SLF' };
    default: // Consult
      return { hex: '#B45309', tint: 'rgba(180,83,9,0.12)', code: 'CON' };
  }
};

// --- Buttons: teal pill, dark-ink hover, soft glow on primary ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  magnetic?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', loading, magnetic, children, onMouseMove, onMouseLeave, ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-primary-foreground hover:bg-ink hover:text-ink-foreground shadow-teal",
      outline: "bg-foreground/[0.05] text-foreground hover:bg-ink hover:text-ink-foreground",
      ghost: "bg-transparent text-muted-foreground hover:text-foreground",
      destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
    };
    const sizes = {
      default: "h-12 px-6 text-sm",
      sm: "h-10 px-4 text-[13px]",
      lg: "h-[52px] px-8 text-[15px]",
      icon: "h-12 w-12",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-colors will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={loading || props.disabled}
        onMouseMove={magnetic ? (e) => { magnetMove(e); onMouseMove?.(e); } : onMouseMove}
        onMouseLeave={magnetic ? (e) => { magnetLeave(e); onMouseLeave?.(e); } : onMouseLeave}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// --- Card: white, generously rounded, soft shadow, hairline border ---
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-card border border-foreground/[0.07] rounded-xl shadow-soft p-6 md:p-7",
        interactive && "transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-soft-lg",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

// --- Dark "ink" panel: consultant, trust strip, profile ID card ---
export const InkPanel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("bg-ink text-ink-foreground rounded-2xl overflow-hidden", className)}
      {...props}
    />
  )
);
InkPanel.displayName = "InkPanel";

// --- Severity tag: soft tinted pill, colored text ---
export const SeverityTag: React.FC<{ level: string; className?: string }> = ({ level, className }) => {
  const s = riskStyle(level);
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-bold leading-none", className)}
      style={{ background: s.tint, color: s.hex }}
    >
      {level}
    </span>
  );
};

// Back-compat shim for older call sites
export const riskBadgeVariant = (level: string): string => level;

// --- Badge: neutral soft pill (used for profile chips, tags) ---
export const Badge = ({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("inline-flex items-center rounded-full bg-foreground/[0.05] px-3 py-1.5 text-xs font-semibold leading-none", className)} {...props}>
    {children}
  </span>
);

// --- Section header: teal eyebrow label + hairline rule ---
export const SectionHead: React.FC<{ index?: string; title: string; right?: React.ReactNode; className?: string }> = ({ index, title, right, className }) => (
  <div className={cn("flex items-end justify-between gap-3 mb-4", className)}>
    <div className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-accent">
      {index && <span className="mr-2 opacity-60">{index}</span>}
      {title}
    </div>
    {right}
  </div>
);

// --- Stepper: Describe → Analyze → Results ---
export const Stepper: React.FC<{ active: number; className?: string }> = ({ active, className }) => {
  const labels = ['Describe', 'Analyze', 'Results'];
  return (
    <div className={cn("flex gap-2", className)}>
      {labels.map((label, i) => {
        const state = i === active ? 'active' : i < active ? 'done' : 'todo';
        return (
          <div
            key={label}
            className={cn(
              "flex-1 min-w-0 rounded-md px-2 py-2.5 flex items-center justify-center gap-2",
              state === 'active' && "bg-ink text-ink-foreground",
              state === 'done' && "bg-primary text-primary-foreground",
              state === 'todo' && "bg-foreground/[0.06] text-muted-foreground"
            )}
          >
            <span className="text-[13px] font-extrabold">{i + 1}</span>
            <span className="text-[12.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
          </div>
        );
      })}
    </div>
  );
};

// --- Inputs ---
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-md border border-foreground/[0.12] bg-background px-4 text-sm text-foreground placeholder:text-foreground/35 outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const MinimalTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[130px] w-full border-none bg-transparent p-0 text-lg md:text-xl leading-relaxed text-foreground placeholder:text-foreground/35 outline-none resize-none",
        className
      )}
      {...props}
    />
  )
);
MinimalTextarea.displayName = "MinimalTextarea";

// --- Risk meter: single soft sweep bar in the severity color ---
export const RiskMeter: React.FC<{ score: number; level: string; showLabel?: boolean }> = ({ score, level, showLabel = true }) => {
  const s = riskStyle(level);
  return (
    <div className="w-full">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]" role="img" aria-label={`Risk score ${score} of 10`}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${score * 10}%`, background: s.hex, animation: 'sweep 1.2s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </div>
      {showLabel && (
        <div className="mt-2 flex justify-between text-[11px] font-bold text-muted-foreground/70">
          <span>MILD</span><span>URGENT</span>
        </div>
      )}
    </div>
  );
};

// --- Place row: soft, indents on hover, teal chevron ---
export const PlaceRow: React.FC<{ place: Place; index: number }> = ({ place }) => {
  const searchQuery = place.address ? `${place.name}, ${place.address}` : place.name;
  const mapLink = (place.googleMapsUri && place.googleMapsUri.startsWith('http'))
    ? place.googleMapsUri
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  return (
    <a
      href={mapLink}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-3 border-b border-foreground/[0.07] py-3.5 transition-[padding] last:border-b-0 hover:pl-1.5"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-foreground">{place.name}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
          {place.rating && (
            <span className="flex items-center gap-1"><Star size={11} className="fill-current" />{place.rating}</span>
          )}
          {place.address && <span className="truncate">· {place.address}</span>}
        </div>
      </div>
      <ArrowUpRight size={16} className="shrink-0 text-accent opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
};

export const CitationRow: React.FC<{ citation: Citation }> = ({ citation }) => (
  <div className="rounded-lg border border-foreground/[0.07] bg-foreground/[0.02] p-3.5 text-xs">
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="truncate font-bold text-foreground">{citation.source}</span>
      <span className="shrink-0 font-mono text-muted-foreground">{citation.protocolId}</span>
    </div>
    <p className="leading-relaxed text-muted-foreground">{citation.summary}</p>
  </div>
);

export const ThemeToggle = ({ isDark, toggle }: { isDark: boolean, toggle: () => void }) => (
  <button
    onClick={toggle}
    className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/[0.12] hover:text-accent"
    aria-label="Toggle theme"
  >
    {isDark ? <Moon size={16} /> : <Sun size={16} />}
  </button>
);

// --- Chat bubbles: soft rounded, right-aligned user / left-aligned AURA.
// Rendered inside the dark InkPanel consultant, so colors invert. ---
export const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-background text-foreground rounded-2xl rounded-tr-md"
            : "bg-ink-foreground/[0.08] text-ink-foreground rounded-2xl rounded-tl-md"
        )}
      >
        <span className="whitespace-pre-wrap">{message.text}</span>
        {message.image && (
          <div className="mt-2 overflow-hidden rounded-lg">
            <img src={message.image} alt="Attachment" className="max-h-48 w-auto max-w-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export const TypingIndicator: React.FC = () => (
  <div className="flex justify-start">
    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-ink-foreground/[0.08] px-4 py-3.5">
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink-foreground/70"
          style={{ animation: `bounceDot 0.6s ease-in-out ${delay}s infinite` }}
        />
      ))}
    </div>
  </div>
);

// --- Stat block: soft card, big numeral ---
export const StatsCard: React.FC<{ label: string; value: string; sub?: string; subColor?: string; icon?: any }> = ({ label, value, sub, subColor }) => (
  <div className="flex flex-col gap-2 rounded-xl border border-foreground/[0.07] bg-card p-6 shadow-soft transition-transform duration-200 hover:-translate-y-0.5">
    <span className="text-[13.5px] font-semibold text-muted-foreground">{label}</span>
    <span className="text-4xl font-extrabold leading-none tracking-tight tabular-nums">{value}</span>
    {sub && <span className="text-xs font-bold" style={subColor ? { color: subColor } : undefined}>{sub}</span>}
  </div>
);

// --- Suggestion chip: soft pill, teal-tinted hover ---
export const SuggestionChip: React.FC<{ text: string; onClick: () => void; dot?: string; dark?: boolean }> = ({ text, onClick, dot, dark }) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors",
      dark
        ? "border border-ink-foreground/15 bg-ink-foreground/[0.08] text-ink-foreground/85 hover:bg-ink-foreground hover:text-ink"
        : "border border-foreground/[0.12] bg-card text-foreground hover:border-primary hover:bg-accent/[0.06]"
    )}
  >
    {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
    {text}
  </button>
);
