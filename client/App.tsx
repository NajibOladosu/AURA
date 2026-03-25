import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { TriageResult, AgentState, Place, ChatMessage, HistorySession, UserProfile, User } from './lib/types';
import {
  Button,
  BentoCard,
  Badge,
  PlaceRow,
  ThemeToggle,
  MinimalTextarea,
  ChatBubble,
  TypingIndicator,
  Input,
  StatsCard,
  SuggestionChip,
  CitationRow,
  cn
} from './components/UIComponents';
import {
  Activity,
  Camera,
  Mic,
  ArrowRight,
  ScanLine,
  ChevronRight,
  Sparkles,
  Map,
  ShieldCheck,
  Zap,
  RotateCcw,
  Loader2,
  Send,
  Plus,
  X,
  History as HistoryIcon,
  Trash2,
  Calendar,
  Clock,
  User as UserIcon,
  AlertCircle,
  AlertTriangle,
  Pill,
  FileText,
  LogOut,
  LogIn,
  Fingerprint,
  TrendingUp,
  Share2,
  Clipboard,
  Phone,
  Settings,
  Mail,
  Hash,
  Lock,
  Eye,
  EyeOff,
  BookOpen,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Crypto Utils for HIPAA-Compliant Auth Simulation ---
// Replaced by Backend JWT Authentication

// --- Compression Util ---
const compressImage = (base64Str: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

const App = () => {
  // Views
  const [view, setView] = useState<'auth' | 'welcome' | 'input' | 'processing' | 'result' | 'history' | 'profile' | 'settings' | 'migrate'>('auth');

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App State
  const [symptoms, setSymptoms] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>(''); // For UI display if manual
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // History & Session State
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Patient Profile State
  const [userProfile, setUserProfile] = useState<UserProfile>({
    allergies: [],
    conditions: [],
    medications: []
  });
  // Profile Input States
  const [inputAllergy, setInputAllergy] = useState('');
  const [inputCondition, setInputCondition] = useState('');
  const [inputMedication, setInputMedication] = useState('');

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);

  // Migration State (guest → authenticated)
  const [pendingMigration, setPendingMigration] = useState<{ sessions: HistorySession[], profile: UserProfile } | null>(null);
  const [selectedMigrationIds, setSelectedMigrationIds] = useState<Set<string>>(new Set());
  const [migrateProfile, setMigrateProfile] = useState(true);
  const [migrationLoading, setMigrationLoading] = useState(false);

  // Agents State
  const [agents, setAgents] = useState<AgentState[]>([
    { name: 'PII Scrubbing Layer', status: 'idle', message: 'Sanitizing input...' },
    { name: 'Safety Guidelines', status: 'idle', message: 'Matching safety protocols...' },
    { name: 'Clinical Reasoning', status: 'idle', message: 'Analyzing data...' },
    { name: 'Geospatial Grid', status: 'idle', message: 'Location locked.' }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // --- Initialization & Effects ---

  useEffect(() => {
    // Theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (!localStorage.getItem('theme')) {
        const dark = mediaQuery.matches;
        setIsDark(dark);
        document.documentElement.classList.toggle('dark', dark);
      }
    };

    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && mediaQuery.matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
    mediaQuery.addEventListener('change', handleChange);

    // Initial Geolocation
    refreshLocation();

    // Check for existing session
    const savedToken = localStorage.getItem('aura_token');
    if (savedToken) {
      loadUserData(savedToken);
    } else {
      // Load guest data from localStorage
      setUserProfile(loadGuestProfile());
      setSessions(loadGuestSessions());
    }
    setView('welcome'); // Always start on welcome — no auth gate

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Favicon switcher based on system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateFavicon = (e: MediaQueryListEvent | MediaQueryList) => {
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (link) {
        // Light icon for Dark system theme, Dark icon for Light system theme
        link.href = e.matches ? '/favicon-light.png' : '/favicon.png';
      }
    };

    updateFavicon(mediaQuery);
    mediaQuery.addEventListener('change', updateFavicon);
    return () => mediaQuery.removeEventListener('change', updateFavicon);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (view === 'result') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, view, isChatLoading]);

  // Refetch data when entering dynamic views to ensure UI matches database
  useEffect(() => {
    if (view === 'history' || view === 'profile' || view === 'welcome') {
      const token = localStorage.getItem('aura_token');
      if (token) {
        // Authenticated: refresh from server
        const silentRefresh = async () => {
          try {
            const profileRes = await fetch('/api/profile', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              setUserProfile({
                allergies: profileData.allergies || [],
                conditions: profileData.conditions || [],
                medications: profileData.medications || []
              });
            }

            const historyRes = await fetch('/api/history', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (historyRes.ok) {
              const historyData = await historyRes.json();
              const mappedHistory = historyData.map((session: any) => ({
                ...session,
                id: session._id
              }));
              setSessions(mappedHistory);
            }
          } catch (error) {
            console.error("Silent refresh failed:", error);
          }
        };
        silentRefresh();
      } else {
        // Guest: refresh from localStorage
        setUserProfile(loadGuestProfile());
        setSessions(loadGuestSessions());
      }
    }
  }, [view]);

  // --- Logic ---

  const refreshLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });

          try {
            const token = localStorage.getItem('aura_token');
            const res = await fetch('/api/ai/reverse-geocode', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
              },
              body: JSON.stringify({ lat, lng })
            });
            if (res.ok) {
              const contentType = res.headers.get("content-type");
              if (contentType && contentType.includes("application/json")) {
                const data = await res.json();
                setLocationName(data.name || "GPS Detected");
              } else {
                setLocationName("GPS Detected");
              }
            } else {
              setLocationName("GPS Detected");
            }
          } catch (e) {
            setLocationName("GPS Detected");
          }
          setIsLocating(false);
        },
        (err) => {
          console.log("Location denied", err);
          setIsLocating(false);
        }
      );
    } else {
      setIsLocating(false);
    }
  };

  const handleManualLocation = async () => {
    if (!manualLocationInput.trim()) return;
    setIsLocating(true);
    try {
      const token = localStorage.getItem('aura_token');
      const res = await fetch('/api/ai/geocode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ locationName: manualLocationInput })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lat && data.lng) {
          setLocation({ lat: data.lat, lng: data.lng });
          setLocationName(data.address || manualLocationInput);
        }
      }
      setManualLocationInput('');
    } catch (e) {
      console.error(e);
      alert('Failed to set location.');
    } finally {
      setIsLocating(false);
    }
  };

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || (authMode === 'signup' && !authName)) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = authMode === 'login' ? { email: authEmail, password: authPassword } : { name: authName, email: authEmail, password: authPassword };

      const res = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Authentication failed');
      }

      if (authMode === 'login') {
        // Save JWT
        localStorage.setItem('aura_token', data.token);
        setCurrentUser(data.user);
        setAuthPassword('');
        setAuthError(null);

        // Check for guest data to migrate
        const guestSessions = loadGuestSessions();
        const guestProfile = loadGuestProfile();
        const hasGuestData = guestSessions.length > 0 || guestProfile.allergies.length > 0 || guestProfile.conditions.length > 0 || guestProfile.medications.length > 0;

        if (hasGuestData) {
          setPendingMigration({ sessions: guestSessions, profile: guestProfile });
          setSelectedMigrationIds(new Set(guestSessions.map(s => s.id)));
          setView('migrate');
        } else {
          loadUserData(data.token);
          setView('welcome');
        }
      } else {
        // Switch to login mode after successful registration
        setAuthMode('login');
        setAuthError('Registration successful! Please log in.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication.');
    } finally {
      setAuthLoading(false);
    }
  };

  const loginUser = (user: User) => {
    setCurrentUser(user);
    // Don't need to save session here, it's tracked by JWT
  };
  const logoutUser = () => {
    setCurrentUser(null);
    setSessions([]);
    setUserProfile({ allergies: [], conditions: [], medications: [] });
    setSessionId(null);
    setView('auth');
    localStorage.removeItem('aura_token');
    setAuthEmail('');
    setAuthName('');
    setAuthPassword('');
  };

  const loadUserData = async (token: string) => {
    try {
      // 1. Verify token and get User Details
      const authRes = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!authRes.ok) {
        // Token expired or invalid
        logoutUser();
        return;
      }

      const authData = await authRes.json();
      setCurrentUser(authData.user);

      // 2. Fetch Profile
      const profileRes = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setUserProfile({
          allergies: profileData.allergies || [],
          conditions: profileData.conditions || [],
          medications: profileData.medications || []
        });
      }

      // 3. Fetch History
      const historyRes = await fetch('/api/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (historyRes.ok) {
        const historyData = await historyRes.json();

        // Map _id back to id for frontend compatibility
        const mappedHistory = historyData.map((session: any) => ({
          ...session,
          id: session._id
        }));

        setSessions(mappedHistory);
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
      // Optional: keep as guest if silent failure, or logout if auth failure
    }
  };

  // --- Guest localStorage Helpers ---
  const GUEST_PROFILE_KEY = 'aura_guest_profile';
  const GUEST_SESSIONS_KEY = 'aura_guest_sessions';

  const loadGuestProfile = (): UserProfile => {
    try {
      const stored = localStorage.getItem(GUEST_PROFILE_KEY);
      return stored ? JSON.parse(stored) : { allergies: [], conditions: [], medications: [] };
    } catch { return { allergies: [], conditions: [], medications: [] }; }
  };

  const saveGuestProfile = (profile: UserProfile) => {
    localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
  };

  const loadGuestSessions = (): HistorySession[] => {
    try {
      const stored = localStorage.getItem(GUEST_SESSIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  };

  const saveGuestSessions = (updatedSessions: HistorySession[]) => {
    // Cap at 20 most recent to avoid localStorage bloat
    const capped = updatedSessions.slice(0, 20);
    localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(capped));
  };

  const saveProfileToStorage = async (profile: UserProfile) => {
    setUserProfile(profile);
    const token = localStorage.getItem('aura_token');
    if (token) {
      try {
        await fetch('/api/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(profile)
        });
      } catch (e) {
        console.error("Failed to save profile:", e);
      }
    } else {
      saveGuestProfile(profile);
    }
  };

  const addProfileItem = (type: keyof UserProfile, value: string) => {
    if (!value.trim()) return;
    const newProfile = { ...userProfile, [type]: [...userProfile[type], value.trim()] };
    saveProfileToStorage(newProfile);
    if (type === 'allergies') setInputAllergy('');
    if (type === 'conditions') setInputCondition('');
    if (type === 'medications') setInputMedication('');
  };

  const removeProfileItem = (type: keyof UserProfile, index: number) => {
    const newList = [...userProfile[type]];
    newList.splice(index, 1);
    const newProfile = { ...userProfile, [type]: newList };
    saveProfileToStorage(newProfile);
  };

  const createSession = async (triageResult: TriageResult, initialChat: ChatMessage[], places: Place[] = []) => {
    const token = localStorage.getItem('aura_token');

    if (token) {
      try {
        const res = await fetch('/api/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            result: triageResult,
            chatHistory: initialChat,
            nearbyPlaces: places
          })
        });

        if (res.ok) {
          const newSession = await res.json();
          const mappedSession = { ...newSession, id: newSession._id };
          setSessions([mappedSession, ...sessions]);
          setSessionId(mappedSession.id);
          return mappedSession.id;
        }
      } catch (e) {
        console.error("Failed to create session", e);
      }
      return '';
    } else {
      // Guest: store in localStorage
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const guestSession: HistorySession = {
        id: guestId,
        userId: 'guest',
        timestamp: Date.now(),
        result: triageResult,
        chatHistory: initialChat,
        nearbyPlaces: places
      };
      const updatedSessions = [guestSession, ...sessions];
      setSessions(updatedSessions);
      setSessionId(guestId);
      saveGuestSessions(updatedSessions);
      return guestId;
    }
  };

  const updateSessionChat = async (newChatHistory: ChatMessage[]) => {
    if (!sessionId) return;
    const token = localStorage.getItem('aura_token');

    const updated = sessions.map(s => s.id === sessionId ? { ...s, chatHistory: newChatHistory } : s);
    setSessions(updated);

    if (token) {
      try {
        await fetch(`/api/history/${sessionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ chatHistory: newChatHistory })
        });
      } catch (e) {
        console.error("Failed to update session chat", e);
      }
    } else {
      saveGuestSessions(updated);
    }
  };

  const updateSessionPlaces = async (id: string, places: Place[]) => {
    const token = localStorage.getItem('aura_token');

    const updated = sessions.map(s => s.id === id ? { ...s, nearbyPlaces: places } : s);
    setSessions(updated);

    if (token) {
      try {
        await fetch(`/api/history/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ nearbyPlaces: places })
        });
      } catch (e) {
        console.error("Failed to update session places", e);
      }
    } else {
      saveGuestSessions(updated);
    }
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    const token = localStorage.getItem('aura_token');
    if (token) {
      try {
        await fetch(`/api/history/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        console.error("Failed to delete session", e);
      }
    }

    const updatedSessions = sessions.filter(s => s.id !== id);
    setSessions(updatedSessions);
    if (!token) saveGuestSessions(updatedSessions);

    if (sessionId === id) {
      handleNewScan();
    }
  };

  const handleMigration = async (skip: boolean = false) => {
    const token = localStorage.getItem('aura_token');
    if (!token || !pendingMigration) {
      loadUserData(token || '');
      setView('welcome');
      setPendingMigration(null);
      return;
    }

    if (skip) {
      localStorage.removeItem('aura_guest_sessions');
      localStorage.removeItem('aura_guest_profile');
      setPendingMigration(null);
      loadUserData(token);
      setView('welcome');
      return;
    }

    setMigrationLoading(true);
    try {
      // Migrate selected sessions
      for (const session of pendingMigration.sessions) {
        if (selectedMigrationIds.has(session.id)) {
          await fetch('/api/history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              result: session.result,
              chatHistory: session.chatHistory,
              nearbyPlaces: session.nearbyPlaces
            })
          });
        }
      }

      // Migrate profile if selected
      if (migrateProfile) {
        const { profile } = pendingMigration;
        if (profile.allergies.length > 0 || profile.conditions.length > 0 || profile.medications.length > 0) {
          await fetch('/api/profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(profile)
          });
        }
      }

      // Clear guest data
      localStorage.removeItem('aura_guest_sessions');
      localStorage.removeItem('aura_guest_profile');
      setPendingMigration(null);
      loadUserData(token);
      setView('welcome');
    } catch (e) {
      console.error("Migration failed:", e);
    } finally {
      setMigrationLoading(false);
    }
  };

  const toggleMigrationSession = (id: string) => {
    setSelectedMigrationIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadSession = (session: HistorySession) => {
    setResult(session.result);
    setChatHistory(session.chatHistory);
    setNearbyPlaces(session.nearbyPlaces || []);
    setSessionId(session.id);
    setView('result');
  };

  const handleNewScan = () => {
    setResult(null);
    setChatHistory([]);
    setNearbyPlaces([]);
    setSessionId(null);
    setSymptoms('');
    setSelectedImage(null);
    setView('welcome');
    setAgents(prev => prev.map(a => ({ ...a, status: 'idle', message: 'Waiting...' })));
  };

  const handleShareReport = async () => {
    if (!result) return;

    try {
      const element = document.getElementById('triage-report-content');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: isDark ? '#000000' : '#ffffff',
        useCORS: true
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'aura-triage-report.png', { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'AURA Medical Assessment',
            text: `AURA Triage Report: ${result.conditionTitle} (${result.riskLevel})`,
            files: [file]
          });
          setShowCopyFeedback(true);
          setTimeout(() => setShowCopyFeedback(false), 2000);
        } else {
          // Fallback: download the image if sharing files isn't supported (e.g. desktop Chrome)
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'aura-triage-report.png';
          a.click();
          URL.revokeObjectURL(url);
          setShowCopyFeedback(true);
          setTimeout(() => setShowCopyFeedback(false), 2000);
        }
      }, 'image/png');
    } catch (e) {
      console.error('Failed to generate or share report image', e);
      // Fallback to text copy
      const reportText = `AURA Medical Assessment\n\nCondition: ${result.conditionTitle}\nRisk Level: ${result.riskLevel}\nSummary:\n${result.summary}`;
      navigator.clipboard.writeText(reportText);
      setShowCopyFeedback(true);
      setTimeout(() => setShowCopyFeedback(false), 2000);
    }
  };

  // --- Handlers ---

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        // Client-Side Compression to simulate ffmpeg.wasm / video reduction
        const compressedBase64 = await compressImage(rawBase64);
        setSelectedImage(compressedBase64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressedBase64 = await compressImage(rawBase64);
        setChatImage(compressedBase64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMicClick = () => {
    // ... (Existing logic)
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Voice input is not supported in this browser.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSymptoms(prev => prev ? `${prev} ${transcript} ` : transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const simulateAgents = async () => {
    const updateAgent = (index: number, status: 'working' | 'complete', message: string) => {
      setAgents(prev => prev.map((a, i) => i === index ? { ...a, status, message } : a));
    };

    // Agent 1: PII Scrubbing
    updateAgent(0, 'working', 'Scrubbing names/IDs...');
    await new Promise(r => setTimeout(r, 800));
    updateAgent(0, 'complete', 'Input Sanitized.');

    // Agent 2: Safety Guidelines
    updateAgent(1, 'working', 'Matching safety protocols...');
    await new Promise(r => setTimeout(r, 1000));
    updateAgent(1, 'complete', 'Guidelines applied.');

    // Agent 3: Clinical
    updateAgent(2, 'working', 'Analyzing symptoms...');
  };

  const fetchNearbyFacilities = async (triage: TriageResult): Promise<Place[]> => {
    if (!location) {
      setAgents(prev => prev.map((a, i) => i === 3 ? { ...a, status: 'complete', message: 'Location unavailable.' } : a));
      return [];
    }
    const facilityType = (triage.suggestedFacilities && triage.suggestedFacilities.length > 0)
      ? triage.suggestedFacilities[0]
      : "Medical Clinic";
    setAgents(prev => prev.map((a, i) => i === 3 ? { ...a, status: 'working', message: `Triangulating ${facilityType}...` } : a));
    setLoadingPlaces(true);
    try {
      const token = localStorage.getItem('aura_token');
      const res = await fetch('/api/ai/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token} ` })
        },
        body: JSON.stringify({ lat: location.lat, lng: location.lng, facilityType })
      });

      let places: Place[] = [];
      if (res.ok) {
        places = await res.json();
      }
      setNearbyPlaces(places);
      setAgents(prev => prev.map((a, i) => i === 3 ? { ...a, status: 'complete', message: `Found ${places.length} nodes.` } : a));
      return places;
    } catch (e) {
      console.error(e);
      setAgents(prev => prev.map((a, i) => i === 3 ? { ...a, status: 'complete', message: 'Geospatial error.' } : a));
      return [];
    } finally {
      setLoadingPlaces(false);
    }
  };

  const handleSubmit = async () => {
    if (!symptoms && !selectedImage) return;
    setView('processing');
    setChatHistory([]);
    setSessionId(null);
    simulateAgents();

    try {
      const base64Data = selectedImage ? selectedImage.split(',')[1] : undefined;
      const recentSessions = sessions.slice(0, 5);
      const historyContext = recentSessions.map(s =>
        `- Date: ${new Date(s.timestamp).toLocaleDateString()}, Condition: ${s.result.conditionTitle}, Risk: ${s.result.riskLevel} `
      ).join('\n');
      const token = localStorage.getItem('aura_token');

      const response = await fetch('/api/ai/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          symptoms: symptoms, // Use 'symptoms' here
          userProfile,
          historyContext,
          base64Image: base64Data || undefined,
          mimeType: selectedImage ? selectedImage.split(';')[0].split(':')[1] : undefined // Extract mimeType
        })
      });

      if (!response.ok) {
        throw new Error("Failed to process triage request");
      }

      const triage: TriageResult = await response.json();
      setResult(triage);

      if (triage.detectedProfileUpdates) {
        // ... (Existing logic for updates)
        const updates = triage.detectedProfileUpdates;
        const newProfile: UserProfile = {
          allergies: [...new Set([...userProfile.allergies, ...(updates.newAllergies || [])])],
          conditions: [...new Set([...userProfile.conditions, ...(updates.newConditions || [])])],
          medications: [...new Set([...userProfile.medications, ...(updates.newMedications || [])])]
        };
        if (updates.newAllergies?.length > 0 || updates.newConditions?.length > 0 || updates.newMedications?.length > 0) {
          saveProfileToStorage(newProfile);
        }
      }

      setAgents(prev => prev.map((a, i) => i < 3 ? { ...a, status: 'complete', message: 'Done.' } : a));

      const initialChat: ChatMessage[] = [{
        role: 'model',
        text: `I've analyzed your situation based on ${triage.citations ? triage.citations.length : 0} cited protocols. Do you have specific questions?`,
        timestamp: Date.now()
      }];
      setChatHistory(initialChat);

      const newSessionId = await createSession(triage, initialChat, []);
      if (!newSessionId) throw new Error("Could not construct session wrapper");
      const places = await fetchNearbyFacilities(triage);
      updateSessionPlaces(newSessionId, places);

      setTimeout(() => setView('result'), 1000);
    } catch (error) {
      console.error(error);
      alert("The connection to the core was interrupted. Please try again.");
      setView('input');
    }
  };

  // ... (Rest of handleChatSubmit, getHealthStats, and JSX)
  // ... (Updated UI to include CitationRow in results)

  const handleChatSubmit = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim() && !chatImage) return;
    if (!result) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: textToSend,
      image: chatImage || undefined,
      timestamp: Date.now()
    };

    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    updateSessionChat(newHistory);
    setChatInput('');
    setChatImage(null);
    setIsChatLoading(true);

    try {
      const base64Data = chatImage ? chatImage.split(',')[1] : undefined;
      const token = localStorage.getItem('aura_token');

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          history: newHistory,
          triageContext: result,
          userProfile,
          newMessage: textToSend,
          base64Image: base64Data || undefined
        })
      });

      if (!response.ok) {
        throw new Error("Failed to process chat response");
      }

      const resData = await response.json();

      const modelMsg: ChatMessage = {
        role: 'model',
        text: resData.reply,
        timestamp: Date.now()
      };
      const finalHistory = [...newHistory, modelMsg];
      setChatHistory(finalHistory);
      updateSessionChat(finalHistory);
    } catch (error) {
      console.error("Chat Error", error);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- Statistics Logic ---
  const getHealthStats = () => {
    if (sessions.length === 0) return null;

    const now: number = Date.now();
    const last30Days = sessions.filter(s => {
      const ts: number = Number(s.timestamp);
      return (now - ts) < 30 * 24 * 60 * 60 * 1000;
    });

    const riskCounts = sessions.reduce((acc: Record<string, number>, s) => {
      const level = s.result.riskLevel;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topRisk = Object.entries(riskCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || 'N/A';

    return {
      monthlyCount: last30Days.length,
      totalCount: sessions.length,
      topRisk
    };
  };

  const stats = getHealthStats();

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden selection:bg-foreground selection:text-background">

      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-[120px] opacity-60" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-gradient-to-tl from-secondary/30 to-transparent rounded-full blur-[100px] opacity-40" />
      </div>

      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 bg-background/40 backdrop-blur-md border-b border-border/50">
        <div className="px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('welcome')}>
            <div className="w-9 h-9 flex items-center justify-center overflow-hidden">
              <img
                src={isDark ? "/logo-light.png" : "/logo.png"}
                alt="AURA Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">AURA</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('profile')}
              className="hidden md:flex items-center gap-2 text-sm text-muted-foreground mr-2 bg-secondary/50 hover:bg-secondary px-3 py-1.5 rounded-full border border-border/50 transition-colors"
            >
              <Fingerprint size={14} /> {currentUser ? currentUser.name : 'Guest Profile'}
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('settings')}
              className="text-muted-foreground hover:text-primary"
              title="Settings"
            >
              <Settings size={18} />
            </Button>
            <ThemeToggle isDark={isDark} toggle={toggleTheme} />
            {currentUser ? (
              <Button variant="ghost" size="icon" onClick={logoutUser} className="ml-1 text-muted-foreground hover:text-destructive" title="Log Out">
                <LogOut size={18} />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setView('auth')} className="ml-1 text-muted-foreground hover:text-primary">
                <LogIn size={16} className="mr-1" /> Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-5xl mx-auto min-h-screen flex flex-col justify-center px-6 py-24">
        <AnimatePresence mode="wait">

          {/* --- 0. AUTH SCREEN --- */}
          {view === 'auth' && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center justify-center w-full max-w-md mx-auto"
            >
              <div className="mb-8 text-center space-y-2">
                <div className="w-16 h-16 flex items-center justify-center mx-auto mb-6">
                  <img
                    src={isDark ? "/logo-light.png" : "/logo.png"}
                    alt="AURA Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h1 className="text-3xl font-display font-medium">Welcome to AURA</h1>
                <p className="text-muted-foreground flex items-center gap-1 justify-center">
                  <Lock size={12} className="text-primary" /> Secure Health Intelligence
                </p>
              </div>

              <BentoCard className="w-full bg-card/80 backdrop-blur-xl border border-white/10 dark:border-white/5">
                <form onSubmit={handleAuth} className="space-y-4">
                  {authMode === 'signup' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground ml-1">Full Name</label>
                      <Input
                        type="text"
                        required
                        placeholder="Jane Doe"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        disabled={authLoading}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Email Address</label>
                    <Input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      disabled={authLoading}
                    />
                  </div>

                  <div className="space-y-1 relative">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="pr-10"
                        disabled={authLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {authMode === 'signup' && (
                      <p className="text-[10px] text-muted-foreground/80 ml-1">
                        Must be 8+ characters for HIPAA compliance.
                      </p>
                    )}
                  </div>

                  {authError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-xs text-red-500 bg-red-500/10 p-2 rounded-lg border border-red-500/20"
                    >
                      {authError}
                    </motion.div>
                  )}

                  <Button type="submit" className="w-full text-lg h-12 rounded-xl mt-4" loading={authLoading}>
                    {authMode === 'login' ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>
              </BentoCard>
              {/* ... (Existing footer) ... */}
              <div className="mt-6 text-sm text-muted-foreground">
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'signup' : 'login');
                    setAuthError(null);
                    setAuthPassword('');
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  {authMode === 'login' ? 'Sign Up' : 'Log In'}
                </button>
              </div>
              <button
                onClick={() => setView('welcome')}
                className="mt-3 text-sm text-muted-foreground/70 hover:text-primary transition-colors"
              >
                Continue without signing in →
              </button>

              <p className="mt-8 text-[10px] text-muted-foreground/40 text-center max-w-xs mx-auto">
                <Lock size={10} className="inline mr-1" />
                End-to-end encrypted locally using SHA-256 + PBKDF2 standards. No plain-text passwords stored.
              </p>
            </motion.div>
          )}

          {/* --- MIGRATE GUEST DATA --- */}
          {view === 'migrate' && pendingMigration && (
            <motion.div
              key="migrate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg mx-auto space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-display font-semibold">Import Guest Data</h2>
                <p className="text-sm text-muted-foreground">Select which guest data to save to your account.</p>
              </div>

              {/* Sessions */}
              {pendingMigration.sessions.length > 0 && (
                <BentoCard>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <HistoryIcon size={16} /> Assessments ({selectedMigrationIds.size}/{pendingMigration.sessions.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {pendingMigration.sessions.map(session => (
                      <label
                        key={session.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMigrationIds.has(session.id)}
                          onChange={() => toggleMigrationSession(session.id)}
                          className="rounded border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{session.result.conditionTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.timestamp).toLocaleDateString()} • {session.result.riskLevel}
                          </p>
                        </div>
                        <Badge variant={session.result.riskLevel === 'Emergency' ? 'red' : session.result.riskLevel === 'Urgent' ? 'amber' : 'emerald'}>
                          {session.result.riskLevel}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </BentoCard>
              )}

              {/* Profile */}
              {(pendingMigration.profile.allergies.length > 0 || pendingMigration.profile.conditions.length > 0 || pendingMigration.profile.medications.length > 0) && (
                <BentoCard>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={migrateProfile}
                      onChange={() => setMigrateProfile(!migrateProfile)}
                      className="rounded border-border"
                    />
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Fingerprint size={16} /> Import Guest Profile
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pendingMigration.profile.allergies.length} allergies, {pendingMigration.profile.conditions.length} conditions, {pendingMigration.profile.medications.length} medications
                      </p>
                    </div>
                  </label>
                </BentoCard>
              )}

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => handleMigration(true)}
                  disabled={migrationLoading}
                >
                  Skip
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleMigration(false)}
                  loading={migrationLoading}
                >
                  Save Selected
                </Button>
              </div>
            </motion.div>
          )}

          {/* --- 1. WELCOME --- */}
          {view === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center space-y-12"
            >
              <div className="space-y-6 max-w-3xl">
                <Badge variant="neutral" className="mb-4">SYSTEM ONLINE • V3.3</Badge>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-medium tracking-tight leading-[0.9]">
                  <span className="block text-2xl md:text-3xl font-normal text-muted-foreground mb-2">
                    {currentUser ? `Hello, ${currentUser.name.split(' ')[0]}.` : 'Hello.'}
                  </span>
                  Personal Health <br />
                  <span className="text-muted-foreground opacity-50">Intelligence.</span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto font-light leading-relaxed">
                  Medical-grade triage powered by Gemini 3.0 Pro. <br className="hidden md:block" />
                  I have access to your history for smarter diagnostics.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <Button onClick={() => setView('input')} size="lg" className="w-full text-lg shadow-xl shadow-primary/20">
                  Begin Assessment
                </Button>
                <Button
                  onClick={() => setView('history')}
                  variant="secondary"
                  size="lg"
                  className="w-full text-lg"
                >
                  <HistoryIcon className="mr-2 w-5 h-5" /> Patient Record
                </Button>
              </div>

              {/* Health Insights Dashboard */}
              {stats && (
                <div className="w-full max-w-3xl mt-12 pt-12 border-t border-border/20">
                  <div className="text-left mb-6 flex items-center gap-2">
                    <TrendingUp className="text-primary" size={20} />
                    <h3 className="font-display font-medium text-lg">Health Insights</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <StatsCard
                      label="Total Scans"
                      value={stats.totalCount.toString()}
                      icon={Activity}
                    />
                    <StatsCard
                      label="Last 30 Days"
                      value={stats.monthlyCount.toString()}
                      icon={Calendar}
                      trend="+2"
                    />
                    <StatsCard
                      label="Most Common Risk"
                      value={stats.topRisk}
                      icon={AlertCircle}
                    />
                  </div>
                </div>
              )}

              <div className="pt-12 grid grid-cols-3 gap-8 md:gap-16 text-xs font-mono text-muted-foreground opacity-60">
                <div className="flex flex-col gap-1 items-center">
                  <ShieldCheck size={16} />
                  <span>HIPAA SECURE</span>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  <Zap size={16} />
                  <span>REAL-TIME</span>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  <Map size={16} />
                  <span>GEOLOCATED</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* --- SETTINGS --- */}
          {view === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full max-w-xl mx-auto"
            >
              <div className="mb-8">
                <Button variant="ghost" onClick={() => setView('welcome')} className="mb-2 pl-0 hover:bg-transparent hover:text-primary">
                  <ArrowRight className="rotate-180 mr-2 w-4 h-4" /> Back
                </Button>
                <h2 className="text-3xl font-display font-medium">Settings</h2>
                <p className="text-muted-foreground">Configure your AURA experience.</p>
              </div>

              <BentoCard>
                <div className="flex items-center gap-2 mb-6">
                  <Map className="text-primary" size={20} />
                  <h3 className="font-semibold text-lg">Location Services</h3>
                </div>

                <div className="bg-secondary/30 rounded-xl p-4 mb-6 border border-border/50">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Current Location</div>
                  {location ? (
                    <div className="flex items-center justify-between">
                      <div className="font-display font-medium text-lg">
                        {locationName || 'Unknown Location'}
                      </div>
                      <div className="text-[10px] font-mono opacity-50">
                        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">Location unknown</div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={refreshLocation}
                      disabled={isLocating}
                    >
                      <span className="flex items-center gap-2"><Navigation size={16} /> Detect My Location</span>
                      {isLocating && <Loader2 className="animate-spin" size={16} />}
                    </Button>
                    <p className="text-[10px] text-muted-foreground mt-1.5 ml-1">
                      Uses browser geolocation to find your exact position.
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or Set Manually</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="City, Region, or Zip Code"
                      value={manualLocationInput}
                      onChange={(e) => setManualLocationInput(e.target.value)}
                    />
                    <Button onClick={handleManualLocation} disabled={isLocating || !manualLocationInput}>
                      {isLocating ? <Loader2 className="animate-spin" size={16} /> : 'Set'}
                    </Button>
                  </div>
                </div>
              </BentoCard>

              <BentoCard className="mt-6">
                <div className="flex items-center gap-2 mb-6 text-destructive">
                  <AlertCircle size={20} />
                  <h3 className="font-semibold text-lg">Account Actions</h3>
                </div>
                <div className="space-y-4">
                  {currentUser ? (
                    <>
                      <p className="text-sm text-muted-foreground">Sign out of your account to clear your current session.</p>
                      <Button
                        variant="destructive"
                        className="w-full justify-between"
                        onClick={logoutUser}
                      >
                        <span className="flex items-center gap-2"><LogOut size={16} /> Log Out</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Sign in to save your assessments and sync your profile across devices.</p>
                      <Button
                        className="w-full justify-between"
                        onClick={() => setView('auth')}
                      >
                        <span className="flex items-center gap-2"><LogIn size={16} /> Sign In</span>
                      </Button>
                    </>
                  )}
                </div>
              </BentoCard>
            </motion.div>
          )}

          {/* ... (Input view unchanged) ... */}
          {/* --- 2. INPUT --- */}
          {view === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-2xl mx-auto"
            >
              <div className="mb-12">
                <Button variant="ghost" onClick={() => setView('welcome')} className="mb-4 pl-0 hover:bg-transparent hover:text-primary">
                  <ArrowRight className="rotate-180 mr-2 w-4 h-4" /> Back
                </Button>
                <h2 className="text-3xl md:text-4xl font-display font-medium mb-3">How are you feeling?</h2>
                <p className="text-muted-foreground">Describe your symptoms in detail. Our semantic engine will do the rest.</p>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
                <div className="relative bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/5 dark:shadow-white/5">
                  <MinimalTextarea
                    placeholder="I woke up with a migraine and sensitivity to light..."
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    autoFocus
                  />

                  {selectedImage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-6 relative rounded-xl overflow-hidden"
                    >
                      <img src={selectedImage} alt="Analysis Target" className="w-full h-64 object-cover" />
                      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full border border-white/20">
                        Image Attached
                      </div>
                      <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute bottom-4 right-4 bg-white text-black text-xs px-4 py-2 rounded-full font-medium hover:bg-gray-200 transition"
                      >
                        Remove
                      </button>
                    </motion.div>
                  )}

                  <div className="flex items-center justify-between pt-6 border-t border-border/40">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className={selectedImage ? "text-primary bg-primary/10" : "text-muted-foreground"}
                      >
                        <Camera size={20} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleMicClick}
                        className={isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground"}
                      >
                        <Mic size={20} />
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </div>
                    <Button
                      onClick={handleSubmit}
                      disabled={!symptoms && !selectedImage}
                      className="rounded-full px-6"
                    >
                      Analyze <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ... (Processing view unchanged, agents update handles text) ... */}
          {/* --- 3. PROCESSING --- */}
          {view === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg mx-auto flex flex-col items-center justify-center min-h-[50vh]"
            >
              {/* Abstract Loader */}
              <div className="relative w-32 h-32 mb-16">
                <motion.span
                  className="absolute inset-0 border-t-2 border-primary rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
                <motion.span
                  className="absolute inset-2 border-r-2 border-muted-foreground/30 rounded-full"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScanLine className="text-primary animate-pulse" size={32} />
                </div>
              </div>

              <div className="w-full space-y-4 font-mono text-sm">
                {agents.map((agent, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-muted-foreground">{agent.name}</span>
                    <span className={cn(
                      "transition-colors duration-300",
                      agent.status === 'working' ? "text-primary animate-pulse" :
                        agent.status === 'complete' ? "text-foreground" :
                          "text-muted-foreground/30"
                    )}>
                      {agent.status === 'working' ? '[ PROCESSING ]' : agent.message}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ... (Profile and History views unchanged) ... */}
          {/* --- 6. PROFILE --- */}
          {view === 'profile' && currentUser && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full max-w-4xl mx-auto"
            >
              <div className="mb-8">
                <Button variant="ghost" onClick={() => setView('welcome')} className="mb-2 pl-0 hover:bg-transparent hover:text-primary">
                  <ArrowRight className="rotate-180 mr-2 w-4 h-4" /> Back
                </Button>
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-display font-medium">Patient Profile</h2>
                    <p className="text-muted-foreground">Manage your permanent medical record used by AURA.</p>
                  </div>
                  <div className="hidden md:block">
                    <Badge variant="neutral">ID: {currentUser.id.slice(0, 8)}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* User Identity */}
                <BentoCard className="md:col-span-1 h-fit">
                  <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                      <UserIcon size={32} />
                    </div>
                    <h3 className="text-xl font-semibold">{currentUser ? currentUser.name : 'Guest User'}</h3>
                    <p className="text-sm text-muted-foreground">{currentUser ? currentUser.email : 'Not signed in'}</p>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-border/50">
                    {currentUser && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2"><Calendar size={14} /> Joined</span>
                      <span className="font-mono">{new Date(currentUser.joinedAt).toLocaleDateString()}</span>
                    </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2"><Hash size={14} /> Sessions</span>
                      <span className="font-mono">{sessions.length}</span>
                    </div>
                  </div>
                </BentoCard>

                {/* Medical Data Inputs */}
                <div className="md:col-span-2 space-y-6">

                  {/* Allergies */}
                  <BentoCard>
                    <div className="flex items-center gap-2 mb-4 text-red-500">
                      <AlertCircle size={18} />
                      <h3 className="font-semibold text-foreground">Allergies</h3>
                    </div>
                    <div className="flex gap-2 mb-4">
                      <Input
                        placeholder="Add allergy (e.g. Penicillin)"
                        value={inputAllergy}
                        onChange={(e) => setInputAllergy(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addProfileItem('allergies', inputAllergy)}
                        className="h-10"
                      />
                      <Button size="sm" onClick={() => addProfileItem('allergies', inputAllergy)}><Plus size={16} /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.allergies.map((item, i) => (
                        <Badge key={i} variant="red" className="pl-3 pr-1 py-1 flex items-center gap-1">
                          {item}
                          <button onClick={() => removeProfileItem('allergies', i)} className="hover:bg-red-500/20 rounded-full p-0.5 ml-1 transition"><X size={12} /></button>
                        </Badge>
                      ))}
                      {userProfile.allergies.length === 0 && <span className="text-sm text-muted-foreground italic">No allergies listed.</span>}
                    </div>
                  </BentoCard>

                  {/* Conditions */}
                  <BentoCard>
                    <div className="flex items-center gap-2 mb-4 text-amber-500">
                      <FileText size={18} />
                      <h3 className="font-semibold text-foreground">Chronic Conditions</h3>
                    </div>
                    <div className="flex gap-2 mb-4">
                      <Input
                        placeholder="Add condition (e.g. Asthma)"
                        value={inputCondition}
                        onChange={(e) => setInputCondition(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addProfileItem('conditions', inputCondition)}
                        className="h-10"
                      />
                      <Button size="sm" onClick={() => addProfileItem('conditions', inputCondition)}><Plus size={16} /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.conditions.map((item, i) => (
                        <Badge key={i} variant="amber" className="pl-3 pr-1 py-1 flex items-center gap-1">
                          {item}
                          <button onClick={() => removeProfileItem('conditions', i)} className="hover:bg-amber-500/20 rounded-full p-0.5 ml-1 transition"><X size={12} /></button>
                        </Badge>
                      ))}
                      {userProfile.conditions.length === 0 && <span className="text-sm text-muted-foreground italic">No conditions listed.</span>}
                    </div>
                  </BentoCard>

                  {/* Medications */}
                  <BentoCard>
                    <div className="flex items-center gap-2 mb-4 text-emerald-500">
                      <Pill size={18} />
                      <h3 className="font-semibold text-foreground">Current Medications</h3>
                    </div>
                    <div className="flex gap-2 mb-4">
                      <Input
                        placeholder="Add medication (e.g. Lisinopril 10mg)"
                        value={inputMedication}
                        onChange={(e) => setInputMedication(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addProfileItem('medications', inputMedication)}
                        className="h-10"
                      />
                      <Button size="sm" onClick={() => addProfileItem('medications', inputMedication)}><Plus size={16} /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.medications.map((item, i) => (
                        <Badge key={i} variant="emerald" className="pl-3 pr-1 py-1 flex items-center gap-1">
                          {item}
                          <button onClick={() => removeProfileItem('medications', i)} className="hover:bg-emerald-500/20 rounded-full p-0.5 ml-1 transition"><X size={12} /></button>
                        </Badge>
                      ))}
                      {userProfile.medications.length === 0 && <span className="text-sm text-muted-foreground italic">No medications listed.</span>}
                    </div>
                  </BentoCard>

                </div>
              </div>
            </motion.div>
          )}

          {/* --- 5. HISTORY --- */}
          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full max-w-3xl mx-auto"
            >
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <Button variant="ghost" onClick={() => setView('welcome')} className="mb-2 pl-0 hover:bg-transparent hover:text-primary">
                    <ArrowRight className="rotate-180 mr-2 w-4 h-4" /> Back
                  </Button>
                  <h2 className="text-3xl font-display font-medium">Patient Record</h2>
                </div>
                <Badge variant="neutral">{sessions.length} ASSESSMENTS</Badge>
              </div>

              {/* Medical ID Card Summary */}
              <BentoCard className="mb-8 bg-gradient-to-r from-card to-background cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setView('profile')}>
                <div className="flex items-center justify-between mb-4 text-muted-foreground border-b border-border/50 pb-2">
                  <div className="flex items-center gap-3">
                    <UserIcon size={18} />
                    <span className="text-xs uppercase tracking-wider font-semibold">Medical Profile{currentUser ? ` for ${currentUser.name}` : ''}</span>
                  </div>
                  <ArrowRight size={14} className="opacity-50" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pointer-events-none">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium mb-2 text-foreground/80">
                      <AlertCircle size={14} className="text-red-500" /> Allergies
                    </div>
                    {userProfile.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {userProfile.allergies.slice(0, 3).map(a => <Badge key={a} variant="red">{a}</Badge>)}
                        {userProfile.allergies.length > 3 && <Badge variant="neutral">+{userProfile.allergies.length - 3}</Badge>}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">None detected</div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium mb-2 text-foreground/80">
                      <FileText size={14} className="text-amber-500" /> Conditions
                    </div>
                    {userProfile.conditions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {userProfile.conditions.slice(0, 3).map(a => <Badge key={a} variant="amber">{a}</Badge>)}
                        {userProfile.conditions.length > 3 && <Badge variant="neutral">+{userProfile.conditions.length - 3}</Badge>}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">None detected</div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium mb-2 text-foreground/80">
                      <Pill size={14} className="text-emerald-500" /> Medications
                    </div>
                    {userProfile.medications.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {userProfile.medications.slice(0, 3).map(a => <Badge key={a} variant="emerald">{a}</Badge>)}
                        {userProfile.medications.length > 3 && <Badge variant="neutral">+{userProfile.medications.length - 3}</Badge>}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">None detected</div>
                    )}
                  </div>
                </div>
              </BentoCard>

              <div className="grid gap-4">
                {sessions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No assessment history found.</div>
                ) : (
                  sessions.map((session, i) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => loadSession(session)}
                      className="group relative flex items-center gap-6 bg-card border border-border/50 p-6 rounded-2xl hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold",
                        session.result.riskLevel === 'Emergency' ? "bg-red-500/10 text-red-600" :
                          session.result.riskLevel === 'Urgent' ? "bg-amber-500/10 text-amber-600" :
                            session.result.riskLevel === 'Self-Care' ? "bg-emerald-500/10 text-emerald-600" :
                              "bg-blue-500/10 text-blue-600"
                      )}>
                        {session.result.riskScore}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-lg truncate">{session.result.conditionTitle}</h3>
                          <Badge variant={
                            session.result.riskLevel === 'Emergency' ? 'red' :
                              session.result.riskLevel === 'Urgent' ? 'amber' :
                                session.result.riskLevel === 'Self-Care' ? 'emerald' : 'neutral'
                          }>{session.result.riskLevel.toUpperCase()}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                          <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(session.timestamp).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> {new Date(session.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                        onClick={(e) => deleteSession(e, session.id)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* ... (Result view unchanged) ... */}
          {/* --- 4. RESULTS (BENTO GRID) --- */}
          {view === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="w-full space-y-8 pb-12"
            >
              {/* Guest Sign-in Prompt */}
              {!currentUser && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between"
                >
                  <span className="text-sm text-muted-foreground">Sign in to save this assessment to your account</span>
                  <Button size="sm" onClick={() => setView('auth')}>Sign In</Button>
                </motion.div>
              )}

              {/* Emergency Banner */}
              {result.riskLevel === 'Emergency' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-600 text-white rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-2xl shadow-red-500/30 gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-full animate-pulse">
                      <AlertTriangle size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold uppercase tracking-wide">Emergency Alert</h3>
                      <p className="opacity-90">Immediate medical attention is recommended.</p>
                    </div>
                  </div>
                  <Button variant="glass" className="bg-white dark:bg-black text-red-600 hover:bg-white/90 dark:hover:bg-black/90 border-transparent font-bold">
                    <Phone className="mr-2 w-5 h-5" /> CALL EMERGENCY SERVICES
                  </Button>
                </motion.div>
              )}

              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-display font-medium">Assessment Report</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {new Date(sessionId ? (sessions.find(s => s.id === sessionId)?.timestamp || Date.now()) : Date.now()).toLocaleDateString()} •
                    {new Date(sessionId ? (sessions.find(s => s.id === sessionId)?.timestamp || Date.now()) : Date.now()).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={handleShareReport} className="text-muted-foreground hover:text-foreground">
                    {showCopyFeedback ? <Clipboard className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
                    {showCopyFeedback ? 'Copied' : 'Share Report'}
                  </Button>
                  <Button variant="ghost" onClick={handleNewScan} size="sm" className="text-muted-foreground">
                    <RotateCcw className="mr-2 w-4 h-4" /> New Scan
                  </Button>
                </div>
              </div>

              <div id="triage-report-content" className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)] p-4 rounded-xl">

                {/* 1. Main Diagnosis Card */}
                <BentoCard className={cn(
                  "md:col-span-2 md:row-span-2 text-primary-foreground border-none",
                  result.riskLevel === 'Emergency' ? "bg-gradient-to-br from-red-600 to-red-800" :
                    result.riskLevel === 'Urgent' ? "bg-gradient-to-br from-orange-600 to-amber-800" :
                      result.riskLevel === 'Self-Care' ? "bg-gradient-to-br from-emerald-600 to-green-800" :
                        "bg-gradient-to-br from-blue-600 to-indigo-800"
                )}>
                  <div className="h-full flex flex-col justify-between relative z-10">
                    <div className="flex justify-between items-start">
                      <Badge variant="neutral" className="bg-white/10 text-white border-white/10 backdrop-blur-md">
                        {result.riskLevel.toUpperCase()} PRIORITY
                      </Badge>
                      <Activity className="opacity-50" />
                    </div>

                    <div className="mt-8">
                      <h3 className="text-4xl md:text-5xl font-display font-medium mb-4 leading-tight">
                        {result.conditionTitle}
                      </h3>
                      <p className="text-primary-foreground/80 text-lg leading-relaxed max-w-lg">
                        {result.summary}
                      </p>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/10 flex gap-12">
                      <div>
                        <div className="text-sm opacity-60 uppercase tracking-wider mb-1">Risk Score</div>
                        <div className="text-4xl font-mono">{result.riskScore}<span className="text-lg opacity-50">/10</span></div>
                      </div>
                      <div>
                        <div className="text-sm opacity-60 uppercase tracking-wider mb-1">Confidence</div>
                        <div className="text-4xl font-mono">98<span className="text-lg opacity-50">%</span></div>
                      </div>
                    </div>
                  </div>
                </BentoCard>

                {/* 2. Actions List */}
                <BentoCard className="md:row-span-2 flex flex-col">
                  <div className="flex items-center gap-2 mb-6 text-muted-foreground">
                    <ShieldCheck size={18} />
                    <span className="text-xs uppercase tracking-wider font-semibold">Protocol</span>
                  </div>
                  <ul className="space-y-4 flex-1">
                    {result.immediateActions.map((action, i) => (
                      <li key={i} className="flex gap-3 text-sm group">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-mono group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {i + 1}
                        </span>
                        <span className="leading-snug">{action}</span>
                      </li>
                    ))}
                  </ul>
                </BentoCard>

                {/* 3. Medical Analysis (Wide) */}
                <BentoCard className="md:col-span-2">
                  <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                    <Sparkles size={18} />
                    <span className="text-xs uppercase tracking-wider font-semibold">Clinical Reasoning</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {result.medicalAnalysis}
                  </p>
                </BentoCard>

                {/* 4. Location / Map Data */}
                <BentoCard className="md:col-span-1 bg-secondary/30">
                  <div className="flex items-center justify-between mb-4 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Map size={18} />
                      <span className="text-xs uppercase tracking-wider font-semibold">Facilities</span>
                    </div>
                    {loadingPlaces && <Loader2 className="animate-spin w-3 h-3" />}
                  </div>

                  <div className="space-y-2 -mx-2">
                    {nearbyPlaces.length > 0 ? nearbyPlaces.slice(0, 2).map((place, i) => (
                      <PlaceRow key={i} place={place} index={i} />
                    )) : (
                      <div className="text-sm text-muted-foreground/50 py-4 text-center">
                        Location services unavailable.
                      </div>
                    )}
                  </div>
                </BentoCard>

                {/* 4.5 Sources & Citations */}
                {result.citations && result.citations.length > 0 && (
                  <BentoCard className="md:col-span-3 bg-secondary/10">
                    <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                      <BookOpen size={18} />
                      <span className="text-xs uppercase tracking-wider font-semibold">Referenced Safety Protocols</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {result.citations.map((cite, i) => (
                        <CitationRow key={i} citation={cite} />
                      ))}
                    </div>
                  </BentoCard>
                )}

                {/* 5. AURA Consultant Chat (Full Width) */}
                <BentoCard className="md:col-span-3 min-h-[500px] flex flex-col bg-gradient-to-br from-card to-background">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h3 className="font-display font-medium text-lg">AURA Consultant</h3>
                        <p className="text-xs text-muted-foreground">Ask clarifying questions or provide more details</p>
                      </div>
                    </div>
                    <Badge variant="neutral">LIVE SESSION</Badge>
                  </div>

                  <div className="flex-1 overflow-y-auto mb-6 pr-2 max-h-[400px]">
                    {chatHistory.map((msg, i) => (
                      <ChatBubble key={i} message={msg} />
                    ))}
                    {isChatLoading && <TypingIndicator />}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Suggested Questions */}
                  {result.suggestedFollowUpQuestions && result.suggestedFollowUpQuestions.length > 0 && !isChatLoading && (
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                      {result.suggestedFollowUpQuestions.map((q, i) => (
                        <SuggestionChip key={i} text={q} onClick={() => handleChatSubmit(q)} />
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <div className="flex gap-2 items-end bg-secondary/30 rounded-2xl p-2 border border-border/50 focus-within:ring-1 focus-within:ring-ring transition-all">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl h-10 w-10 text-muted-foreground hover:text-primary"
                        onClick={() => chatFileRef.current?.click()}
                      >
                        <Plus size={20} />
                      </Button>
                      <input
                        type="file"
                        ref={chatFileRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleChatImageUpload}
                      />

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        {chatImage && (
                          <div className="mb-2 relative w-fit group">
                            <img src={chatImage} alt="Preview" className="h-16 rounded-lg border border-border" />
                            <button
                              onClick={() => setChatImage(null)}
                              className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                        <textarea
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleChatSubmit();
                            }
                          }}
                          placeholder="Type your question here..."
                          className="w-full bg-transparent border-none focus:ring-0 p-2 text-sm resize-none max-h-24"
                          rows={1}
                        />
                      </div>

                      <Button
                        size="icon"
                        className="rounded-xl h-10 w-10 shadow-none"
                        onClick={() => handleChatSubmit()}
                        disabled={(!chatInput.trim() && !chatImage) || isChatLoading}
                      >
                        <Send size={18} />
                      </Button>
                    </div>
                  </div>
                </BentoCard>

              </div>

              <div className="mt-8 text-center pb-8">
                <p className="text-xs text-muted-foreground max-w-2xl mx-auto border-t border-border pt-6">
                  <span className="font-semibold text-foreground">Disclaimer:</span> {result.disclaimer}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;