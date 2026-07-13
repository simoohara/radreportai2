import { useState, useEffect, useRef } from 'react';

export function LandingPage() {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEmailLoading(true);
    try {
      const res = await fetch('/auth/magiclink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setEmailSent(true);
      }
    } catch {
      // Silent fail
    }
    setEmailLoading(false);
  };

  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🩻 Intelligence Artificielle pour la Radiologie</div>
          <h1 className="hero-title">
            Rédigez vos comptes rendus
            <br />
            <span className="hero-gradient">en quelques secondes</span>
          </h1>
          <p className="hero-subtitle">
            Dictez vos observations, choisissez un modèle, et laissez l'IA générer
            un rapport radiologique professionnel et structuré.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={handleGoogleLogin}>
              <GoogleIcon />
              Continuer avec Google
            </button>

            <div className="divider">
              <span>ou</span>
            </div>

            {!emailSent ? (
              <form className="magic-link-form" onSubmit={handleMagicLink}>
                <input
                  className="input"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button className="btn btn-secondary" type="submit" disabled={emailLoading}>
                  {emailLoading ? 'Envoi...' : 'Lien magique ✨'}
                </button>
              </form>
            ) : (
              <div className="magic-link-success">
                ✅ Lien envoyé ! Vérifiez votre boîte de réception.
              </div>
            )}
          </div>
        </div>

        <div className="hero-demo">
          <TypewriterDemo />
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <h2 className="section-title">Comment ça marche</h2>
        <div className="features-grid">
          <FeatureCard
            icon="🎙️"
            title="Dictez"
            description="Enregistrez vos observations par la voix. La transcription IA reconnaît la terminologie médicale."
          />
          <FeatureCard
            icon="📋"
            title="Choisissez un modèle"
            description="25+ modèles spécialisés : Radio, TDM, IRM, Écho. Ou créez les vôtres."
          />
          <FeatureCard
            icon="⚡"
            title="Générez"
            description="L'IA intègre vos notes dans le modèle et surligne les résultats pathologiques."
          />
          <FeatureCard
            icon="📄"
            title="Copiez"
            description="Copiez le rapport final dans votre PACS en un clic. Formaté et prêt à signer."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© {new Date().getFullYear()} Rad Report AI — Propulsé par Gemini</p>
      </footer>

      <style>{landingStyles}</style>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

function TypewriterDemo() {
  const [displayText, setDisplayText] = useState('');
  const [phase, setPhase] = useState<'notes' | 'report'>('notes');
  const indexRef = useRef(0);

  const NOTES_TEXT = 'Poumons clairs. Pas de condensation. Médiastin normal. Pas d\'épanchement pleural...';
  const REPORT_TEXT = '<strong>RÉSULTATS :</strong>\nParenchyme pulmonaire homogène sans foyer de condensation.\nMédiastin de taille normale.\nAbsence d\'épanchement pleural.\n\n<strong>CONCLUSION :</strong>\nRadiographie thoracique sans anomalie.';

  useEffect(() => {
    const text = phase === 'notes' ? NOTES_TEXT : REPORT_TEXT;
    indexRef.current = 0;
    setDisplayText('');

    const interval = setInterval(() => {
      indexRef.current++;
      if (indexRef.current <= text.length) {
        setDisplayText(text.substring(0, indexRef.current));
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setPhase((p) => (p === 'notes' ? 'report' : 'notes'));
        }, 3000);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div className="demo-container">
      <div className="demo-header">
        <span className="demo-dot demo-dot-red" />
        <span className="demo-dot demo-dot-yellow" />
        <span className="demo-dot demo-dot-green" />
        <span className="demo-label">
          {phase === 'notes' ? '🎙️ Notes brutes' : '📄 Rapport généré'}
        </span>
      </div>
      <div className="demo-body">
        {phase === 'report' ? (
          <div dangerouslySetInnerHTML={{ __html: displayText.replace(/\n/g, '<br/>') }} />
        ) : (
          <span>{displayText}</span>
        )}
        <span className="demo-cursor">|</span>
      </div>
    </div>
  );
}

const landingStyles = `
.landing {
  min-height: 100vh;
  overflow-y: auto;
}

/* ─── Hero ────────────────────────────────── */
.hero {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 60px;
  padding: 80px 40px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 90vh;
}

.hero-badge {
  display: inline-block;
  padding: 6px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 100px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.15;
  margin-bottom: 20px;
}

.hero-gradient {
  background: linear-gradient(135deg, #0A84FF, #6C63FF, #AF52DE);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.1rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  max-width: 480px;
  margin-bottom: 32px;
}

.hero-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 400px;
}

.btn-lg {
  padding: 14px 28px;
  font-size: 16px;
  font-weight: 600;
}

.divider {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--color-text-tertiary);
  font-size: 13px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.magic-link-form {
  display: flex;
  gap: 8px;
}

.magic-link-form .input {
  flex: 1;
}

.magic-link-success {
  padding: 12px 16px;
  background: rgba(48, 209, 88, 0.15);
  border-radius: var(--radius-md);
  color: var(--color-success);
  font-weight: 500;
  font-size: 14px;
}

/* ─── Demo ────────────────────────────────── */
.hero-demo {
  flex-shrink: 0;
  width: 480px;
}

.demo-container {
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.demo-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.demo-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
.demo-dot-red { background: #ff5f57; }
.demo-dot-yellow { background: #febc2e; }
.demo-dot-green { background: #28c840; }

.demo-label {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.demo-body {
  padding: 24px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  min-height: 200px;
  color: var(--color-text);
}

.demo-cursor {
  animation: pulse 1s step-end infinite;
  color: var(--color-accent);
  font-weight: 700;
}

/* ─── Features ────────────────────────────── */
.features {
  padding: 80px 40px;
  max-width: 1000px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 48px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.feature-card {
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 28px;
  text-align: center;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.feature-icon {
  font-size: 36px;
  margin-bottom: 16px;
}

.feature-card h3 {
  font-size: 1rem;
  margin-bottom: 8px;
}

.feature-card p {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* ─── Footer ──────────────────────────────── */
.landing-footer {
  text-align: center;
  padding: 40px;
  color: var(--color-text-tertiary);
  font-size: 13px;
  border-top: 1px solid var(--color-border);
}

/* ─── Responsive ──────────────────────────── */
@media (max-width: 900px) {
  .hero {
    flex-direction: column;
    padding: 40px 20px;
    text-align: center;
    min-height: auto;
  }

  .hero-title { font-size: 2rem; }
  .hero-subtitle { margin: 0 auto 32px; }
  .hero-actions { width: 100%; max-width: 360px; margin: 0 auto; }
  .hero-demo { width: 100%; max-width: 480px; }

  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .features-grid {
    grid-template-columns: 1fr;
  }

  .magic-link-form {
    flex-direction: column;
  }
}
`;
