import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { TriageResult, AgentState, Place, ChatMessage, HistorySession, UserProfile, User, AdminStats } from './lib/types';
import { trackEvent } from './lib/analytics';
import {
  Button,
  Card,
  InkPanel,
  Badge,
  SeverityTag,
  SectionHead,
  Stepper,
  PlaceRow,
  ThemeToggle,
  MinimalTextarea,
  ChatBubble,
  TypingIndicator,
  Input,
  StatsCard,
  SuggestionChip,
  CitationRow,
  RiskMeter,
  riskStyle,
  cn
} from './components/UIComponents';
import EmergencyCallPanel from './components/EmergencyCallPanel';
import EmrView from './components/emr/EmrView';
import {
  Activity,
  Camera,
  Mic,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Check,
  Map,
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
  Pill,
  FileText,
  LogOut,
  LogIn,
  TrendingUp,
  Share2,
  Clipboard,
  Settings,
  Hash,
  Eye,
  EyeOff,
  BookOpen,
  Navigation,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const INITIAL_AGENTS: AgentState[] = [
  { name: 'Reading your description', status: 'idle', message: 'Waiting' },
  { name: 'Checking safety guidelines', status: 'idle', message: 'Waiting' },
  { name: 'Clinical analysis', status: 'idle', message: 'Waiting' },
  { name: 'Finding nearby care', status: 'idle', message: 'Waiting' }
];

const App = () => {
  // Views
  const [view, setView] = useState<'auth' | 'welcome' | 'input' | 'processing' | 'result' | 'history' | 'profile' | 'emr' | 'settings' | 'migrate'>('auth');

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

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

  // Refine State
  const [lastSubmittedSymptoms, setLastSubmittedSymptoms] = useState<string>('');
  const [clarifyingAnswers, setClarifyingAnswers] = useState<Record<number, string>>({});
  const [isRefining, setIsRefining] = useState(false);
  const [refinedOnce, setRefinedOnce] = useState(false);

  // Migration State (guest → authenticated)
  const [pendingMigration, setPendingMigration] = useState<{ sessions: HistorySession[], profile: UserProfile } | null>(null);
  const [selectedMigrationIds, setSelectedMigrationIds] = useState<Set<string>>(new Set());
  const [migrateProfile, setMigrateProfile] = useState(true);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Processing steps state
  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS);

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
    trackEvent('page_view', !!localStorage.getItem('aura_token'));

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
    if (view === 'settings' && currentUser) {
      loadAdminStats();
    }
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
    setAuthSuccess(null);

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
          trackEvent('guest_converted', true);
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
        setAuthError(null);
        setAuthSuccess('Registration successful! Please log in.');
        trackEvent('account_registered', false);
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication.');
    } finally {
      setAuthLoading(false);
    }
  };

  const loadAdminStats = async () => {
    const token = localStorage.getItem('aura_token');
    if (!token) return;
    setAdminStatsLoading(true);
    try {
      const res = await fetch('/api/analytics/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAdminStats(await res.json());
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch {
      // silently ignore
    } finally {
      setAdminStatsLoading(false);
    }
  };

  const logoutUser = () => {
    setCurrentUser(null);
    localStorage.removeItem('aura_token');
    setSessionId(null);
    setSessions(loadGuestSessions());
    setUserProfile(loadGuestProfile());
    setView('welcome');
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
    try {
      localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error("Failed to save guest profile:", e);
    }
  };

  const loadGuestSessions = (): HistorySession[] => {
    try {
      const stored = localStorage.getItem(GUEST_SESSIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  };

  const saveGuestSessions = (updatedSessions: HistorySession[]) => {
    try {
      // Cap at 20 most recent to avoid localStorage bloat
      const capped = updatedSessions.slice(0, 20);
      localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(capped));
    } catch (e) {
      console.error("Failed to save guest sessions:", e);
    }
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
          setSessions(prev => [mappedSession, ...prev]);
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
      setSessions(prev => {
        const updatedSessions = [guestSession, ...prev];
        saveGuestSessions(updatedSessions);
        return updatedSessions;
      });
      setSessionId(guestId);
      return guestId;
    }
  };

  const updateSessionChat = async (newChatHistory: ChatMessage[]) => {
    if (!sessionId) return;
    const token = localStorage.getItem('aura_token');

    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, chatHistory: newChatHistory } : s);
      if (!token) saveGuestSessions(updated);
      return updated;
    });

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
    }
  };

  const updateSessionResult = async (newResult: TriageResult) => {
    if (!sessionId) return;
    const token = localStorage.getItem('aura_token');

    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, result: newResult } : s);
      if (!token) saveGuestSessions(updated);
      return updated;
    });

    if (token) {
      try {
        await fetch(`/api/history/${sessionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ result: newResult })
        });
      } catch (e) {
        console.error("Failed to update session result", e);
      }
    }
  };

  const handleRefineSubmit = async () => {
    if (!result) return;
    const answered = (Object.entries(clarifyingAnswers) as [string, string][])
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => ({ question: result.clarifyingQuestions?.[Number(k)] || '', answer: v.trim() }))
      .filter(qa => qa.question);

    if (answered.length === 0) return;
    setIsRefining(true);
    try {
      const token = localStorage.getItem('aura_token');
      const response = await fetch('/api/ai/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          originalSymptoms: lastSubmittedSymptoms,
          previousResult: result,
          clarifyingAnswers: answered,
          userProfile
        })
      });

      if (!response.ok) {
        let errMsg = 'Failed to refine assessment';
        try { const errData = await response.json(); if (errData.error) errMsg = errData.error; } catch {}
        throw new Error(errMsg);
      }

      const refined: TriageResult = await response.json();
      setResult(refined);
      updateSessionResult(refined);

      if (refined.detectedProfileUpdates) {
        const updates = refined.detectedProfileUpdates;
        const newProfile: UserProfile = {
          allergies: [...new Set([...userProfile.allergies, ...(updates.newAllergies || [])])],
          conditions: [...new Set([...userProfile.conditions, ...(updates.newConditions || [])])],
          medications: [...new Set([...userProfile.medications, ...(updates.newMedications || [])])]
        };
        if (updates.newAllergies?.length > 0 || updates.newConditions?.length > 0 || updates.newMedications?.length > 0) {
          saveProfileToStorage(newProfile);
        }
      }

      const refinedNote: ChatMessage = {
        role: 'model',
        text: `I've updated your assessment based on the additional details you provided. The refined risk level is **${refined.riskLevel}** (score ${refined.riskScore}/10). Let me know if you have more questions.`,
        timestamp: Date.now()
      };
      const newChat = [...chatHistory, refinedNote];
      setChatHistory(newChat);
      updateSessionChat(newChat);

      setClarifyingAnswers({});
      setRefinedOnce(true);
    } catch (e) {
      console.error('Refine error', e);
      alert('Could not refine the assessment. Please try again.');
    } finally {
      setIsRefining(false);
    }
  };

  const updateSessionPlaces = async (id: string, places: Place[]) => {
    const token = localStorage.getItem('aura_token');

    setSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, nearbyPlaces: places } : s);
      if (!token) saveGuestSessions(updated);
      return updated;
    });

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
    }
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    const token = localStorage.getItem('aura_token');
    if (token) {
      try {
        const res = await fetch(`/api/history/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          console.error("Server failed to delete session:", res.status);
          return;
        }
      } catch (e) {
        console.error("Failed to delete session", e);
        return;
      }
    }

    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      if (!token) saveGuestSessions(updated);
      return updated;
    });

    if (sessionId === id) {
      handleNewScan();
    }
  };

  const handleMigration = async (skip: boolean = false) => {
    const token = localStorage.getItem('aura_token');
    if (!token || !pendingMigration) {
      setPendingMigration(null);
      if (token) {
        loadUserData(token);
      }
      setView('welcome');
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
      alert("Some data could not be migrated. You can continue using the app — your guest data is still saved locally.");
      setPendingMigration(null);
      if (token) loadUserData(token);
      setView('welcome');
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
    setClarifyingAnswers({});
    setRefinedOnce(false);
    setLastSubmittedSymptoms('');
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
    setAgents(INITIAL_AGENTS);
  };

  const handleShareReport = async () => {
    if (!result) return;

    try {
      const element = document.getElementById('triage-report-content');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: isDark ? '#161412' : '#f8f7f4',
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

    updateAgent(0, 'working', 'Removing personal identifiers');
    await new Promise(r => setTimeout(r, 800));
    updateAgent(0, 'complete', 'Done');

    updateAgent(1, 'working', 'Matching against emergency criteria');
    await new Promise(r => setTimeout(r, 1000));
    updateAgent(1, 'complete', 'Done');

    updateAgent(2, 'working', 'Analyzing your symptoms');
  };

  const fetchNearbyFacilities = async (triage: TriageResult): Promise<Place[]> => {
    if (!location) {
      setAgents(prev => prev.map((a, i) => i === 3 ? { ...a, status: 'complete', message: 'Location unavailable' } : a));
      return [];
    }
    const facilityType = (triage.suggestedFacilities && triage.suggestedFacilities.length > 0)
      ? triage.suggestedFacilities[0]
      : "Medical Clinic";
    setAgents(prev => prev.map((a, i) => i === 3 ? { ...a, status: 'working', message: `Searching for ${facilityType.toLowerCase()} nearby` } : a));
    setLoadingPlaces(true);
    try {
      const token = localStorage.getItem('aura_token');
      const res = await fetch('/api/ai/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ lat: location.lat, lng: location.lng, facilityType })
      });

      let places: Place[] = [];
      if (res.ok) {
        places = await res.json();
      }
      setNearbyPlaces(places);
      setAgents(prev => prev.map((a, i) => i === 3 ? { ...a, status: 'complete', message: `Found ${places.length} nearby` } : a));
      return places;
    } catch (e) {
      console.error(e);
      setAgents(prev => prev.map((a, i) => i === 3 ? { ...a, status: 'complete', message: 'Search unavailable' } : a));
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
    setLastSubmittedSymptoms(symptoms);
    setClarifyingAnswers({});
    setRefinedOnce(false);
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
          symptoms: symptoms,
          userProfile,
          historyContext,
          base64Image: base64Data || undefined,
          mimeType: selectedImage ? selectedImage.split(';')[0].split(':')[1] : undefined
        })
      });

      if (!response.ok) {
        let errorMsg = "Failed to process triage request";
        try {
          const errData = await response.json();
          if (errData.error) errorMsg = errData.error;
        } catch {}
        throw new Error(errorMsg);
      }

      const triage: TriageResult = await response.json();
      setResult(triage);
      trackEvent('triage_completed', !!localStorage.getItem('aura_token'));

      if (triage.detectedProfileUpdates) {
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

      setAgents(prev => prev.map((a, i) => i < 3 ? { ...a, status: 'complete', message: 'Done' } : a));

      const initialChat: ChatMessage[] = [{
        role: 'model',
        text: `Your assessment is ready. Ask me anything about it — what to watch for, what to expect, or when to seek care.`,
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
      alert("Something went wrong while analyzing your symptoms. Please try again.");
      setView('welcome');
    }
  };

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

  const navItems: { label: string; view: typeof view }[] = [
    { label: 'Check symptoms', view: 'input' },
    { label: 'My record', view: 'history' },
    { label: 'My details', view: 'profile' },
    { label: 'Medical record', view: 'emr' },
    { label: 'Settings', view: 'settings' },
  ];

  const stepIndex = view === 'input' ? 0 : view === 'processing' ? 1 : 2;
  const startOver = () => { setSymptoms(''); setSelectedImage(null); setView('input'); };
  const urgencyNote = (score: number) =>
    score >= 8 ? "Seek emergency care immediately — minutes matter."
      : score >= 5 ? "Not an emergency, but don't wait — get care within a day."
        : "You can most likely manage this at home. Watch for changes.";

  const symptomPresets = [
    { label: 'Throbbing headache, light hurts', dot: '#D97706' },
    { label: 'Fever with a sore throat', dot: '#B45309' },
    { label: 'Sharp stomach pain after eating', dot: '#DC2626' },
    { label: 'Itchy rash spreading on my arm', dot: '#0E7569' },
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-clip">

      {/* Ambient blobs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-[18%] -right-[12%] w-[60vw] max-w-[700px] aspect-square rounded-full blur-[60px]" style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.10), transparent 65%)' }} />
        <div className="absolute -bottom-[20%] -left-[12%] w-[55vw] max-w-[640px] aspect-square rounded-full blur-[60px]" style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.07), transparent 65%)' }} />
      </div>

      {/* Nav */}
      <header className="fixed top-0 z-50 w-full border-b border-foreground/[0.08] backdrop-blur-lg" style={{ background: 'hsl(var(--background) / 0.85)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <button className="flex shrink-0 items-center gap-2.5" onClick={() => setView('welcome')}>
            <span className="anim-breathe inline-flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">+</span>
            <span className="text-[19px] font-extrabold tracking-[0.02em]">AURA</span>
          </button>
          <nav className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {navItems.map((item) => {
              const active = view === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setView(item.view)}
                  className={cn(
                    "hidden h-[38px] shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-semibold transition-colors sm:inline-flex sm:items-center",
                    active ? "bg-accent/[0.12] text-accent" : "text-muted-foreground hover:bg-accent/[0.12] hover:text-accent"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
            <ThemeToggle isDark={isDark} toggle={toggleTheme} />
            {currentUser ? (
              <button
                onClick={logoutUser}
                className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/[0.12] hover:text-accent"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            ) : (
              <button
                onClick={() => setView('auth')}
                className="ml-1 inline-flex h-[38px] shrink-0 items-center rounded-full bg-ink px-4 text-[13.5px] font-semibold text-ink-foreground transition-colors hover:bg-primary"
              >
                Sign in
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 w-full pt-[58px]">
        <AnimatePresence mode="wait">
          {renderView()}
        </AnimatePresence>
      </main>
    </div>
  );

  function renderView() {
    return (
      <>
        {/* ===== AUTH ===== */}
        {view === 'auth' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-full max-w-[460px] px-4 pb-20 pt-10 md:px-6 md:pt-16"
          >
            <div className="mb-7 text-center">
              <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-primary text-2xl font-extrabold text-primary-foreground">+</span>
              <h1 className="text-[clamp(26px,4.4vw,38px)] font-extrabold leading-[1.05] tracking-tight">
                {authMode === 'login' ? 'Welcome back.' : 'Create your account.'}
              </h1>
              <p className="mt-2.5 text-[14.5px] text-muted-foreground">
                {authMode === 'login' ? 'Sign in to see your saved record.' : 'Keep your health record safe across devices.'}
              </p>
            </div>

            <div className="rounded-2xl border border-foreground/[0.07] bg-card p-6 shadow-soft-lg md:p-7">
              <form onSubmit={handleAuth} className="flex flex-col gap-4">
                {authMode === 'signup' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12.5px] font-bold">Full name</label>
                    <Input type="text" required placeholder="Jane Doe" value={authName} onChange={(e) => setAuthName(e.target.value)} disabled={authLoading} />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-bold">Email</label>
                  <Input type="email" required placeholder="name@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} disabled={authLoading} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12.5px] font-bold">Password</label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} required placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="pr-11" disabled={authLoading} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {authMode === 'signup' && <p className="text-[11.5px] text-muted-foreground">At least 8 characters.</p>}
                </div>

                {authError && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{authError}</div>}
                {authSuccess && <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">{authSuccess}</div>}

                <Button type="submit" size="lg" className="mt-1.5 w-full" loading={authLoading} magnetic>
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </Button>
              </form>
            </div>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {authMode === 'login' ? 'New here? ' : 'Already have an account? '}
              <button
                onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(null); setAuthSuccess(null); setAuthPassword(''); }}
                className="font-extrabold text-accent hover:underline"
              >
                {authMode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </div>
            <div className="text-center">
              <button onClick={() => setView('welcome')} className="mt-2.5 text-[13.5px] text-muted-foreground/70 transition-colors hover:text-foreground">
                Continue as guest →
              </button>
            </div>
          </motion.div>
        )}

        {/* ===== MIGRATE ===== */}
        {view === 'migrate' && pendingMigration && (
          <motion.div
            key="migrate"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-full max-w-lg space-y-5 px-4 pb-20 pt-8 md:px-6"
          >
            <div>
              <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-accent">Welcome back</div>
              <h2 className="text-4xl font-extrabold tracking-tight">Keep your guest data?</h2>
              <p className="mt-2 text-sm text-muted-foreground">Choose what to move into your account. Anything you skip is removed from this device.</p>
            </div>

            {pendingMigration.sessions.length > 0 && (
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-bold">Assessments ({selectedMigrationIds.size}/{pendingMigration.sessions.length})</h3>
                <div className="max-h-60 space-y-1 overflow-y-auto">
                  {pendingMigration.sessions.map(session => (
                    <label key={session.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-foreground/[0.04]">
                      <input type="checkbox" checked={selectedMigrationIds.has(session.id)} onChange={() => toggleMigrationSession(session.id)} className="accent-[var(--primary)]" style={{ accentColor: 'hsl(var(--primary))' }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{session.result.conditionTitle}</p>
                        <p className="text-xs text-muted-foreground">{new Date(session.timestamp).toLocaleDateString()}</p>
                      </div>
                      <SeverityTag level={session.result.riskLevel} />
                    </label>
                  ))}
                </div>
              </Card>
            )}

            {(pendingMigration.profile.allergies.length > 0 || pendingMigration.profile.conditions.length > 0 || pendingMigration.profile.medications.length > 0) && (
              <Card className="p-5">
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={migrateProfile} onChange={() => setMigrateProfile(!migrateProfile)} style={{ accentColor: 'hsl(var(--primary))' }} />
                  <div>
                    <h3 className="text-sm font-bold">Medical profile</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {pendingMigration.profile.allergies.length} allergies, {pendingMigration.profile.conditions.length} conditions, {pendingMigration.profile.medications.length} medications
                    </p>
                  </div>
                </label>
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => handleMigration(true)} disabled={migrationLoading}>Skip</Button>
              <Button className="flex-1" onClick={() => handleMigration(false)} loading={migrationLoading}>Save selected</Button>
            </div>
          </motion.div>
        )}

        {/* ===== WELCOME ===== */}
        {view === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-full max-w-6xl px-4 md:px-6"
          >
            {/* Hero */}
            <section className="pt-[clamp(40px,8vh,80px)]">
              <h1 className="text-[clamp(38px,7vw,92px)] font-extrabold leading-[1.02] tracking-[-0.025em]">
                <span className="block anim-rise" style={{ animationDelay: '0.08s' }}>Feeling unwell?</span>
                <span className="block text-primary anim-rise" style={{ animationDelay: '0.22s' }}>Know what to do in 30 seconds.</span>
              </h1>
              <div className="mt-[clamp(24px,4vh,40px)] flex flex-wrap items-center justify-between gap-[clamp(20px,4vw,40px)]">
                <p className="anim-rise max-w-[520px] flex-[1_1_300px] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-muted-foreground" style={{ animationDelay: '0.36s' }}>
                  Tell AURA your symptoms in plain words. It checks them against medical safety guidelines and tells you <strong className="text-foreground">how serious it is</strong>, <strong className="text-foreground">what to do now</strong>, and <strong className="text-foreground">where to get care nearby</strong>.
                </p>
                <Button size="lg" magnetic onClick={() => setView('input')} className="anim-rise h-[62px] px-[34px] text-base" style={{ animationDelay: '0.48s' }}>
                  {currentUser ? `Check symptoms, ${currentUser.name.split(' ')[0]}` : 'Check my symptoms'} <ArrowRight size={18} />
                </Button>
              </div>
            </section>

            {/* How it works */}
            <section className="pt-[clamp(36px,7vh,70px)]">
              <div className="anim-rise mb-4 text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">How it works</div>
              <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
                {[
                  { n: '1', title: "Tell us what's wrong", body: 'Type it, say it, or add a photo. Plain, everyday words work best — no medical terms needed.', delay: '0.1s' },
                  { n: '2', title: 'AURA checks it', body: 'Your symptoms are compared against real medical safety guidelines. Your name and details are removed first.', delay: '0.2s' },
                  { n: '3', title: 'Get a clear answer', body: 'How serious it is, what to do right now, and where to get care nearby — plus answers to your follow-ups.', delay: '0.3s' },
                ].map((st) => (
                  <div key={st.n} className="anim-card rounded-xl border border-foreground/[0.07] bg-card p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg" style={{ animationDelay: st.delay }}>
                    <div className="mb-4 inline-flex h-[42px] w-[42px] items-center justify-center rounded-[14px] bg-accent/[0.1] text-[17px] font-extrabold text-accent">{st.n}</div>
                    <h3 className="mb-2 text-[19px] font-bold">{st.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{st.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Trust strip */}
            <InkPanel className="anim-rise mt-[clamp(36px,7vh,70px)] p-[clamp(24px,4vw,36px)]" style={{ animationDelay: '0.4s' }}>
              <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                {[
                  { title: 'Your privacy is protected', body: 'Personal details are stripped out before anything is analyzed.' },
                  { title: 'Emergencies come first', body: 'If something looks dangerous, AURA tells you immediately — before anything else.' },
                  { title: 'Guidance, not diagnosis', body: 'AURA helps you decide what to do next. It never replaces a real doctor.' },
                ].map((t) => (
                  <div key={t.title} className="flex items-start gap-3.5">
                    <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] bg-ink-foreground/[0.12] text-[15px] font-extrabold text-teal-bright">+</span>
                    <div>
                      <div className="mb-1 text-[14.5px] font-bold">{t.title}</div>
                      <div className="text-[13px] leading-relaxed opacity-60">{t.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </InkPanel>

            {/* Snapshot */}
            {stats && (
              <section className="pb-[clamp(50px,9vh,90px)] pt-[clamp(36px,7vh,70px)]">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                  <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Your health snapshot</div>
                  <button onClick={() => setView('history')} className="text-[13.5px] font-bold text-accent hover:underline">See full record →</button>
                </div>
                <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <StatsCard label="Symptom checks so far" value={String(stats.totalCount)} sub="All time" />
                  <StatsCard label="In the last 30 days" value={String(stats.monthlyCount)} sub={`${stats.monthlyCount} recent`} subColor="#0E7569" />
                  <StatsCard label="Most results were" value={stats.topRisk} sub="Across your record" subColor="#0E7569" />
                </div>
              </section>
            )}
            {!stats && <div className="pb-[clamp(50px,9vh,90px)]" />}
          </motion.div>
        )}

        {/* ===== INPUT ===== */}
        {view === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-full max-w-[920px] px-4 pb-20 pt-[clamp(28px,6vh,56px)] md:px-6"
          >
            <Stepper active={stepIndex} className="mb-[clamp(28px,5vh,44px)]" />

            <h2 className="mb-2 text-[clamp(30px,5vw,54px)] font-extrabold leading-[1.02] tracking-[-0.02em]">
              How are you feeling{currentUser ? `, ${currentUser.name.split(' ')[0]}` : ''}?
            </h2>
            <p className="mb-6 text-[clamp(14.5px,1.7vw,17px)] text-muted-foreground">Describe it the way you'd tell a doctor — plain words are perfect.</p>

            <div className="overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card shadow-soft-lg focus-within:border-primary/40 transition-colors">
              <div className="p-[clamp(18px,3vw,26px)]">
                <MinimalTextarea
                  placeholder="Example: I woke up with a pounding headache on one side and bright light makes it worse..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  rows={5}
                />
                {selectedImage && (
                  <div className="relative mt-3 w-fit overflow-hidden rounded-lg border border-foreground/[0.1]">
                    <img src={selectedImage} alt="Attached symptom" className="h-32 object-cover" />
                    <button onClick={() => setSelectedImage(null)} className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-foreground hover:bg-background" aria-label="Remove image">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-foreground/[0.08] bg-foreground/[0.02] px-[clamp(14px,2.5vw,20px)] py-3">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn("inline-flex h-[42px] items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors", selectedImage ? "bg-accent/[0.12] text-accent" : "bg-foreground/[0.05] text-muted-foreground hover:bg-accent/[0.12] hover:text-accent")}
                  >
                    <Camera size={16} /> Photo
                  </button>
                  <button
                    type="button"
                    onClick={handleMicClick}
                    className={cn("inline-flex h-[42px] items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors", isListening ? "bg-accent/[0.12] text-accent blink" : "bg-foreground/[0.05] text-muted-foreground hover:bg-accent/[0.12] hover:text-accent")}
                  >
                    <Mic size={16} /> Voice
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>
                <Button size="default" magnetic onClick={handleSubmit} disabled={!symptoms && !selectedImage} className="h-12">
                  {(symptoms || selectedImage) ? 'Check my symptoms' : 'Write something first'} <ArrowRight size={16} />
                </Button>
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 text-[13px] font-bold text-muted-foreground/70">Not sure what to write? Try an example:</div>
              <div className="flex flex-wrap gap-2.5">
                {symptomPresets.map((p) => (
                  <SuggestionChip key={p.label} text={p.label} dot={p.dot} onClick={() => setSymptoms(p.label)} />
                ))}
              </div>
            </div>

            <button onClick={() => setView('welcome')} className="mt-8 inline-flex items-center gap-2 text-[13.5px] font-semibold text-muted-foreground/70 transition-colors hover:text-accent">
              <ArrowLeft size={14} /> Back to home
            </button>
          </motion.div>
        )}

        {/* ===== PROCESSING ===== */}
        {view === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto w-full max-w-[820px] px-4 pb-20 pt-[clamp(28px,6vh,56px)] md:px-6"
          >
            <Stepper active={stepIndex} className="mb-[clamp(28px,5vh,44px)]" />

            <h2 className="mb-2 text-[clamp(28px,4.6vw,48px)] font-extrabold leading-[1.02] tracking-[-0.02em]">
              Checking your symptoms<span className="blink text-primary">_</span>
            </h2>
            <p className="mb-7 text-[clamp(14.5px,1.7vw,17px)] text-muted-foreground">This usually takes about 10 seconds. Here's what's happening:</p>

            {/* ECG */}
            <div className="mb-4 overflow-hidden rounded-lg border border-foreground/[0.08] bg-card p-4 shadow-soft">
              <svg width="100%" height="52" viewBox="0 0 600 56" preserveAspectRatio="none" fill="none">
                <path d="M0 28 H120 L140 28 L150 8 L162 48 L172 28 H300 L320 28 L330 12 L342 44 L352 28 H480 L500 28 L510 6 L522 50 L532 28 H600" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="400" style={{ animation: 'ecgDash 2s linear infinite' }} />
              </svg>
            </div>

            <div className="flex flex-col gap-2.5">
              {agents.map((agent, i) => {
                const done = agent.status === 'complete';
                const working = agent.status === 'working';
                return (
                  <div key={i} className="flex items-center gap-4 rounded-lg border border-foreground/[0.07] bg-card p-4 shadow-soft">
                    <span className={cn(
                      "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl text-sm font-extrabold transition-colors",
                      done ? "bg-primary text-primary-foreground" : working ? "bg-ink text-ink-foreground" : "bg-foreground/[0.06] text-muted-foreground/60"
                    )}>
                      {done ? <Check size={16} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-[14.5px]", working ? "font-extrabold" : "font-semibold")}>{agent.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground/70">{agent.message}</div>
                    </div>
                    <span
                      className="shrink-0 font-mono text-[11px]"
                      style={{ color: done ? '#0E7569' : working ? '#D97706' : 'hsl(var(--muted-foreground) / 0.6)', animation: working ? 'pulse 1s ease-in-out infinite' : undefined }}
                    >
                      {done ? 'DONE' : working ? 'WORKING…' : 'WAITING'}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ===== RESULT ===== */}
        {view === 'result' && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mx-auto w-full max-w-[1040px] px-4 pb-20 pt-[clamp(28px,6vh,56px)] md:px-6"
          >
            <Stepper active={stepIndex} className="mb-[clamp(28px,5vh,44px)]" />

            {/* Guest banner */}
            {!currentUser && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/[0.07] bg-card px-5 py-3.5 shadow-soft">
                <span className="text-[13px] font-semibold text-muted-foreground">Saved on this device only</span>
                <Button variant="outline" size="sm" onClick={() => setView('auth')}>Sign in to keep it</Button>
              </div>
            )}

            {/* Emergency panel (location-aware) */}
            {result.riskScore >= 8 && (
              <div className="mb-5">
                <EmergencyCallPanel riskLevel={result.riskLevel} riskScore={result.riskScore} existingLocation={location} />
              </div>
            )}

            {/* Verdict header */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 anim-rise">
              <div>
                <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Our best assessment</div>
                <h2 className="text-[clamp(28px,4.6vw,52px)] font-extrabold leading-[1.02] tracking-[-0.02em]">{result.conditionTitle}</h2>
              </div>
              <SeverityTag level={result.riskLevel} className="px-5 py-3 text-[14.5px] anim-pop" />
            </div>

            <div id="triage-report-content" className="space-y-3.5">
              {/* What this means + urgency */}
              <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
                <Card className="anim-card" style={{ animationDelay: '0.1s' }}>
                  <div className="mb-3 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-accent">What this means</div>
                  <p className="text-[clamp(16px,1.9vw,19px)] font-semibold leading-snug">{result.summary}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{result.medicalAnalysis}</p>
                </Card>
                <Card className="anim-card" style={{ animationDelay: '0.2s' }}>
                  <div className="mb-3 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-accent">How urgent?</div>
                  <div className="text-[clamp(48px,6vw,64px)] font-extrabold leading-[0.95] tracking-[-0.02em]">
                    {result.riskScore}<span className="text-[22px] text-muted-foreground/40">/10</span>
                  </div>
                  <div className="mt-4"><RiskMeter score={result.riskScore} level={result.riskLevel} /></div>
                  <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{urgencyNote(result.riskScore)}</p>
                </Card>
              </div>

              {/* To-do + care */}
              <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
                <Card className="anim-card" style={{ animationDelay: '0.3s' }}>
                  <div className="mb-4 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-accent">What to do now — in order</div>
                  <ol className="flex flex-col">
                    {result.immediateActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-3.5 border-b border-foreground/[0.07] py-3 text-[14.5px] leading-snug last:border-b-0">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-accent/[0.1] text-[13px] font-extrabold text-accent">{i + 1}</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
                <Card className="anim-card" style={{ animationDelay: '0.4s' }}>
                  <div className="mb-4 flex items-center justify-between text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-accent">
                    <span>Find care nearby</span>
                    {loadingPlaces && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                  </div>
                  {nearbyPlaces.length > 0 ? (
                    <div className="flex flex-col">
                      {nearbyPlaces.slice(0, 4).map((place, i) => <PlaceRow key={i} place={place} index={i} />)}
                    </div>
                  ) : (
                    <p className="py-2 text-sm text-muted-foreground">
                      {loadingPlaces ? 'Searching…' : location ? 'No facilities found nearby.' : <>Turn on location in <button className="underline" onClick={() => setView('settings')}>Settings</button> to find care near you.</>}
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <Button variant="outline" size="sm" className="min-w-[130px] flex-1" onClick={handleShareReport}>
                      {showCopyFeedback ? <Clipboard size={14} /> : <Share2 size={14} />}
                      {showCopyFeedback ? 'Copied ✓' : 'Share with a doctor'}
                    </Button>
                    <Button variant="outline" size="sm" className="min-w-[110px] flex-1" onClick={startOver}>
                      <RotateCcw size={14} /> Start over
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Refine */}
              {result.clarifyingQuestions && result.clarifyingQuestions.length > 0 && (
                <Card className="anim-card" style={{ animationDelay: '0.5s' }}>
                  <div className="mb-1 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-accent">Sharpen this assessment</div>
                  <p className="mb-5 text-sm text-muted-foreground">
                    {refinedOnce ? "Assessment updated. Answer more if anything changes." : "A few details would make this more precise. Answer any that apply."}
                  </p>
                  <div className="space-y-4">
                    {result.clarifyingQuestions.map((q, i) => (
                      <div key={i} className="space-y-1.5">
                        <label className="block text-sm font-semibold leading-snug">{q}</label>
                        <textarea
                          value={clarifyingAnswers[i] || ''}
                          onChange={(e) => setClarifyingAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                          placeholder="Optional"
                          className="w-full resize-none rounded-md border border-foreground/[0.12] bg-background p-3 text-sm outline-none transition-colors placeholder:text-foreground/35 focus:border-primary"
                          rows={2}
                          disabled={isRefining}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex justify-end">
                    <Button onClick={handleRefineSubmit} disabled={isRefining || Object.values(clarifyingAnswers).every(v => !v || !String(v).trim())} loading={isRefining}>
                      {isRefining ? 'Updating…' : 'Update assessment'}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Consultant */}
              <InkPanel className="anim-card" style={{ animationDelay: '0.6s' }}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-foreground/[0.12] px-[clamp(18px,3vw,28px)] py-[18px]">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] bg-primary text-[15px] font-extrabold text-primary-foreground">+</span>
                      <span className="text-base font-extrabold">Still have questions?</span>
                    </div>
                    <div className="mt-1 text-[12.5px] opacity-55">Ask AURA anything about your result.</div>
                  </div>
                  <span className="font-mono text-[11px] text-teal-bright">● LIVE</span>
                </div>

                <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto px-[clamp(18px,3vw,28px)] py-5">
                  {chatHistory.map((msg, i) => <ChatBubble key={i} message={msg} />)}
                  {isChatLoading && <TypingIndicator />}
                  <div ref={chatEndRef} />
                </div>

                {result.suggestedFollowUpQuestions && result.suggestedFollowUpQuestions.length > 0 && !isChatLoading && (
                  <div className="flex flex-wrap gap-2 px-[clamp(18px,3vw,28px)] pb-4">
                    {result.suggestedFollowUpQuestions.map((q, i) => (
                      <SuggestionChip key={i} text={q} dark onClick={() => handleChatSubmit(q)} />
                    ))}
                  </div>
                )}

                {chatImage && (
                  <div className="px-[clamp(18px,3vw,28px)] pb-2">
                    <div className="relative w-fit">
                      <img src={chatImage} alt="Preview" className="h-14 rounded-lg border border-ink-foreground/20" />
                      <button onClick={() => setChatImage(null)} className="absolute -right-2 -top-2 rounded-full border border-ink-foreground/20 bg-ink p-0.5 text-ink-foreground" aria-label="Remove image"><X size={12} /></button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2.5 border-t border-ink-foreground/[0.12] px-[clamp(18px,3vw,28px)] py-4">
                  <button onClick={() => chatFileRef.current?.click()} className="inline-flex h-12 w-9 shrink-0 items-center justify-center text-ink-foreground/60 transition-colors hover:text-ink-foreground" aria-label="Attach an image"><Plus size={18} /></button>
                  <input type="file" ref={chatFileRef} className="hidden" accept="image/*" onChange={handleChatImageUpload} />
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
                    placeholder="Type your question…"
                    className="h-12 min-w-0 flex-1 rounded-full border border-ink-foreground/[0.12] bg-ink-foreground/[0.08] px-5 text-sm text-ink-foreground outline-none placeholder:text-ink-foreground/40"
                  />
                  <button
                    onClick={() => handleChatSubmit()}
                    disabled={(!chatInput.trim() && !chatImage) || isChatLoading}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-ink-foreground hover:text-ink disabled:opacity-45"
                    aria-label="Send"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </InkPanel>

              {/* Sources */}
              {result.citations && result.citations.length > 0 && (
                <Card className="anim-card">
                  <div className="mb-3 text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-accent">Sources</div>
                  <div className="space-y-2.5">
                    {result.citations.map((cite, i) => <CitationRow key={i} citation={cite} />)}
                  </div>
                </Card>
              )}
            </div>

            <p className="mt-5 max-w-[720px] text-[12.5px] leading-relaxed text-muted-foreground/70">
              <strong className="text-muted-foreground">Please note:</strong> {result.disclaimer || "AURA gives guidance, not a diagnosis. It's not a substitute for a doctor. If something feels seriously wrong, call your local emergency number — even if AURA says otherwise."}
            </p>
          </motion.div>
        )}

        {/* ===== HISTORY ===== */}
        {view === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-full max-w-[960px] px-4 pb-20 pt-[clamp(28px,6vh,56px)] md:px-6"
          >
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3.5">
              <div>
                <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Everything AURA knows, in one place</div>
                <h2 className="text-[clamp(30px,5vw,56px)] font-extrabold leading-none tracking-[-0.02em]">My record</h2>
              </div>
              <span className="rounded-full bg-accent/[0.1] px-4 py-2.5 text-[12.5px] font-bold text-accent">{sessions.length} past {sessions.length === 1 ? 'check' : 'checks'}</span>
            </div>

            {/* Profile card */}
            <Card interactive onClick={() => setView('profile')} className="mb-6 overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-foreground/[0.07] px-[clamp(16px,3vw,26px)] py-4">
                <span className="text-sm font-bold">My medical details <span className="font-medium text-muted-foreground">— what AURA considers</span></span>
                <span className="text-[13.5px] font-extrabold text-accent">Edit →</span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                {[
                  { title: 'Allergies', color: '#DC2626', chips: userProfile.allergies },
                  { title: 'Conditions', color: '#D97706', chips: userProfile.conditions },
                  { title: 'Medications', color: '#0E7569', chips: userProfile.medications },
                ].map((col) => (
                  <div key={col.title} className="px-[clamp(16px,3vw,26px)] py-[18px]">
                    <div className="mb-2.5 text-[12.5px] font-extrabold" style={{ color: col.color }}>{col.title}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {col.chips.slice(0, 3).map((c) => <Badge key={c}>{c}</Badge>)}
                      {col.chips.length === 0 && <span className="text-xs italic text-muted-foreground/60">None added</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="mb-3 text-[13px] font-bold text-muted-foreground/70">Past symptom checks — tap any to see the full result again:</div>
            {sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-foreground/[0.15] py-16 text-center">
                <p className="mb-4 text-muted-foreground">When you run an assessment, it shows up here.</p>
                <Button onClick={() => setView('input')} magnetic>Start an assessment</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sessions.map((session) => {
                  const s = riskStyle(session.result.riskLevel);
                  return (
                    <div
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className="group flex cursor-pointer items-center gap-[clamp(12px,2.5vw,22px)] rounded-lg border border-foreground/[0.07] bg-card px-[clamp(16px,3vw,26px)] py-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg"
                    >
                      <span className="inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[16px] text-[17px] font-extrabold" style={{ background: s.tint, color: s.hex }}>{session.result.riskScore}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 truncate text-[16.5px] font-bold">{session.result.conditionTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(session.timestamp).toLocaleDateString()} · {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <SeverityTag level={session.result.riskLevel} className="hidden shrink-0 sm:inline-flex" />
                      <button
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        onClick={(e) => deleteSession(e, session.id)}
                        aria-label="Delete assessment"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => setView('welcome')} className="mt-8 inline-flex items-center gap-2 text-[13.5px] font-semibold text-muted-foreground/70 transition-colors hover:text-accent">
              <ArrowLeft size={14} /> Back to home
            </button>
          </motion.div>
        )}

        {/* ===== PROFILE ===== */}
        {view === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-full max-w-[960px] px-4 pb-20 pt-[clamp(28px,6vh,56px)] md:px-6"
          >
            <div className="mb-7">
              <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Helps AURA give safer, smarter answers</div>
              <h2 className="mb-2 text-[clamp(30px,5vw,56px)] font-extrabold leading-none tracking-[-0.02em]">My medical details</h2>
              <p className="max-w-[600px] text-[clamp(14.5px,1.7vw,16.5px)] leading-relaxed text-muted-foreground">AURA checks every assessment against these — for example, flagging a medicine you're allergic to.</p>
            </div>

            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
              {/* ID card */}
              <InkPanel className="flex h-fit flex-col gap-1.5 p-[clamp(20px,3vw,30px)]">
                <div className="mb-3.5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-ink-foreground/10">
                  <UserIcon size={28} className="text-teal-bright" strokeWidth={1.5} />
                </div>
                <div className="text-[21px] font-extrabold">{currentUser ? currentUser.name : 'Guest User'}</div>
                <div className="text-[13px] opacity-55">{currentUser ? currentUser.email : 'Stored on this device only'}</div>
                {currentUser && currentUser.joinedAt && (
                  <div className="mt-4 flex justify-between border-t border-ink-foreground/[0.12] pt-4 text-[13px]">
                    <span className="opacity-55">Joined</span><span className="font-bold">{new Date(currentUser.joinedAt).toLocaleDateString()}</span>
                  </div>
                )}
                <div className={cn("flex justify-between text-[13px]", (currentUser && currentUser.joinedAt) ? "mt-2" : "mt-4 border-t border-ink-foreground/[0.12] pt-4")}>
                  <span className="opacity-55">Symptom checks</span><span className="font-bold">{sessions.length}</span>
                </div>
                {!currentUser && (
                  <button onClick={() => setView('auth')} className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-teal-bright/90 px-4 text-[13.5px] font-bold text-ink transition-colors hover:bg-teal-bright">
                    Sign in to sync
                  </button>
                )}
              </InkPanel>

              {/* Sections */}
              <div className="flex flex-col gap-3.5">
                {([
                  { title: 'Allergies', hint: 'Medicines, foods, or anything else you react to.', key: 'allergies' as const, input: inputAllergy, setInput: setInputAllergy, placeholder: 'e.g. Penicillin', color: '#DC2626' },
                  { title: 'Ongoing conditions', hint: 'Things like asthma, diabetes, or high blood pressure.', key: 'conditions' as const, input: inputCondition, setInput: setInputCondition, placeholder: 'e.g. Asthma', color: '#D97706' },
                  { title: 'Current medications', hint: 'Include the dose if you know it.', key: 'medications' as const, input: inputMedication, setInput: setInputMedication, placeholder: 'e.g. Lisinopril 10mg', color: '#0E7569' },
                ]).map((sec) => (
                  <Card key={sec.key} className="p-[clamp(18px,2.6vw,26px)]">
                    <div className="mb-1 flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: sec.color }} />
                      <h3 className="text-[15.5px] font-bold">{sec.title}</h3>
                    </div>
                    <p className="mb-3.5 ml-5 text-[12.5px] text-muted-foreground/70">{sec.hint}</p>
                    <div className="mb-3 flex gap-2">
                      <Input
                        placeholder={sec.placeholder}
                        value={sec.input}
                        onChange={(e) => sec.setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addProfileItem(sec.key, sec.input)}
                        className="rounded-[14px]"
                      />
                      <button onClick={() => addProfileItem(sec.key, sec.input)} className="inline-flex h-12 shrink-0 items-center rounded-[14px] bg-primary px-5 text-[13.5px] font-bold text-primary-foreground transition-colors hover:bg-ink hover:text-ink-foreground">Add</button>
                    </div>
                    <div className="flex min-h-[24px] flex-wrap gap-2">
                      {userProfile[sec.key].map((item, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] py-1.5 pl-3 pr-2 text-[12.5px] font-semibold">
                          {item}
                          <button onClick={() => removeProfileItem(sec.key, i)} className="p-0.5 text-destructive transition-colors hover:text-foreground" aria-label={`Remove ${item}`}><X size={13} /></button>
                        </span>
                      ))}
                      {userProfile[sec.key].length === 0 && <span className="text-[13px] italic text-muted-foreground/60">None added yet.</span>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <button onClick={() => setView('welcome')} className="mt-8 inline-flex items-center gap-2 text-[13.5px] font-semibold text-muted-foreground/70 transition-colors hover:text-accent">
              <ArrowLeft size={14} /> Back to home
            </button>
          </motion.div>
        )}

        {/* ===== EMR (encrypted medical record) ===== */}
        {view === 'emr' && (
          <EmrView token={localStorage.getItem('aura_token')} onBack={() => setView('welcome')} />
        )}

        {/* ===== SETTINGS ===== */}
        {view === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-full max-w-[680px] px-4 pb-20 pt-[clamp(28px,6vh,56px)] md:px-6"
          >
            <div className="mb-7">
              <h2 className="mb-2 text-[clamp(30px,5vw,56px)] font-extrabold leading-none tracking-[-0.02em]">Settings</h2>
              <p className="text-[clamp(14.5px,1.7vw,16.5px)] text-muted-foreground">Your location is only used to find care near you.</p>
            </div>

            <Card>
              <div className="mb-4 text-sm font-extrabold">Location</div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-5 py-4">
                <div>
                  <div className="mb-1 text-xs text-muted-foreground/70">Currently set to</div>
                  <div className="text-xl font-extrabold">{isLocating ? 'Finding you…' : (location ? (locationName || 'Detected via GPS') : 'Not set')}</div>
                </div>
                {location && <span className="font-mono text-[10.5px] text-muted-foreground/50">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>}
              </div>
              <Button className="mb-3 w-full" onClick={refreshLocation} disabled={isLocating}>
                {isLocating && <Loader2 size={14} className="animate-spin" />} Use my current location
              </Button>
              <div className="flex gap-2">
                <Input
                  placeholder="Or type a city or zip code"
                  value={manualLocationInput}
                  onChange={(e) => setManualLocationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualLocation()}
                  className="rounded-full px-5"
                />
                <Button variant="outline" onClick={handleManualLocation} disabled={isLocating || !manualLocationInput}>Set</Button>
              </div>
            </Card>

            <Card className="mt-3.5">
              <div className="mb-2.5 text-sm font-extrabold">Account</div>
              {currentUser ? (
                <div className="space-y-4">
                  <div className="text-sm"><div className="font-bold">{currentUser.name}</div><div className="text-muted-foreground">{currentUser.email}</div></div>
                  <Button variant="outline" className="w-full" onClick={logoutUser}><LogOut size={14} /> Log out</Button>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">Right now your record lives only on this device. Sign in to keep it safe and see it on your phone too.</p>
                  <Button className="w-full" onClick={() => setView('auth')}><LogIn size={14} /> Create a free account</Button>
                </>
              )}
            </Card>

            {/* Admin analytics */}
            {isAdmin && adminStats && (
              <Card className="mt-3.5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-accent">Platform analytics</span>
                  <button onClick={loadAdminStats} disabled={adminStatsLoading} className="text-muted-foreground transition-colors hover:text-foreground">
                    {adminStatsLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total visitors', value: adminStats.overview.totalUniqueVisitors },
                    { label: 'Active today', value: adminStats.overview.dau },
                    { label: 'This week', value: adminStats.overview.wau },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-foreground/[0.03] p-3 text-center">
                      <div className="text-xl font-extrabold tabular-nums">{value}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-foreground/[0.07] pt-4 text-center text-sm">
                  <div className="flex flex-col gap-1"><span className="text-lg font-extrabold tabular-nums">{adminStats.triages.guest}</span><span className="text-xs text-muted-foreground">Guest</span></div>
                  <div className="flex flex-col gap-1"><span className="text-lg font-extrabold tabular-nums">{adminStats.triages.authenticated}</span><span className="text-xs text-muted-foreground">Signed in</span></div>
                  <div className="flex flex-col gap-1"><span className="text-lg font-extrabold tabular-nums">{adminStats.triages.total}</span><span className="text-xs text-muted-foreground">Total</span></div>
                </div>
                <div className="mt-4 flex items-center gap-4 border-t border-foreground/[0.07] pt-4">
                  <div className="text-3xl font-extrabold tabular-nums">{adminStats.conversion.ratePercent}%</div>
                  <div className="text-xs leading-relaxed text-muted-foreground">{adminStats.conversion.converted} of {adminStats.conversion.guestTriageVisitors} guest triagers registered</div>
                </div>
              </Card>
            )}

            <button onClick={() => setView('welcome')} className="mt-8 inline-flex items-center gap-2 text-[13.5px] font-semibold text-muted-foreground/70 transition-colors hover:text-accent">
              <ArrowLeft size={14} /> Back to home
            </button>
          </motion.div>
        )}
      </>
    );
  }
};

export default App;
