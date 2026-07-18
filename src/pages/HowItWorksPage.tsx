import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════
   Hooks
   ═══════════════════════════════════════════════════════ */
function useScrollReveal() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement | HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  return { ref, isVisible };
}

/* ═══════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════ */
export function HowItWorksPage() {
  const navigate = useNavigate();

  const heroReveal = useScrollReveal();
  const workflowReveal = useScrollReveal();
  const toolsReveal = useScrollReveal();
  const supportReveal = useScrollReveal();
  const ctaReveal = useScrollReveal();

  return (
    <div className="hiw-page">
      <style dangerouslySetInnerHTML={{ __html: hiwStyles }} />

      {/* ─── Nav ─── */}
      <header className="landing-nav">
        <a className="landing-brand" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} aria-label="Rad Report AI — accueil">
          <img src="/favicon.png" alt="" width="24" height="24" style={{ borderRadius: '4px' }} />
          <span>Rad Report AI</span>
        </a>
        <nav className="landing-nav-actions" aria-label="Navigation principale">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Accueil</a>
          <button className="nav-glass-btn" onClick={() => navigate('/')}>
            Se connecter
          </button>
        </nav>
      </header>

      <main className="hiw-main">
        {/* ─── Hero ─── */}
        <section className="hiw-hero">
          <div className="hero-bg-mesh" aria-hidden="true" />
          <div ref={heroReveal.ref as any} className={`hiw-hero-inner scroll-reveal ${heroReveal.isVisible ? 'revealed' : ''}`}>
            <span className="hiw-badge">✨ Guide complet</span>
            <h1>Comment ça marche</h1>
            <p className="subtitle">
              De la dictée au compte rendu parfait en quelques secondes. Découvrez comment Rad Report AI transforme votre workflow radiologique.
            </p>
          </div>
        </section>

        {/* ─── Workflow Steps ─── */}
        <section className="hiw-workflow" ref={workflowReveal.ref as any}>
          <div className={`hiw-workflow-header scroll-reveal ${workflowReveal.isVisible ? 'revealed' : ''}`}>
            <h2 className="hiw-section-title">Le workflow en 3 étapes</h2>
          </div>

          <div className="hiw-steps">
            {[
              { 
                num: '1', 
                icon: '🎙️', 
                title: 'Dictez vos observations', 
                desc: 'Utilisez la reconnaissance vocale spécialisée pour capturer vos notes cliniques. Notre IA comprend le vocabulaire médical, les abréviations et les accents.',
                tags: ['🧠 IA médicale', '🌍 Multi-langue']
              },
              { 
                num: '2', 
                icon: '⚡', 
                title: 'Génération IA instantanée', 
                desc: 'En un clic, l\'IA transforme vos notes brutes en un compte rendu structuré et professionnel, avec surlignage automatique des pathologies.',
                tags: ['⚡ Instantané', '🖍️ Surlignage']
              },
              { 
                num: '3', 
                icon: '📄', 
                title: 'Révisez et exportez', 
                desc: 'Relisez, ajustez si nécessaire, puis copiez ou exportez votre rapport finalisé vers votre système. Prêt en moins de 30 secondes.',
                tags: ['📋 Copier', '⏱️ 30 sec']
              }
            ].map((step, i) => (
              <div key={step.num} className="hiw-step-wrapper">
                <div className={`hiw-step glass-panel scroll-reveal stagger-${i} ${workflowReveal.isVisible ? 'revealed' : ''}`}>
                  <div className="hiw-step-number">{step.num}</div>
                  <div className="hiw-step-icon">{step.icon}</div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                  <div className="hiw-step-tags">
                    {step.tags.map(tag => (
                      <span key={tag} className="hiw-tag">{tag}</span>
                    ))}
                  </div>
                </div>
                {i < 2 && (
                  <div className={`hiw-step-connector scroll-reveal stagger-${i} ${workflowReveal.isVisible ? 'revealed' : ''}`}>
                    ⬇️
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─── Advanced Tools ─── */}
        <section className="hiw-tools-section" ref={toolsReveal.ref as any}>
          <div className={`hiw-tools-header scroll-reveal ${toolsReveal.isVisible ? 'revealed' : ''}`}>
            <h2 className="hiw-section-title">Outils avancés</h2>
            <p className="hiw-section-subtitle">Des fonctionnalités puissantes pour optimiser encore plus votre productivité</p>
          </div>

          <div className="hiw-tools-grid">
            {[
              { icon: '✂️', title: 'Raccourcir le rapport', desc: 'Condensez automatiquement les rapports trop longs tout en préservant les informations essentielles.' },
              { icon: '🪄', title: 'Modèle rapide', desc: 'Générez un modèle de base en décrivant simplement la région anatomique et la modalité.' },
              { icon: '💾', title: 'Sauvegarder comme modèle', desc: 'Transformez n\'importe quel rapport en modèle réutilisable pour vos futurs examens similaires.' },
              { icon: '📤', title: 'Importer des modèles', desc: 'Importez vos modèles Word ou texte existants. Jusqu\'à 10 fichiers à la fois.' }
            ].map((tool, i) => (
              <div key={tool.title} className={`hiw-tool-card glass-panel scroll-reveal stagger-${i} ${toolsReveal.isVisible ? 'revealed' : ''}`}>
                <div className="hiw-tool-icon">{tool.icon}</div>
                <h3>{tool.title}</h3>
                <p>{tool.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Support Section ─── */}
        <section className="hiw-support-section" ref={supportReveal.ref as any}>
          <div className={`hiw-support-card glass-panel scroll-reveal ${supportReveal.isVisible ? 'revealed' : ''}`}>
            <div className="hiw-support-icon">🎧</div>
            <div className="hiw-support-content">
              <h3>Aide & Feedback</h3>
              <p>Une question ? Une suggestion ? Accédez aux tutoriels vidéo ou contactez directement notre équipe. Nous sommes là pour vous aider.</p>
              <div className="hiw-support-features">
                <span>▶️ Tutoriels vidéo</span>
                <span>✉️ Contact direct</span>
                <span>✅ Suivi des demandes</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA Section ─── */}
        <section className="hiw-cta-section" ref={ctaReveal.ref as any}>
          <div className={`hiw-cta-card glass-panel scroll-reveal ${ctaReveal.isVisible ? 'revealed' : ''}`}>
            <h2>Prêt à gagner des heures chaque semaine ?</h2>
            <p>Rejoignez les radiologues qui ont déjà transformé leur workflow.</p>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/')}>
              Essayer Gratuitement <span className="cta-subtext" style={{ fontSize: '0.8em', opacity: 0.8, marginLeft: '8px' }}>(20 rapports offerts)</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer" style={{ borderTop: '1px solid var(--color-border)', marginTop: '40px' }}>
        <p className="copyright">© 2024 Rad Report AI. Tous droits réservés.</p>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════════ */
const hiwStyles = `
.hiw-page {
  min-height: 100vh;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-primary);
  overflow-x: hidden;
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
  text-decoration: none;
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

/* ─── Footer ─────────────────────────────── */
.landing-footer {
  text-align: center;
  padding: 40px;
  color: var(--color-text-tertiary);
  font-size: 13px;
  border-top: 1px solid var(--color-border);
}

/* Glass panel utility */
.glass-panel {
  background: rgba(30, 30, 30, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-normal);
}
[data-theme="light"] .glass-panel {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.glass-panel:hover {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: var(--shadow-lg), 0 0 30px rgba(10, 132, 255, 0.06);
}
[data-theme="light"] .glass-panel:hover {
  border-color: rgba(0, 0, 0, 0.15);
}

/* Scroll reveal animations */
.scroll-reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
}
.scroll-reveal.revealed {
  opacity: 1;
  transform: translateY(0);
}
.stagger-0 { transition-delay: 0.1s; }
.stagger-1 { transition-delay: 0.2s; }
.stagger-2 { transition-delay: 0.3s; }
.stagger-3 { transition-delay: 0.4s; }

@media (prefers-reduced-motion: reduce) {
  .scroll-reveal {
    transition: none;
    transform: none;
    opacity: 1;
  }
}

.hiw-main {
  padding-top: 100px;
  max-width: 1200px;
  margin: 0 auto;
  padding-inline: 24px;
}

/* Hero */
.hiw-hero {
  position: relative;
  text-align: center;
  padding: 80px 0;
}
.hiw-hero-inner {
  max-width: 800px;
  margin: 0 auto;
  position: relative;
  z-index: 2;
}
.hiw-badge {
  display: inline-block;
  background: rgba(10, 132, 255, 0.1);
  color: var(--color-accent);
  padding: 6px 16px;
  border-radius: 100px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 24px;
  border: 1px solid rgba(10, 132, 255, 0.2);
}
.hiw-hero h1 {
  font-size: clamp(3rem, 6vw, 4.5rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
  font-weight: 700;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #fff 0%, #a8a8a8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
[data-theme="light"] .hiw-hero h1 {
  background: linear-gradient(135deg, #121212 0%, #4a4a4a 100%);
  -webkit-background-clip: text;
}
.hiw-hero .subtitle {
  font-size: clamp(1.1rem, 2vw, 1.25rem);
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* Sections Base */
.hiw-section-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 16px;
  text-align: center;
}
.hiw-section-subtitle {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 1.1rem;
  margin-bottom: 48px;
}

/* Workflow */
.hiw-workflow {
  padding: 60px 0;
}
.hiw-workflow-header {
  margin-bottom: 60px;
}
.hiw-steps {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 700px;
  margin: 0 auto;
}
.hiw-step-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.hiw-step {
  padding: 40px;
  position: relative;
  width: 100%;
  text-align: center;
}
.hiw-step-number {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 40px;
  background: var(--color-accent);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.2rem;
  box-shadow: 0 0 20px rgba(10, 132, 255, 0.4);
}
.hiw-step-icon {
  font-size: 3rem;
  margin-bottom: 24px;
}
.hiw-step h3 {
  font-size: 1.5rem;
  margin-bottom: 16px;
}
.hiw-step p {
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}
.hiw-step-tags {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.hiw-tag {
  background: rgba(255, 255, 255, 0.05);
  padding: 6px 12px;
  border-radius: 100px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
[data-theme="light"] .hiw-tag {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.1);
}
.hiw-step-connector {
  font-size: 2rem;
  color: var(--color-text-tertiary);
  margin: 24px 0;
}

/* Tools Grid */
.hiw-tools-section {
  padding: 80px 0;
}
.hiw-tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
.hiw-tool-card {
  padding: 32px;
  border-radius: var(--radius-lg);
}
.hiw-tool-icon {
  font-size: 2.5rem;
  margin-bottom: 24px;
}
.hiw-tool-card h3 {
  font-size: 1.25rem;
  margin-bottom: 12px;
}
.hiw-tool-card p {
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* Support Section */
.hiw-support-section {
  padding: 60px 0;
}
.hiw-support-card {
  display: flex;
  align-items: center;
  padding: 48px;
  gap: 40px;
}
@media (max-width: 768px) {
  .hiw-support-card {
    flex-direction: column;
    text-align: center;
    padding: 32px 24px;
  }
}
.hiw-support-icon {
  font-size: 5rem;
}
.hiw-support-content h3 {
  font-size: 2rem;
  margin-bottom: 16px;
}
.hiw-support-content p {
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
  font-size: 1.1rem;
}
.hiw-support-features {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
@media (max-width: 768px) {
  .hiw-support-features {
    justify-content: center;
  }
}
.hiw-support-features span {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* CTA */
.hiw-cta-section {
  padding: 80px 0 120px;
}
.hiw-cta-card {
  text-align: center;
  padding: 64px 24px;
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.8) 0%, rgba(10, 132, 255, 0.1) 100%);
}
[data-theme="light"] .hiw-cta-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(10, 132, 255, 0.05) 100%);
}
.hiw-cta-card h2 {
  font-size: 2.5rem;
  margin-bottom: 16px;
}
.hiw-cta-card p {
  color: var(--color-text-secondary);
  font-size: 1.2rem;
  margin-bottom: 32px;
}
`;
