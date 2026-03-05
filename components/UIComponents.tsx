import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Moon, Sun, Star, ExternalLink, Loader2, ArrowRight, User, Sparkles, TrendingUp, AlertTriangle, Share2, Clipboard, BookOpen } from 'lucide-react';
import { Place, ChatMessage, Citation } from '../lib/types';

// --- Utils ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', loading, children, ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-black/5 dark:shadow-white/5",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      glass: "glass-panel text-foreground hover:bg-white/5",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg",
    };

    const sizes = {
      default: "h-12 px-6 py-2",
      sm: "h-9 rounded-lg px-3",
      lg: "h-16 rounded-2xl px-8 text-lg",
      icon: "h-10 w-10",
    };

    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";

export const BentoCard = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div"> & { children?: React.ReactNode }>(
  ({ className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 shadow-sm transition-all duration-500 hover:shadow-md hover:border-border/80 group",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      {props.children}
    </motion.div>
  )
);
BentoCard.displayName = "BentoCard";

export const Badge = ({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "neutral" | "outline" | "red" | "amber" | "emerald" }) => {
  const variants = {
    default: "bg-primary text-primary-foreground",
    neutral: "bg-secondary text-secondary-foreground",
    outline: "border border-border text-foreground",
    red: "bg-red-500/10 text-red-600 border border-red-500/20",
    amber: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  };

  return (
    <div className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-mono tracking-wide transition-colors",
      variants[variant],
      className
    )} {...props} />
  );
};

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-12 w-full rounded-xl border border-border/50 bg-background/50 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 hover:bg-accent/50 focus:bg-background",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const MinimalTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-2xl border-none bg-transparent px-0 py-4 text-xl md:text-2xl font-light leading-relaxed placeholder:text-muted-foreground/50 focus-visible:outline-none resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
MinimalTextarea.displayName = "MinimalTextarea";

export const PlaceRow: React.FC<{ place: Place; index: number }> = ({ place, index }) => {
  // Construct a more reliable Maps URL. 
  // If the API returns a 'googleMapsUri' that looks valid, use it.
  // Otherwise, construct a search query using the Name and Address (if available) for precision.
  const searchQuery = place.address 
    ? `${place.name}, ${place.address}` 
    : place.name;
    
  const mapLink = (place.googleMapsUri && place.googleMapsUri.startsWith('http'))
    ? place.googleMapsUri
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;

  return (
    <motion.a 
      href={mapLink}
      target="_blank" 
      rel="noopener noreferrer"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-center justify-between p-4 rounded-2xl hover:bg-secondary/50 border border-transparent hover:border-border/50 transition-all group cursor-pointer"
    >
      <div className="flex flex-col gap-1">
        <span className="font-medium text-foreground">{place.name}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {place.rating && (
            <span className="flex items-center gap-1 bg-secondary px-1.5 py-0.5 rounded-md">
              <Star size={10} className="fill-foreground text-foreground" />
              {place.rating}
            </span>
          )}
          <span>Medical Facility</span>
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight size={14} />
      </div>
    </motion.a>
  );
};

export const CitationRow: React.FC<{ citation: Citation }> = ({ citation }) => (
  <motion.div 
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card/50 border border-border/40 rounded-xl p-3 text-xs"
  >
    <div className="flex items-center justify-between mb-2">
      <span className="font-bold text-primary flex items-center gap-1">
        <BookOpen size={10} /> {citation.source}
      </span>
      <span className="font-mono opacity-50 bg-secondary px-1.5 rounded">{citation.protocolId}</span>
    </div>
    <p className="text-muted-foreground leading-relaxed">{citation.summary}</p>
  </motion.div>
);

export const ThemeToggle = ({ isDark, toggle }: { isDark: boolean, toggle: () => void }) => (
  <button
    onClick={toggle}
    className="relative w-12 h-6 rounded-full bg-secondary border border-border transition-colors focus:outline-none"
    aria-label="Toggle Theme"
  >
    <motion.div
      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background shadow-sm flex items-center justify-center border border-border/10"
      animate={{ x: isDark ? 24 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {isDark ? <Moon size={10} /> : <Sun size={10} />}
    </motion.div>
  </button>
);

export const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}
    >
      <div className={cn(
        "max-w-[85%] rounded-2xl p-4 flex gap-3",
        isUser ? "bg-secondary text-secondary-foreground rounded-tr-sm" : "bg-card border border-border/50 text-foreground rounded-tl-sm shadow-sm"
      )}>
        <div className={cn(
          "shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
          isUser ? "bg-primary/10 text-primary" : "bg-primary text-primary-foreground"
        )}>
          {isUser ? <User size={12} /> : <Sparkles size={12} />}
        </div>
        <div className="flex flex-col gap-2 overflow-hidden">
           <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</div>
           {message.image && (
             <div className="rounded-lg overflow-hidden mt-1 border border-border/20">
               <img src={message.image} alt="Attachment" className="max-w-full h-auto" />
             </div>
           )}
           <div className="text-[10px] opacity-40 font-mono mt-1">
             {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
           </div>
        </div>
      </div>
    </motion.div>
  );
};

export const TypingIndicator: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full mb-4 justify-start"
    >
      <div className="bg-card border border-border/50 rounded-2xl p-4 flex gap-3 rounded-tl-sm shadow-sm items-center">
         <div className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
             <Sparkles size={12} />
         </div>
         <div className="flex gap-1 h-4 items-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full"
                animate={{ y: [0, -5, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
         </div>
      </div>
    </motion.div>
  );
};

export const StatsCard: React.FC<{ label: string; value: string; icon: any; trend?: string }> = ({ label, value, icon: Icon, trend }) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className="bg-card border border-border/40 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-secondary rounded-xl text-foreground">
        <Icon size={18} />
      </div>
      {trend && (
        <Badge variant={trend.includes('+') ? 'emerald' : 'neutral'}>
          {trend}
        </Badge>
      )}
    </div>
    <div>
      <div className="text-2xl font-bold mb-1 font-display">{value}</div>
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide opacity-60">{label}</div>
    </div>
  </motion.div>
);

export const SuggestionChip: React.FC<{ text: string; onClick: () => void }> = ({ text, onClick }) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="flex-shrink-0 bg-secondary/50 hover:bg-secondary text-xs text-secondary-foreground/80 hover:text-secondary-foreground border border-border/50 rounded-full px-3 py-1.5 transition-colors text-left"
  >
    {text}
  </motion.button>
);