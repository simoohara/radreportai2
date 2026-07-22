import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { Link } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════
   Custom hook — IntersectionObserver-based scroll reveal
   ═══════════════════════════════════════════════════════ */
function useScrollReveal(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(el); } },
      { threshold: 0.15, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, isVisible };
}

/* ═══════════════════════════════════════════════════════
   Data constants
   ═══════════════════════════════════════════════════════ */
const SOCIAL_LINKS = [
  { name: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61580091680851' },
  { name: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/@radreportai/' },
  { name: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@radreportai' },
  { name: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@RadReportAI' },
] as const;



/* ─── AnimatedDemo data ─── */
const ANIMATED_DEMO_NOTES = "hématome sous-dural aigu gauche\n10 mm d'épaisseur max\nrefoulement des structures médianes de 4 mm vers la droite.";

const ANIMATED_DEMO_TEMPLATE = `<div class="demo-report-study">TDM CÉRÉBRALE SANS INJECTION</div>
<section class="demo-report-section"><h3>INDICATION</h3><p>[Indication clinique]</p></section>
<section class="demo-report-section"><h3>TECHNIQUE</h3><p>Acquisition volumique sans injection de produit de contraste. Reconstructions axiales, coronales et sagittales.</p></section>
<section class="demo-report-section"><h3>RÉSULTATS</h3>
<p><strong>Parenchyme cérébral :</strong> [Description]</p>
<p><strong>Espaces liquidiens :</strong> [Description]</p>
<p><strong>Structures médianes :</strong> [Description]</p>
<p><strong>Os et parties molles :</strong> [Description]</p>
</section>
<section class="demo-report-section conclusion"><h3>CONCLUSION</h3><p>[Conclusion]</p></section>`;

const ANIMATED_DEMO_FINAL = `<div class="demo-report-study">TDM CÉRÉBRALE SANS INJECTION</div>
<section class="demo-report-section"><h3>INDICATION</h3><p>Traumatisme crânien récent.</p></section>
<section class="demo-report-section"><h3>TECHNIQUE</h3><p>Acquisition volumique sans injection de produit de contraste, avec reconstructions multiplanaires.</p></section>
<section class="demo-report-section"><h3>RÉSULTATS</h3>
<p><strong>Parenchyme cérébral :</strong> <mark>Hématome sous-dural aigu fronto-pariétal gauche, mesurant 10 mm d'épaisseur maximale.</mark></p>
<p><strong>Espaces liquidiens :</strong> Citernes de la base libres.</p>
<p><strong>Structures médianes :</strong> <mark>Refoulement de la ligne médiane de 4 mm vers la droite</mark>, témoignant d'un effet de masse modéré.</p>
<p><strong>Os et parties molles :</strong> Absence de fracture osseuse visible sur les coupes acquises.</p>
</section>
<section class="demo-report-section conclusion"><h3>CONCLUSION</h3><p><mark>Hématome sous-dural aigu gauche avec effet de masse modéré.</mark> Corrélation clinique et avis neurochirurgical recommandés.</p></section>`;

/* ═══════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════ */
export function LandingPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  /* Sticky CTA visibility */
  const [showStickyCta, setShowStickyCta] = useState(false);
  const featuresRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = featuresRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(entry.isIntersecting),
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToConnexion = useCallback(() => {
    document.getElementById('connexion')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  /* ─── Auth handlers (preserved exactly) ─── */
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEmailLoading(true);
    try {
      const referralCode = new URLSearchParams(window.location.search).get('ref');
      const res = await fetch('/auth/magiclink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ref: referralCode }),
      });
      if (res.ok) {
        setEmailSent(true);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        toast.error(data.error || "Impossible d'envoyer le lien de connexion.");
      }
    } catch {
      toast.error("Impossible de joindre le service de connexion.");
    }
    setEmailLoading(false);
  };

  const handleGoogleLogin = () => {
    const referralCode = new URLSearchParams(window.location.search).get('ref');
    window.location.href = referralCode
      ? `/auth/google?ref=${encodeURIComponent(referralCode)}`
      : '/auth/google';
  };

  /* ─── Scroll reveal refs ─── */
  const heroReveal = useScrollReveal();
  const howItWorksReveal = useScrollReveal();
  const featuresReveal = useScrollReveal();
  const testimonialReveal = useScrollReveal();

  return (
    <div className="landing">
      {/* ─── Nav ─── */}
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Rad Report AI — accueil">
          <img src="/favicon.png" alt="" width="24" height="24" style={{ borderRadius: '4px' }} />
          <span>Rad Report AI</span>
        </a>
        <nav className="landing-nav-actions" aria-label="Navigation principale">
          <Link to="/comment-ca-marche" className="nav-link-hide-mobile">Comment ça marche</Link>
          <button className="nav-glass-btn" onClick={scrollToConnexion}>
            Se connecter
          </button>
        </nav>
      </header>

      {/* ─── Hero ─── */}
      <section className="hero" id="top">
        <div className="hero-bg-mesh" aria-hidden="true" />
        <div
          ref={heroReveal.ref}
          className={`hero-inner ${heroReveal.isVisible ? 'revealed' : ''}`}
        >
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

            <div className="hero-actions" id="connexion">
              <button className="btn btn-primary btn-lg" onClick={handleGoogleLogin}>
                <GoogleIcon />
                Continuer avec Google
              </button>

              <div className="divider"><span>ou</span></div>

              {!emailSent ? (
                <form className="magic-link-form" onSubmit={handleMagicLink}>
                  <input
                    className="input"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-label="Adresse email"
                  />
                  <button className="btn btn-secondary" type="submit" disabled={emailLoading}>
                    {emailLoading ? 'Envoi...' : 'Lien magique ✨'}
                  </button>
                </form>
              ) : (
                <div className="magic-link-success" role="status">
                  ✅ Lien envoyé ! Vérifiez votre boîte de réception.
                </div>
              )}
            </div>
          </div>

          <div className="hero-demo">
            <AnimatedDemo onGetStarted={scrollToConnexion} />
          </div>
        </div>
      </section>


      {/* ─── How it works ─── */}
      <section
        className="how-it-works"
        id="how-it-works"
        ref={howItWorksReveal.ref}
        aria-labelledby="how-title"
      >
        <div className={`scroll-reveal ${howItWorksReveal.isVisible ? 'revealed' : ''}`}>
          <h2 className="section-title" id="how-title">Comment ça marche</h2>
        </div>
        <div className="how-steps">
          {[
            { icon: '🎙️', num: '1', title: 'Dictez vos observations', desc: 'Enregistrez ou tapez vos observations cliniques. La transcription IA reconnaît la terminologie médicale.' },
            { icon: '✨', num: '2', title: 'Générez en 1 clic', desc: 'L\'IA intègre vos notes dans le modèle choisi et surligne les résultats pathologiques.' },
            { icon: '📋', num: '3', title: 'Copiez dans votre PACS', desc: 'Copiez le rapport final dans votre PACS en un clic. Formaté, structuré et prêt à signer.' },
          ].map((step, i) => (
            <div
              key={step.num}
              className={`how-step scroll-reveal stagger-${i} ${howItWorksReveal.isVisible ? 'revealed' : ''}`}
            >
              <div className="how-step-icon-wrap">
                <span className="how-step-num">{step.num}</span>
                <span className="how-step-icon">{step.icon}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              {i < 2 && <div className="how-step-connector" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section
        className="features"
        id="features"
        ref={(el) => {
          // Combine both refs
          (featuresRef as React.MutableRefObject<HTMLElement | null>).current = el;
          (featuresReveal.ref as React.MutableRefObject<HTMLDivElement | null>).current = el as HTMLDivElement | null;
        }}
        aria-labelledby="features-title"
      >
        <div className={`scroll-reveal ${featuresReveal.isVisible ? 'revealed' : ''}`}>
          <h2 className="section-title" id="features-title">Tout ce dont vous avez besoin</h2>
        </div>
        <div className="features-grid">
          {[
            { icon: '🎙️', title: 'Dictée vocale', desc: 'Enregistrez vos observations par la voix. La transcription IA reconnaît la terminologie médicale.' },
            { icon: '📋', title: '25+ modèles', desc: 'Radio, TDM, IRM, Écho — des modèles spécialisés prêts à l\'emploi. Ou créez les vôtres.' },
            { icon: '⚡', title: 'Génération IA', desc: 'L\'IA intègre vos notes dans le modèle et surligne les résultats pathologiques automatiquement.' },
            { icon: '🔒', title: 'Sécurisé', desc: 'Vos données restent privées. Connexion sécurisée, aucune donnée patient n\'est stockée.' },
            { icon: '📄', title: 'Export PACS', desc: 'Copiez le rapport final dans votre PACS en un clic. Formaté et prêt à signer.' },
            { icon: '🌙', title: 'Mode sombre', desc: 'Interface optimisée pour les longues sessions d\'interprétation en salle de lecture.' },
          ].map((f, i) => (
            <div
              key={f.title}
              className={`feature-card scroll-reveal stagger-${i} ${featuresReveal.isVisible ? 'revealed' : ''}`}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Testimonial ─── */}
      <section
        className="testimonial-section"
        ref={testimonialReveal.ref}
        aria-label="Témoignage"
      >
        <div className={`testimonial-card scroll-reveal ${testimonialReveal.isVisible ? 'revealed' : ''}`}>
          <div className="testimonial-quote" aria-hidden="true">"</div>
          <blockquote>
            <p>
              Rad Report AI a divisé mon temps de dictée par deux.
              C'est simple, rapide et incroyablement précis.
            </p>
            <footer>
              <cite>— Dr. Emilie Dubois, Radiologue</cite>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
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

      {/* ─── Sticky CTA bar ─── */}
      <div className={`sticky-cta ${showStickyCta ? 'sticky-cta-visible' : ''}`} aria-hidden={!showStickyCta}>
        <span className="sticky-cta-text">Prêt à gagner des heures chaque semaine ?</span>
        <button className="btn btn-primary btn-sm" onClick={scrollToConnexion}>
          Essayer Gratuitement
        </button>
      </div>

      <style>{landingStyles}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   AnimatedDemo — multi-phase animated walkthrough
   ═══════════════════════════════════════════════════════ */
type DemoPhase = 'typing' | 'waitForTemplate' | 'templateLoaded' | 'generating' | 'done';

function AnimatedDemo({ onGetStarted }: { onGetStarted: () => void }) {
  const [phase, setPhase] = useState<DemoPhase>('typing');
  const [notesText, setNotesText] = useState('');
  const [reportHtml, setReportHtml] = useState('');
  const indexRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  /* Phase 1: Typewriter */
  useEffect(() => {
    if (phase !== 'typing') return;
    indexRef.current = 0;
    setNotesText('');
    const text = ANIMATED_DEMO_NOTES;

    timerRef.current = window.setInterval(() => {
      indexRef.current++;
      if (indexRef.current <= text.length) {
        setNotesText(text.substring(0, indexRef.current));
      } else {
        window.clearInterval(timerRef.current!);
        timerRef.current = null;
        // Small delay then move to next phase
        window.setTimeout(() => setPhase('waitForTemplate'), 600);
      }
    }, 40);

    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [phase]);

  const handleLoadTemplate = () => {
    setReportHtml(ANIMATED_DEMO_TEMPLATE);
    setPhase('templateLoaded');
  };

  const handleGenerate = () => {
    setPhase('generating');
    window.setTimeout(() => {
      setReportHtml(ANIMATED_DEMO_FINAL);
      setPhase('done');
    }, 2000);
  };

  return (
    <div className="animated-demo-wrap">
      {/* Notes panel */}
      <div className="animated-demo-panel animated-demo-notes">
        <div className="demo-header">
          <span className="demo-dot demo-dot-red" />
          <span className="demo-dot demo-dot-yellow" />
          <span className="demo-dot demo-dot-green" />
          <span className="demo-label">🎙️ Notes brutes</span>
        </div>
        <div className="demo-body demo-body-mono">
          <span>{notesText}</span>
          {phase === 'typing' && <span className="demo-cursor">|</span>}
        </div>
      </div>

      {/* Arrow */}
      <div className="animated-demo-arrow" aria-hidden="true">
        {phase === 'done' ? (
          <span className="animated-demo-sparkle">✨</span>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </div>

      {/* Report panel */}
      <div className="animated-demo-panel animated-demo-report">
        <div className="demo-header">
          <span className="demo-dot demo-dot-red" />
          <span className="demo-dot demo-dot-yellow" />
          <span className="demo-dot demo-dot-green" />
          <span className="demo-label">📄 Compte rendu</span>
        </div>
        <div className="demo-body demo-body-report" style={{ position: 'relative' }}>
          {/* Phase 2: prompt to load template */}
          {phase === 'waitForTemplate' && (
            <div className="animated-demo-prompt fade-in">
              <p>Pour commencer, chargez le modèle approprié</p>
              <button className="demo-load-btn" onClick={handleLoadTemplate}>
                📋 Charger le modèle TDM cérébrale
              </button>
            </div>
          )}

          {/* Phase 3+: template or final report */}
          {(phase === 'templateLoaded' || phase === 'generating' || phase === 'done') && (
            <div className="demo-report fade-in" dangerouslySetInnerHTML={{ __html: reportHtml }} />
          )}

          {/* Empty state for typing phase */}
          {phase === 'typing' && (
            <div className="animated-demo-empty">
              <span className="animated-demo-empty-icon">📄</span>
              <span>Le rapport apparaîtra ici…</span>
            </div>
          )}

          {/* Generating spinner overlay */}
          {phase === 'generating' && (
            <div className="animated-demo-spinner-overlay fade-in">
              <div className="spinner" />
              <span>Génération en cours...</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="animated-demo-actions">
          {phase === 'templateLoaded' && (
            <button className="btn btn-primary btn-sm animated-demo-generate-btn fade-in" onClick={handleGenerate}>
              ✨ Générer le Compte Rendu
            </button>
          )}
          {phase === 'done' && (
            <button className="btn btn-primary btn-sm animated-demo-cta-btn fade-in" onClick={onGetStarted}>
              Essayer Gratuitement →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}



/* ═══════════════════════════════════════════════════════
   GoogleIcon SVG
   ═══════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════
   SocialIcon SVG
   ═══════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════ */
const landingStyles = `
/* ─── Base ────────────────────────────────── */
.landing {
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}

/* ─── Scroll Reveal ──────────────────────── */
.scroll-reveal {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
}
.scroll-reveal.revealed {
  opacity: 1;
  transform: translateY(0);
}
.scroll-reveal.stagger-0 { transition-delay: 0s; }
.scroll-reveal.stagger-1 { transition-delay: 0.1s; }
.scroll-reveal.stagger-2 { transition-delay: 0.2s; }
.scroll-reveal.stagger-3 { transition-delay: 0.25s; }
.scroll-reveal.stagger-4 { transition-delay: 0.3s; }
.scroll-reveal.stagger-5 { transition-delay: 0.35s; }

/* ─── Fade in utility ────────────────────── */
.fade-in {
  animation: landingFadeIn 0.4s ease both;
}

/* ─── Glassmorphism panel ────────────────── */
.glass-panel {
  background: rgba(30, 30, 30, 0.6) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
[data-theme="light"] .glass-panel {
  background: rgba(255, 255, 255, 0.6) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
}

/* ─── Nav ─────────────────────────────────── */
.landing-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 18px 40px;
  position: relative;
  z-index: 10;
}

.landing-brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 700;
}
.landing-brand:hover {
  color: var(--color-text);
}

.landing-nav-actions {
  display: flex;
  align-items: center;
  gap: 18px;
}
.landing-nav-actions > a {
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  transition: color 0.2s ease, text-shadow 0.2s ease;
  text-decoration: none;
}
.landing-nav-actions > a:hover {
  color: var(--color-text);
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

.nav-glass-btn {
  background: rgba(10, 132, 255, 0.15);
  border: 1px solid rgba(10, 132, 255, 0.4);
  color: #fff;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 8px 18px;
  font-size: 13px;
  border-radius: 100px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(10, 132, 255, 0.15);
}
.nav-glass-btn:hover {
  background: rgba(10, 132, 255, 0.25);
  border-color: rgba(10, 132, 255, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(10, 132, 255, 0.25), 0 0 15px rgba(10, 132, 255, 0.15);
}
[data-theme="light"] .nav-glass-btn {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.08);
}
[data-theme="light"] .nav-glass-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.15);
}

/* ─── Demo Load Button ───────────────────── */
.demo-load-btn {
  background: rgba(10, 132, 255, 0.15);
  border: 1px solid rgba(10, 132, 255, 0.4);
  color: #fff;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(10, 132, 255, 0.2);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 10px 20px;
  font-size: 14px;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.demo-load-btn:hover {
  background: rgba(10, 132, 255, 0.25);
  border-color: rgba(10, 132, 255, 0.6);
  box-shadow: 0 6px 24px rgba(10, 132, 255, 0.3);
  transform: translateY(-2px);
}
[data-theme="light"] .demo-load-btn {
  background: rgba(10, 132, 255, 0.1);
  border: 1px solid rgba(10, 132, 255, 0.3);
  color: var(--color-accent);
}
[data-theme="light"] .demo-load-btn:hover {
  background: rgba(10, 132, 255, 0.15);
}

/* ─── Hero ────────────────────────────────── */
.hero {
  position: relative;
  overflow: hidden;
  padding: 0 40px 80px;
}

.hero-bg-mesh {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.hero-bg-mesh::before,
.hero-bg-mesh::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.3;
  animation: meshFloat 12s ease-in-out infinite alternate;
}
.hero-bg-mesh::before {
  width: 600px;
  height: 600px;
  top: -200px;
  left: -100px;
  background: radial-gradient(circle, rgba(10, 132, 255, 0.4) 0%, transparent 70%);
}
.hero-bg-mesh::after {
  width: 500px;
  height: 500px;
  bottom: -150px;
  right: -100px;
  background: radial-gradient(circle, rgba(175, 82, 222, 0.3) 0%, transparent 70%);
  animation-delay: -6s;
}
[data-theme="light"] .hero-bg-mesh::before {
  opacity: 0.15;
}
[data-theme="light"] .hero-bg-mesh::after {
  opacity: 0.12;
}

.hero-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 60px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 74px);
  position: relative;
  z-index: 1;
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.hero-inner.revealed {
  opacity: 1;
  transform: translateY(0);
}

.hero-badge {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(42, 42, 42, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 100px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}
[data-theme="light"] .hero-badge {
  background: rgba(233, 233, 240, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.15;
  margin-bottom: 20px;
}

.hero-gradient {
  background: linear-gradient(135deg, #0A84FF 0%, #6C63FF 50%, #AF52DE 100%);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmerGradient 4s ease infinite;
}

.hero-subtitle {
  font-size: 1.1rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  max-width: 480px;
  margin-bottom: 32px;
}

.hero-content {
  flex-shrink: 0;
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

/* ─── Demo shared ────────────────────────── */
.hero-demo {
  flex-shrink: 0;
  width: 560px;
}

.demo-container {
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  transition: box-shadow var(--transition-normal), transform var(--transition-normal);
}
.demo-container:hover {
  box-shadow: var(--shadow-lg), 0 0 40px rgba(10, 132, 255, 0.08);
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
  position: relative;
}
.demo-dot::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 3px;
  width: 5px;
  height: 3px;
  background: rgba(255, 255, 255, 0.35);
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
  font-family: var(--font-primary);
  font-size: 13px;
  line-height: 1.7;
  min-height: 200px;
  color: var(--color-text);
}

.demo-body-mono {
  font-family: var(--font-mono);
  white-space: pre-wrap;
}

.demo-cursor {
  animation: pulse 1s step-end infinite;
  color: var(--color-accent);
  font-weight: 700;
}

/* ─── AnimatedDemo layout ────────────────── */
.animated-demo-wrap {
  display: flex;
  align-items: stretch;
  gap: 16px;
}

.animated-demo-panel {
  flex: 1;
  background: rgba(30, 30, 30, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  transition: box-shadow var(--transition-normal);
}
[data-theme="light"] .animated-demo-panel {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.animated-demo-panel:hover {
  box-shadow: var(--shadow-lg), 0 0 30px rgba(10, 132, 255, 0.06);
}

.animated-demo-panel .demo-body {
  flex: 1;
  min-height: 220px;
  max-height: 400px;
  overflow-y: auto;
}

.animated-demo-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  flex-shrink: 0;
  width: 40px;
}

.animated-demo-sparkle {
  font-size: 24px;
  animation: sparkleRotate 1.5s ease-in-out infinite;
}

.animated-demo-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 14px;
  min-height: 180px;
}

.animated-demo-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--color-text-tertiary);
  font-size: 13px;
  min-height: 180px;
}
.animated-demo-empty-icon {
  font-size: 32px;
  opacity: 0.4;
}

.animated-demo-spinner-overlay {
  position: absolute;
  inset: 0;
  background: rgba(18, 18, 18, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 5;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  border-radius: inherit;
}
[data-theme="light"] .animated-demo-spinner-overlay {
  background: rgba(242, 242, 247, 0.6);
}

.animated-demo-actions {
  padding: 0 16px 16px;
  display: flex;
  justify-content: flex-end;
  min-height: 36px;
}

.animated-demo-generate-btn {
  animation: landingFadeIn 0.4s ease both, glowPulse 2s ease-in-out infinite;
}
.animated-demo-cta-btn {
  animation: landingFadeIn 0.4s ease both;
}

/* ─── Interactive demo ─────────────────────── */
.interactive-demo-section {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(360px, 1.15fr);
  align-items: center;
  gap: 56px;
  max-width: 1000px;
  margin: 0 auto;
  padding: 48px 40px 80px;
}

.interactive-demo-copy h2 {
  font-size: 2rem;
  margin: 8px 0 16px;
}
.interactive-demo-copy > p:last-child {
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.interactive-demo-eyebrow {
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.interactive-demo .demo-body {
  font-family: var(--font-primary);
}

.demo-template-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
[data-theme="light"] .demo-template-tabs {
  border-bottom: 1px solid rgba(0,0,0,0.06);
}

.demo-template-tab {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 5px 10px;
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.demo-template-tab:hover,
.demo-template-tab.active {
  color: white;
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.interactive-demo-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}
.interactive-demo-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  width: 100%;
}

.interactive-demo-shimmer-overlay {
  position: absolute;
  inset: 0;
  background: rgba(18, 18, 18, 0.5);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  border-radius: inherit;
}
[data-theme="light"] .interactive-demo-shimmer-overlay {
  background: rgba(242, 242, 247, 0.5);
}

.demo-panel-label {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
}
.interactive-demo-body p {
  margin: 0;
}

.demo-report p {
  margin: 0;
}

.demo-report-study {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.demo-report-section {
  margin-top: 14px;
}
.demo-report-section h3 {
  margin: 0 0 4px;
  color: var(--color-accent);
  font-size: 12px;
  letter-spacing: 0.04em;
}
.demo-report-section p + p {
  margin-top: 8px;
}
.demo-report-section.conclusion {
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.demo-report strong {
  color: var(--color-accent);
}

.demo-report mark {
  background: var(--color-highlight-bg);
  color: inherit;
  border-radius: 3px;
  padding: 1px 2px;
}

.demo-generate-btn {
  margin-top: auto;
}

.demo-disclaimer {
  padding: 0 16px 14px;
  color: var(--color-text-tertiary);
  font-size: 11px;
}

/* ─── How it works ───────────────────────── */
.how-it-works {
  max-width: 900px;
  margin: 0 auto;
  padding: 80px 40px 40px;
}

.how-steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  position: relative;
}

.how-step {
  flex: 1;
  text-align: center;
  padding: 0 20px;
  position: relative;
}

.how-step-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(10, 132, 255, 0.1);
  border: 2px solid rgba(10, 132, 255, 0.25);
  margin-bottom: 20px;
}

.how-step-num {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(10, 132, 255, 0.4);
}

.how-step-icon {
  font-size: 28px;
}

.how-step h3 {
  font-size: 1rem;
  margin-bottom: 8px;
}

.how-step p {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.how-step-connector {
  position: absolute;
  top: 36px;
  right: -12px;
  width: 24px;
  height: 2px;
  background: linear-gradient(90deg, var(--color-accent), rgba(10, 132, 255, 0.2));
}
.how-step-connector::after {
  content: '';
  position: absolute;
  right: -4px;
  top: -3px;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid var(--color-accent);
  opacity: 0.5;
}

/* ─── Features ───────────────────────────── */
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
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.feature-card {
  position: relative;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 28px;
  text-align: center;
  transition: transform var(--transition-normal), box-shadow var(--transition-normal);
  overflow: hidden;
}

/* Gradient border on hover */
.feature-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-lg);
  padding: 1px;
  background: linear-gradient(135deg, var(--color-accent), #AF52DE, #6C63FF);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity var(--transition-normal);
  pointer-events: none;
}

.feature-card:hover::before {
  opacity: 1;
}

.feature-card:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: var(--shadow-lg), 0 0 40px rgba(10, 132, 255, 0.08);
}

.feature-icon {
  font-size: 36px;
  margin-bottom: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgba(10, 132, 255, 0.1), rgba(175, 82, 222, 0.08));
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

/* ─── Testimonial ────────────────────────── */
.testimonial-section {
  max-width: 700px;
  margin: 0 auto;
  padding: 40px 40px 80px;
}

.testimonial-card {
  position: relative;
  background: rgba(30, 30, 30, 0.5);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-xl);
  padding: 48px 40px 40px;
  text-align: center;
  overflow: hidden;
}
[data-theme="light"] .testimonial-card {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

/* Gradient accent top border */
.testimonial-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #0A84FF, #6C63FF, #AF52DE);
}

.testimonial-quote {
  font-size: 64px;
  line-height: 1;
  background: linear-gradient(135deg, #0A84FF, #AF52DE);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: -8px;
  user-select: none;
}

.testimonial-card blockquote p {
  font-size: 1.15rem;
  line-height: 1.8;
  color: var(--color-text);
  font-style: italic;
  margin-bottom: 20px;
}

.testimonial-card cite {
  color: var(--color-text-secondary);
  font-size: 14px;
  font-style: normal;
  font-weight: 500;
}

/* ─── Footer ─────────────────────────────── */
.landing-footer {
  text-align: center;
  padding: 40px;
  color: var(--color-text-tertiary);
  font-size: 13px;
  border-top: 1px solid var(--color-border);
}

.landing-social-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}
.landing-social-links span {
  color: var(--color-text-secondary);
  font-weight: 600;
}

.social-icon-list {
  display: flex;
  gap: 8px;
}

.social-icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-secondary);
  transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
}
.social-icon-link:hover {
  color: white;
  border-color: var(--color-accent);
  background: var(--color-accent);
  transform: translateY(-2px);
}

.social-icon {
  width: 17px;
  height: 17px;
  fill: currentColor;
}

/* ─── Sticky CTA bar ────────────────────── */
.sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 14px 24px;
  background: rgba(30, 30, 30, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  transform: translateY(100%);
  opacity: 0;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
  pointer-events: none;
}
[data-theme="light"] .sticky-cta {
  background: rgba(255, 255, 255, 0.85);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.sticky-cta-visible {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.sticky-cta-text {
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
}

/* ─── Keyframes ──────────────────────────── */
@keyframes landingFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes shimmerGradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes meshFloat {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(30px, -30px) scale(1.15); }
}

@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(10, 132, 255, 0); }
  50% { box-shadow: 0 0 20px 4px rgba(10, 132, 255, 0.3); }
}

@keyframes sparkleRotate {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.2) rotate(15deg); }
}

/* ─── Responsive 900px ───────────────────── */
@media (max-width: 900px) {
  .landing-nav {
    padding: 14px 20px;
  }
  .nav-link-hide-mobile {
    display: none;
  }

  .hero {
    padding: 0 20px 48px;
  }

  .hero-inner {
    flex-direction: column;
    text-align: center;
    min-height: auto;
    padding-top: 32px;
    gap: 40px;
  }

  .hero-title { font-size: 2rem; }
  .hero-subtitle { margin: 0 auto 32px; }
  .hero-actions { width: 100%; max-width: 360px; margin: 0 auto; }
  .hero-demo { width: 100%; max-width: 560px; }

  .animated-demo-wrap {
    flex-direction: column;
  }
  .animated-demo-arrow {
    transform: rotate(90deg);
    height: 40px;
    width: 100%;
  }

  .interactive-demo-section {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 20px 20px 60px;
  }
  .interactive-demo-copy {
    text-align: center;
  }

  .how-steps {
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }
  .how-step {
    max-width: 320px;
  }
  .how-step-connector {
    display: none;
  }

  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ─── Responsive 500px ───────────────────── */
@media (max-width: 500px) {
  .landing-nav-actions > a {
    display: none;
  }

  .hero-title { font-size: 1.75rem; }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .magic-link-form {
    flex-direction: column;
  }

  .sticky-cta {
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
  }
  .sticky-cta-text {
    font-size: 13px;
  }

  .testimonial-card {
    padding: 36px 24px 32px;
  }
  .testimonial-card blockquote p {
    font-size: 1rem;
  }
}

/* ─── Reduced motion ─────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .scroll-reveal {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .hero-inner {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .hero-gradient {
    animation: none !important;
  }
  .hero-bg-mesh::before,
  .hero-bg-mesh::after {
    animation: none !important;
  }
  .animated-demo-generate-btn {
    animation: none !important;
  }
  .animated-demo-sparkle {
    animation: none !important;
  }
  .sticky-cta {
    transition: none !important;
  }
  .fade-in {
    animation: none !important;
  }
}
`;
