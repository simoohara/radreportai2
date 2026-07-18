import type { Env, User } from '../types';

/**
 * Sends a notification to a Telegram chat about a new user signup.
 * This is a fire-and-forget function; it won't block the main thread and will silently fail if not configured.
 * @param env The Cloudflare worker environment variables
 * @param user The user object containing display_name and email
 */
export const sendNewUserAlert = async (env: Env, user: Partial<User>) => {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.warn('Telegram notification service is not configured. Skipping new user alert.');
    return;
  }

  const displayName = user.display_name || 'N/A';
  const email = user.email || 'N/A';

  const message = `🎉 *New User Signup on Rad Report AI* 🎉\n\n*Name:* Dr. ${displayName}\n*Email:* ${email}`;
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Failed to send Telegram notification:', errorData);
    } else {
      console.log(`Telegram notification sent for new user: ${email}`);
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
};
