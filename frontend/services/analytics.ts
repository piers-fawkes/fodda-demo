const getSessionId = (): string => {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('fodda_session_id');
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('fodda_session_id', sid);
  }
  return sid;
};

export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    const enrichedParams = { ...params, session_id: getSessionId() };

    // Push to GTM dataLayer
    // @ts-ignore
    window.dataLayer = window.dataLayer || [];
    // @ts-ignore
    window.dataLayer.push({
      event: eventName,
      ...enrichedParams,
    });

    // Push to GA4 directly
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', eventName, enrichedParams);
    }
  }
};
