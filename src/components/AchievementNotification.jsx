/**
 * AchievementNotification.jsx — Achievement unlock notification overlay.
 *
 * Displays a toast-style notification when an achievement is unlocked.
 * Fades in from the right, shows for 6 seconds, then fades out.
 */
import { useEffect, useState } from 'react';

/**
 * Single achievement toast notification.
 * @param {object} props
 * @param {object} props.notification - Achievement notification data
 * @param {function} props.onDismiss - Call when notification should be removed
 */
function AchievementToast({ notification, onDismiss }) {
  const [opacity, setOpacity] = useState(0);
  const [timer, setTimer] = useState(notification.timer || 6);

  useEffect(() => {
    // Fade in
    const fadeIn = setTimeout(() => setOpacity(1), 50);

    // Auto dismiss after timer
    const dismiss = setTimeout(() => {
      setOpacity(0);
      setTimeout(onDismiss, 300); // Wait for fade out
    }, (notification.timer || 6) * 1000);

    // Periodic timer update
    const tick = setInterval(() => {
      setTimer(t => Math.max(0, t - 1));
    }, 1000);

    return () => {
      clearTimeout(fadeIn);
      clearTimeout(dismiss);
      clearInterval(tick);
    };
  }, []);

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

/**
 * AchievementNotification component.
 * Renders a stack of achievement notifications.
 * @param {object} props
 * @param {object} props.game - Game ref
 * @param {boolean} props.visible - Whether to show notifications
 */
export default function AchievementNotification({ game, visible }) {
  if (!visible || !game?.current?.achievements?.notifications?.length) {
    return null;
  }

  const notifications = game.current.achievements.notifications;

  const dismissNotification = (index) => {
    if (game.current.achievements.notifications) {
      game.current.achievements.notifications.splice(index, 1);
    }
  };

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
          key={notif.id + '-' + i}
          notification={notif}
          onDismiss={() => dismissNotification(i)}
        />
      ))}
    </div>
  );
}
