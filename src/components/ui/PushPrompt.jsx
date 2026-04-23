import { useState, useEffect } from 'react';
import { subscribeToPush } from '../../lib/notifications';

const DISMISS_KEY = 'push_prompt_dismissed';

export default function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      'Notification' in window &&
      Notification.permission === 'default' &&
      !localStorage.getItem(DISMISS_KEY)
    ) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  async function handleEnable() {
    setLoading(true);
    const result = await subscribeToPush();
    setLoading(false);
    if (result) {
      setVisible(false);
    } else {
      // Permission denied or not supported — dismiss silently
      localStorage.setItem(DISMISS_KEY, '1');
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  return (
    <div className="push-prompt" role="status">
      <div className="push-prompt__text">
        <span className="push-prompt__icon" aria-hidden="true">🔔</span>
        <span>Get notified when your opponent checks in</span>
      </div>
      <div className="push-prompt__actions">
        <button className="push-prompt__enable" onClick={handleEnable} disabled={loading}>
          {loading ? 'Enabling…' : 'Enable'}
        </button>
        <button className="push-prompt__dismiss" onClick={handleDismiss} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
