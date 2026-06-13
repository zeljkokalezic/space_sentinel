/**
 * AchievementNotification.tsx — Achievement unlock notification overlay.
 *
 * Displays a toast-style notification when an achievement is unlocked.
 * Fades in from the right, shows for 6 seconds, then fades out.
 *
 * Re-renders are driven by `notificationVersion` (bumped by the physics loop
 * when new notifications are pushed, and by the component on dismiss).
 * No polling required.
 */
import { useEffect, useState, useRef } from 'react';
import type { GameRef } from './types';

interface AchievementNotificationData {
  id: string;
  title: string;
  description: string;
  icon: string;
  timer?: number;
}

interface AchievementToastProps {
  notification: AchievementNotificationData;
  onDismiss: () => void;
}

function AchievementToast({ notification, onDismiss }: AchievementToastProps) {
  const [opacity, setOpacity] = useState(0);
  const [timer, setTimer] = useState(notification.timer || 6);
  const fadeOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fade in
    const fadeIn = setTimeout(() => setOpacity(1), 50);

    // Auto dismiss after timer
    const dismiss = setTimeout(() => {
      setOpacity(0);
      fadeOutRef.current = setTimeout(onDismiss, 300); // Wait for fade out
    }, (notification.timer || 6) * 1000);

    // Periodic timer update
    const tick = setInterval(() => {
      setTimer(t => Math.max(0, t - 1));
    }, 1000);

    return () => {
      clearTimeout(fadeIn);
      clearTimeout(dismiss);
      if (fadeOutRef.current) clearTimeout(fadeOutRef.current);
      clearInterval(tick);
    };
  }, [notification.timer, onDismiss]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: 'rgba(10, 10, 20, 0.95)',
        border: '1px solid rgba(57, 255, 20, 0.4)',
        borderRadius: '8px',
        boxShadow: '0 0 20px rgba(57, 255, 20, 0.2)',
        opacity,
        transform: `translateX(0)`,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        minWidth: '280px',
        maxWidth: '350px',
      }}
    >
      <span style={{ fontSize: '28px' }}>{notification.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{
          color: '#39ff14',
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '2px',
        }}>
          Achievement Unlocked
        </div>
        <div style={{
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 'bold',
        }}>
          {notification.title}
        </div>
        <div style={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '12px',
        }}>
          {notification.description}
        </div>
      </div>
      <div style={{
        color: 'rgba(57, 255, 20, 0.5)',
        fontSize: '11px',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {timer}s
      </div>
    </div>
  );
}

interface AchievementNotificationProps {
  game: GameRef;
  visible: boolean;
  notificationVersion: number;
  onBumpNotification: (updater: (v: number) => number) => void;
}

export default function AchievementNotification({ game, visible, notificationVersion, onBumpNotification }: AchievementNotificationProps) {
  if (!visible) {
    return null;
  }

  const notifications = (game.current?.achievements?.notifications || []) as unknown as AchievementNotificationData[];

  if (notifications.length === 0) {
    return null;
  }

  const dismissNotification = (id: string) => {
    const live = game.current?.achievements?.notifications as unknown as AchievementNotificationData[] | undefined;
    if (!live) return;
    const idx = live.findIndex((n: AchievementNotificationData) => n.id === id);
    if (idx !== -1) live.splice(idx, 1);
    onBumpNotification(v => v + 1);
  };

  // Force key change on version bump so new toasts get fresh fade-in state
  return (
    <div style={{
      position: 'absolute',
      top: '80px',
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      {notifications.map((notif, i) => (
        <AchievementToast
          key={notificationVersion + '-' + notif.id + '-' + i}
          notification={notif}
          onDismiss={() => dismissNotification(notif.id)}
        />
      ))}
    </div>
  );
}
