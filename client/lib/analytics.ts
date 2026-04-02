const VISITOR_ID_KEY = 'aura_visitor_id';

export const getOrCreateVisitorId = (): string => {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
};

type AnalyticsEvent = 'page_view' | 'triage_completed' | 'account_registered' | 'guest_converted';

export const trackEvent = (event: AnalyticsEvent, isAuthenticated: boolean): void => {
  // Fire-and-forget — analytics must never block or error the UI
  try {
    const visitorId = getOrCreateVisitorId();
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, visitorId, isAuthenticated })
    }).catch(() => {/* intentionally swallowed */});
  } catch {
    // intentionally swallowed
  }
};
