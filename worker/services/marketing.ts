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
  const baseUrl = env.APP_URL || 'https://app.radreportai.com';

  const btnStyle = "display: inline-block; padding: 14px 28px; background-color: #0A84FF; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; margin-bottom: 24px; text-align: center;";
  const containerStyle = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333333;";

  // Helper to fetch eligible users for a specific campaign
  const getEligibleUsers = async (emailType: string, daysAgo: number): Promise<EmailTarget[]> => {
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
    const maxTime = `-${daysAgo + 2} days`; 

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
      <div style="${containerStyle}">
        <h2 style="color: #111111;">Bonjour ${name},</h2>
        <p>Bienvenue sur Rad Report AI ! Nous sommes ravis de vous compter parmi nous.</p>
        <p>Notre objectif est simple : vous faire gagner un temps précieux à chaque vacation en automatisant la rédaction de vos comptes rendus.</p>
        <p>Pour commencer à gagner du temps dès aujourd'hui :</p>
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 8px;">Cliquez sur l'icône micro et dictez naturellement vos observations cliniques.</li>
          <li style="margin-bottom: 8px;">Sélectionnez le modèle approprié (ex: IRM Cérébrale).</li>
          <li style="margin-bottom: 8px;">Cliquez sur <strong>Générer</strong> et copiez le résultat parfaitement structuré directement dans votre PACS !</li>
        </ol>
        <center>
          <a href="${baseUrl}/" style="${btnStyle}">Commencer à dicter</a>
        </center>
        <p>Si vous avez la moindre question ou besoin d'assistance, répondez simplement à cet email.</p>
        <br/>
        <p style="color: #666666;">Cordialement,<br/>L'équipe Rad Report AI</p>
      </div>
    `;
    const success = await sendMarketingEmail(env, user.email, subject, html);
    if (success) await markEmailAsSent(db, user.user_id, 'onboarding_day1');
  }

  // 2. Day 3: Discovery (Templates)
  const day3Users = await getEligibleUsers('discovery_day3', 3);
  for (const user of day3Users) {
    const name = user.display_name || 'Docteur';
    const subject = "Astuce : Personnalisez vos propres modèles de compte rendu";
    const html = `
      <div style="${containerStyle}">
        <h2 style="color: #111111;">Bonjour ${name},</h2>
        <p>Saviez-vous que vous pouviez utiliser vos propres trames de comptes rendus dans Rad Report AI ?</p>
        <p>Chaque radiologue a ses propres habitudes et formulations. C'est pourquoi nous avons conçu notre IA pour s'adapter à votre style, et non l'inverse.</p>
        <p>Rendez-vous dans la section <strong>Mes Modèles</strong> pour coller vos trames habituelles (Indication, Technique, Résultats, Conclusion). L'IA apprendra automatiquement à structurer vos dictées vocales selon votre propre format !</p>
        <center>
          <a href="${baseUrl}/templates" style="${btnStyle}">Créer mon premier modèle personnalisé</a>
        </center>
        <br/>
        <p style="color: #666666;">À très vite,<br/>L'équipe Rad Report AI</p>
      </div>
    `;
    const success = await sendMarketingEmail(env, user.email, subject, html);
    if (success) await markEmailAsSent(db, user.user_id, 'discovery_day3');
  }

  // 3. Day 5: The Pitch
  const day5Candidates = await getEligibleUsers('pitch_day5', 5);
  for (const user of day5Candidates) {
    const fullUser = await db.prepare('SELECT subscription_plan FROM users WHERE id = ?').bind(user.user_id).first<{subscription_plan: string}>();
    if (fullUser?.subscription_plan === 'Pro' || fullUser?.subscription_plan === 'Elite') {
      await markEmailAsSent(db, user.user_id, 'pitch_day5');
      continue;
    }

    const name = user.display_name || 'Docteur';
    const subject = "Gagnez 40 heures par mois avec Rad Report AI Pro";
    const html = `
      <div style="${containerStyle}">
        <h2 style="color: #111111;">Bonjour ${name},</h2>
        <p>J'espère que Rad Report AI vous a déjà permis d'alléger vos dernières vacations.</p>
        <p>Nos utilisateurs les plus assidus constatent un gain de temps allant jusqu'à <strong>40 heures par mois</strong> sur la rédaction de leurs comptes rendus. Imaginez ce que vous pourriez faire avec tout ce temps libre !</p>
        <p>Pour passer à la vitesse supérieure, découvrez le forfait <strong>Pro</strong>. Vous y débloquerez :</p>
        <ul style="padding-left: 20px;">
          <li style="margin-bottom: 8px;"><strong>Un moteur IA de pointe</strong> (plus rapide et ultra-précis)</li>
          <li style="margin-bottom: 8px;"><strong>2 000 générations</strong> par mois</li>
          <li style="margin-bottom: 8px;">Jusqu'à <strong>200 modèles personnels</strong> enregistrés</li>
        </ul>
        <center>
          <a href="${baseUrl}/billing" style="${btnStyle}">Découvrir Rad Report AI Pro</a>
        </center>
        <p>N'hésitez pas à nous contacter si vous avez des questions sur nos forfaits.</p>
        <br/>
        <p style="color: #666666;">L'équipe Rad Report AI</p>
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
      <div style="${containerStyle}">
        <h2 style="color: #111111;">Bonjour ${name},</h2>
        <p>Si Rad Report AI vous aide au quotidien, pourquoi ne pas en faire profiter vos confrères ?</p>
        <p>Nous avons mis en place un programme de parrainage exclusif : pour chaque confrère qui s'abonne via votre lien, vous gagnez 1 point ⭐️.</p>
        <p><strong>Dès que vous atteignez 5 points, nous vous offrons 1 mois complet d'abonnement !</strong></p>
        <center>
          <a href="${baseUrl}/profile" style="${btnStyle}">Récupérer mon lien de parrainage</a>
        </center>
        <p>Il vous suffit de partager ce lien sur WhatsApp ou par email avec vos collègues radiologues.</p>
        <br/>
        <p style="color: #666666;">Merci pour votre confiance,<br/>L'équipe Rad Report AI</p>
      </div>
    `;
    const success = await sendMarketingEmail(env, user.email, subject, html);
    if (success) await markEmailAsSent(db, user.user_id, 'referral_day14');
  }
}
