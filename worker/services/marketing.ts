import type { HonoEnv } from '../types';

interface EmailTarget {
  user_id: number;
  email: string;
  display_name: string | null;
}

const sendMarketingEmail = async (
  env: HonoEnv['Bindings'],
  to: string,
  subject: string,
  html: string
) => {
  if (!env.RESEND_API) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API}`,
      },
      body: JSON.stringify({
        from: 'Radreport Ai <contact@radreportai.com>',
        to,
        subject,
        html,
      }),
    });

    return res.ok;
  } catch (error) {
    console.error('Failed to send marketing email to', to, error);
    return false;
  }
};

const markEmailAsSent = async (db: D1Database, userId: number, emailType: string) => {
  await db.prepare(
    'INSERT OR IGNORE INTO user_email_logs (user_id, email_type) VALUES (?, ?)'
  )
    .bind(userId, emailType)
    .run();
};

export async function processAutomatedEmails(env: HonoEnv['Bindings']) {
  const db = env.DB;

  // Helper to fetch eligible users for a specific campaign
  const getEligibleUsers = async (emailType: string, daysAgo: number): Promise<EmailTarget[]> => {
    // We look for users created between (daysAgo) and (daysAgo + 1) days ago
    // who haven't received this specific email_type yet
    const query = `
      SELECT u.id as user_id, u.email, u.display_name
      FROM users u
      LEFT JOIN user_email_logs l ON u.id = l.user_id AND l.email_type = ?
      WHERE l.user_id IS NULL
        AND u.deleted_at IS NULL
        AND u.created_at <= datetime('now', ?)
        AND u.created_at > datetime('now', ?)
    `;
    const minTime = `-${daysAgo} days`;
    const maxTime = `-${daysAgo + 2} days`; // Provide a generous 48h window to catch cron misfires

    const result = await db.prepare(query)
      .bind(emailType, minTime, maxTime)
      .all<EmailTarget>();

    return result.results || [];
  };

  // 1. Day 1: Welcome / Onboarding
  const day1Users = await getEligibleUsers('onboarding_day1', 1);
  for (const user of day1Users) {
    const name = user.display_name || 'Docteur';
    const subject = "Bienvenue sur Rad Report AI 🩻 – Vos premiers pas";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bonjour ${name},</h2>
        <p>Bienvenue sur Rad Report AI ! Nous sommes ravis de vous compter parmi nous.</p>
        <p>Pour gagner du temps dès aujourd'hui :</p>
        <ol>
          <li>Cliquez sur l'icône micro et dictez vos observations cliniques.</li>
          <li>Sélectionnez un modèle (par exemple, IRM Cérébrale).</li>
          <li>Cliquez sur <strong>Générer</strong> et copiez le résultat structuré directement dans votre PACS !</li>
        </ol>
        <p>Si vous avez la moindre question, répondez simplement à cet email.</p>
        <br/>
        <p>L'équipe Rad Report AI</p>
      </div>
    `;
    const success = await sendMarketingEmail(env, user.email, subject, html);
    if (success) await markEmailAsSent(db, user.user_id, 'onboarding_day1');
  }

  // 2. Day 3: Discovery (Templates)
  const day3Users = await getEligibleUsers('discovery_day3', 3);
  for (const user of day3Users) {
    const name = user.display_name || 'Docteur';
    const subject = "Astuce : Personnalisez vos propres modèles";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bonjour ${name},</h2>
        <p>Saviez-vous que vous pouvez utiliser vos propres trames de comptes rendus ?</p>
        <p>Chaque cabinet a ses propres habitudes. Dans la section <strong>Mes Modèles</strong>, vous pouvez coller votre trame habituelle (avec Indication, Technique, Résultats, etc.).</p>
        <p>L'IA apprendra automatiquement à structurer vos dictées selon votre format !</p>
        <br/>
        <p>À bientôt,<br/>L'équipe Rad Report AI</p>
      </div>
    `;
    const success = await sendMarketingEmail(env, user.email, subject, html);
    if (success) await markEmailAsSent(db, user.user_id, 'discovery_day3');
  }

  // 3. Day 5: The Pitch (Only for free/standard users)
  // We'll fetch users created 5 days ago, then filter out anyone with a Pro/Elite subscription
  const day5Candidates = await getEligibleUsers('pitch_day5', 5);
  for (const user of day5Candidates) {
    // Check if they are already Pro/Elite
    const fullUser = await db.prepare('SELECT subscription_plan FROM users WHERE id = ?').bind(user.user_id).first<{subscription_plan: string}>();
    if (fullUser?.subscription_plan === 'Pro' || fullUser?.subscription_plan === 'Elite') {
      // Mark as sent so we don't bother checking them again
      await markEmailAsSent(db, user.user_id, 'pitch_day5');
      continue;
    }

    const name = user.display_name || 'Docteur';
    const subject = "Gagnez 40 heures par mois avec Rad Report AI Pro";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bonjour ${name},</h2>
        <p>J'espère que vous appréciez vos premières générations avec Rad Report AI.</p>
        <p>Nos utilisateurs les plus réguliers constatent un gain de temps allant jusqu'à <strong>40 heures par mois</strong> sur la rédaction de leurs comptes rendus.</p>
        <p>Avec le plan <strong>Pro</strong>, vous débloquez :</p>
        <ul>
          <li>Un modèle d'IA plus rapide et précis</li>
          <li>2000 générations par mois</li>
          <li>Jusqu'à 200 modèles personnels</li>
        </ul>
        <p>Passez à la vitesse supérieure depuis l'onglet Facturation de votre profil.</p>
        <br/>
        <p>L'équipe Rad Report AI</p>
      </div>
    `;
    const success = await sendMarketingEmail(env, user.email, subject, html);
    if (success) await markEmailAsSent(db, user.user_id, 'pitch_day5');
  }

  // 4. Day 14: Referral Program
  const day14Users = await getEligibleUsers('referral_day14', 14);
  for (const user of day14Users) {
    const name = user.display_name || 'Docteur';
    const subject = "Obtenez un mois gratuit en invitant vos confrères !";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bonjour ${name},</h2>
        <p>Si Rad Report AI vous fait gagner du temps au quotidien, parlez-en à vos confrères !</p>
        <p>Rendez-vous dans la section <strong>Profil</strong> pour copier votre lien de parrainage unique.</p>
        <p>Pour chaque confrère qui s'abonne via votre lien, vous gagnez 1 point ⭐️. <strong>Au bout de 5 points, nous vous offrons 1 mois complet d'abonnement !</strong></p>
        <br/>
        <p>Merci pour votre confiance,<br/>L'équipe Rad Report AI</p>
      </div>
    `;
    const success = await sendMarketingEmail(env, user.email, subject, html);
    if (success) await markEmailAsSent(db, user.user_id, 'referral_day14');
  }
}
