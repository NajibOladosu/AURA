import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Phone, Loader2, MapPin, ChevronDown, X } from 'lucide-react';
import {
  resolveEmergencyNumbers,
  getCachedEmergencyNumbers,
  COUNTRY_LIST,
  EMERGENCY_FALLBACK,
  type EmergencyNumberInfo,
} from '../lib/emergencyNumbers';

interface EmergencyCallPanelProps {
  riskLevel: string;
  riskScore: number;
  existingLocation: { lat: number; lng: number } | null;
}

function getPanelStyle(riskLevel: string) {
  if (riskLevel === 'Emergency') {
    return {
      bg: 'bg-gradient-to-br from-red-600 to-red-800',
      shadow: 'shadow-2xl shadow-red-500/30',
      accent: 'bg-white/20 hover:bg-white/30',
      ambulanceBg: 'bg-white text-red-700 hover:bg-white/90',
    };
  }
  if (riskLevel === 'Urgent') {
    return {
      bg: 'bg-gradient-to-br from-orange-600 to-amber-800',
      shadow: 'shadow-2xl shadow-orange-500/30',
      accent: 'bg-white/20 hover:bg-white/30',
      ambulanceBg: 'bg-white text-orange-700 hover:bg-white/90',
    };
  }
  return {
    bg: 'bg-gradient-to-br from-blue-600 to-indigo-800',
    shadow: 'shadow-2xl shadow-blue-500/30',
    accent: 'bg-white/20 hover:bg-white/30',
    ambulanceBg: 'bg-white text-blue-700 hover:bg-white/90',
  };
}

export default function EmergencyCallPanel({ riskLevel, existingLocation }: EmergencyCallPanelProps) {
  const [numbers, setNumbers] = useState<EmergencyNumberInfo | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const hasResolved = useRef(false);

  const style = getPanelStyle(riskLevel);

  useEffect(() => {
    if (hasResolved.current) return;
    hasResolved.current = true;

    async function detectLocation() {
      setIsResolving(true);

      // 1. Try GPS + Nominatim reverse geocode
      if (existingLocation) {
        try {
          const { lat, lng } = existingLocation;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (res.ok) {
            const data = await res.json();
            const countryCode = data?.address?.country_code?.toUpperCase() ?? null;
            const region = data?.address?.state ?? data?.address?.region ?? null;
            if (countryCode) {
              setDetectedCountry(countryCode);
              setNumbers(resolveEmergencyNumbers(countryCode, region));
              setIsResolving(false);
              return;
            }
          }
        } catch {
          // fall through to IP
        }
      }

      // 2. IP geolocation fallback
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          const countryCode = (data?.country_code as string | undefined)?.toUpperCase() ?? null;
          const region = (data?.region as string | undefined) ?? null;
          if (countryCode) {
            setDetectedCountry(countryCode);
            setNumbers(resolveEmergencyNumbers(countryCode, region));
            setIsResolving(false);
            return;
          }
        }
      } catch {
        // fall through to cache
      }

      // 3. localStorage cache
      const cached = getCachedEmergencyNumbers();
      if (cached) {
        setNumbers(cached);
        setIsResolving(false);
        return;
      }

      // 4. Ultimate fallback: 112
      setNumbers(EMERGENCY_FALLBACK);
      setIsResolving(false);
    }

    detectLocation();
  }, [existingLocation]);

  function handleManualCountrySelect(code: string) {
    setDetectedCountry(code);
    setNumbers(resolveEmergencyNumbers(code));
    setShowSelector(false);
    setCountrySearch('');
  }

  const filteredCountries = COUNTRY_LIST.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`${style.bg} ${style.shadow} text-white rounded-2xl p-6 space-y-5`}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-white/20 rounded-full animate-pulse flex-shrink-0">
          <AlertTriangle size={28} />
        </div>
        <div>
          <h3 className="text-xl font-bold uppercase tracking-wide">Emergency Alert</h3>
          <p className="opacity-80 text-sm">Immediate medical attention is required.</p>
        </div>
      </div>

      {/* Call buttons */}
      {isResolving ? (
        <div className="flex items-center gap-3 opacity-70 py-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Detecting your location for emergency numbers…</span>
        </div>
      ) : numbers ? (
        <div className="space-y-3">
          {/* Primary — Ambulance */}
          <a
            href={`tel:${numbers.ambulance}`}
            className={`flex items-center justify-center gap-3 w-full py-4 rounded-xl font-bold text-lg transition-colors ${style.ambulanceBg}`}
          >
            <Phone size={22} />
            Call Ambulance ({numbers.ambulance})
          </a>

          {/* Secondary — Police + Fire */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`tel:${numbers.police}`}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${style.accent} text-white`}
            >
              <Phone size={16} />
              Police ({numbers.police})
            </a>
            <a
              href={`tel:${numbers.fire}`}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${style.accent} text-white`}
            >
              <Phone size={16} />
              Fire ({numbers.fire})
            </a>
          </div>

          {numbers.notes && (
            <p className="text-xs opacity-60 text-center">{numbers.notes}</p>
          )}
        </div>
      ) : null}

      {/* Location indicator + change link */}
      <div className="flex items-center justify-between pt-1 border-t border-white/10">
        <div className="flex items-center gap-1.5 text-xs opacity-60">
          <MapPin size={12} />
          <span>
            {detectedCountry
              ? `Numbers for ${COUNTRY_LIST.find(c => c.code === detectedCountry)?.name ?? detectedCountry}`
              : 'International fallback (112)'}
          </span>
        </div>
        <button
          onClick={() => setShowSelector(prev => !prev)}
          className="text-xs opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1 underline underline-offset-2"
        >
          Wrong location?
          <ChevronDown size={12} className={`transition-transform ${showSelector ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Country selector dropdown */}
      <AnimatePresence>
        {showSelector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-black/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search country…"
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  className="flex-1 bg-white/10 text-white placeholder-white/40 text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-white/30"
                  autoFocus
                />
                {countrySearch && (
                  <button onClick={() => setCountrySearch('')} className="opacity-60 hover:opacity-100">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredCountries.slice(0, 80).map(c => (
                  <button
                    key={c.code}
                    onClick={() => handleManualCountrySelect(c.code)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/20 ${
                      detectedCountry === c.code ? 'bg-white/20 font-semibold' : ''
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {filteredCountries.length === 0 && (
                  <p className="text-xs opacity-50 text-center py-2">No results</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
