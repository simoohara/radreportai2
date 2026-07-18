const SOCIAL_LINKS = [
  { name: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61580091680851' },
  { name: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/radreportai/' },
  { name: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@radreportai' },
  { name: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@RadReportAI' },
] as const;

function SocialIcon({ name }: { name: (typeof SOCIAL_LINKS)[number]['name'] }) {
  if (name === 'facebook') {
    return <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.75l.4-3H13.5V8.1c0-.87.24-1.46 1.5-1.46h1.78V3.95c-.3-.04-1.35-.13-2.56-.13-2.54 0-4.28 1.55-4.28 4.4V10H7v3h2.94v8h3.56Z" /></svg>;
  }
  if (name === 'instagram') {
    return <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.4" cy="6.7" r="1.15" /></svg>;
  }
  if (name === 'tiktok') {
    return <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3c.45 2.45 1.82 4.02 4.5 4.2v3.03a8.63 8.63 0 0 1-4.47-1.32v6.26A5.84 5.84 0 1 1 10.2 9.34v3.14a2.76 2.76 0 1 0 2.27 2.72V3h3.03Z" /></svg>;
  }
  return <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.58 7.19a2.97 2.97 0 0 0-2.1-2.1C17.63 4.6 12 4.6 12 4.6s-5.63 0-7.48.5a2.97 2.97 0 0 0-2.1 2.09C1.92 9.04 1.92 12 1.92 12s0 2.96.5 4.81a2.97 2.97 0 0 0 2.1 2.1c1.85.5 7.48.5 7.48.5s5.63 0 7.48-.5a2.97 2.97 0 0 0 2.1-2.1c.5-1.85.5-4.81.5-4.81s0-2.96-.5-4.81ZM10.2 14.95V9.05L15.32 12l-5.12 2.95Z" /></svg>;
}

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="landing-social-links" aria-label="Suivez Rad Report AI">
        <span>Suivez-nous</span>
        <div className="social-icon-list">
          {SOCIAL_LINKS.map((social) => (
            <a
              key={social.name}
              className="social-icon-link"
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Rad Report AI sur ${social.label}`}
              title={social.label}
            >
              <SocialIcon name={social.name} />
            </a>
          ))}
        </div>
      </div>
      <p>© {new Date().getFullYear()} Rad Report AI — Propulsé par Gemini</p>
    </footer>
  );
}
