
interface EmailTemplate {
    subject: string | ((data: any) => string);
    body: (data: any) => string;
    html?: (data: any) => string;
}

// ── Design Tokens ──────────────────────────────────────────────────────────────

const T = {
    primary: '#663399',
    primaryLight: '#f5f0ff',
    bg: '#f0eee9',
    white: '#fff',
    border: '#f3f4f6',
    textDark: '#111827',
    textBody: '#4b5563',
    textMuted: '#9ca3af',
    green: '#10b981',
    greenDark: '#166534',
    greenBg: '#f0fdf4',
    greenBorder: '#bbf7d0',
    approve: '#047857',
    reject: '#b91c1c',
    rejectBorder: '#fecaca',
    amber: '#fcd34d',
    amberBg: '#fffbeb',
    amberBorder: '#fde68a',
    sectionBg: '#f9fafb',
    cardBg: '#fafaf7',
    logoUrl: 'https://ucarecdn.com/f2a5f489-f0ef-41c2-aa3d-d81e815d49c8/foddaminilogoclaude.png',
    fontSans: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    fontSerif: "'Instrument Serif',Georgia,'Times New Roman',serif",
    fontMono: "'JetBrains Mono',ui-monospace,monospace",
};

// ── Branded Helper Functions ───────────────────────────────────────────────────

/**
 * Full email wrapper — purple header with logo, white content area, branded footer.
 */
function foddaWrap(opts: { headerLabel?: string; statusChip?: { text: string; dotColor: string }; content: string }): string {
    const headerLabel = opts.headerLabel || 'fodda.ai';

    const labelParts = headerLabel.split('·');
    const labelHtml = labelParts.length > 1
        ? `${labelParts[0].trim()} <span style="font-weight:400;opacity:0.6;">· ${labelParts[1].trim()}</span>`
        : headerLabel;

    const chipHtml = opts.statusChip
        ? `<td style="text-align:right;vertical-align:middle;">
            <span style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:100px;padding:5px 12px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:0.1em;text-transform:uppercase;font-family:${T.fontSans};">
                <span style="display:inline-block;width:6px;height:6px;background:${opts.statusChip.dotColor};border-radius:50%;vertical-align:middle;margin-right:6px;"></span>${opts.statusChip.text}
            </span>
           </td>`
        : '';

    const footerLeft = `<span style="font-size:13px;font-weight:700;color:${T.primary};font-family:${T.fontSans};">Fodda</span>`;
    const footerRight = `<span style="font-family:${T.fontSans};">
        <a href="https://www.fodda.ai" style="font-size:11px;color:${T.textMuted};text-decoration:none;">Manage notifications</a>
        <span style="color:#e5e7eb;margin:0 4px;">·</span>
        <a href="https://www.fodda.ai" style="font-size:11px;color:${T.textMuted};text-decoration:none;">Unsubscribe</a>
        <span style="color:#e5e7eb;margin:0 4px;">·</span>
        <a href="https://www.fodda.ai/privacy" style="font-size:11px;color:${T.textMuted};text-decoration:none;">Privacy</a>
    </span>`;

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${T.bg};font-family:${T.fontSans};-webkit-font-smoothing:antialiased;padding:40px 16px;">
  <div style="max-width:600px;margin:0 auto;">

    <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->

    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${T.primary};border-radius:20px 20px 0 0;">
      <tr>
        <td style="padding:28px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="vertical-align:middle;width:34px;height:34px;background:#fff;border-radius:10px;text-align:center;">
                    <img src="${T.logoUrl}" alt="Fodda" width="28" height="28" style="vertical-align:middle;">
                  </td>
                  <td style="vertical-align:middle;padding-left:10px;">
                    <a href="https://www.fodda.ai" style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.02em;font-family:${T.fontSans};text-decoration:none;">${labelHtml}</a>
                  </td>
                </tr></table>
              </td>
              ${chipHtml}
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Content -->
    ${opts.content}

    <!-- Footer -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:0 0 20px 20px;border-top:1px solid ${T.border};">
      <tr>
        <td style="padding:24px 40px;vertical-align:middle;">${footerLeft}</td>
        <td style="padding:24px 40px;vertical-align:middle;text-align:right;">${footerRight}</td>
      </tr>
    </table>

    <!--[if mso]></td></tr></table><![endif]-->

  </div>
</body>
</html>`;
}

/**
 * Hero section — kicker, headline (Instrument Serif), body text.
 */
function foddaHero(opts: { kicker?: string; headline: string; bodyHtml: string }): string {
    const kickerHtml = opts.kicker
        ? `<div style="font-size:13px;color:${T.textMuted};font-weight:500;letter-spacing:0.04em;margin-bottom:8px;text-transform:uppercase;font-family:${T.fontSans};">${opts.kicker}</div>`
        : '';
    return `<div style="background:#fff;padding:40px 40px 32px;border-bottom:1px solid ${T.border};">
    ${kickerHtml}
    <h1 style="font-size:38px;font-style:italic;line-height:1.05;color:${T.textDark};letter-spacing:-0.02em;margin:0 0 16px 0;font-weight:400;font-family:${T.fontSerif};">${opts.headline}</h1>
    <div style="font-size:14.5px;color:${T.textBody};font-weight:300;line-height:1.65;font-family:${T.fontSans};">${opts.bodyHtml}</div>
</div>`;
}

/**
 * Labeled section with uppercase label.
 */
function foddaSection(label: string, html: string): string {
    return `<div style="background:#fff;padding:28px 40px;border-bottom:1px solid ${T.border};">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:${T.textMuted};margin-bottom:16px;font-family:${T.fontSans};">${label}</div>
    ${html}
</div>`;
}

/**
 * Styled button — primary (purple), secondary (white/border), approve (green), reject (red outline).
 */
function foddaButton(label: string, href: string, variant: 'primary' | 'secondary' | 'approve' | 'reject' = 'primary'): string {
    const styles: Record<string, string> = {
        primary: `background:${T.primary};color:#fff;border:1.5px solid ${T.primary};`,
        secondary: `background:#fff;color:${T.textBody};border:1.5px solid #e5e7eb;`,
        approve: `background:${T.approve};color:#fff;border:1.5px solid ${T.approve};`,
        reject: `background:#fff;color:${T.reject};border:1.5px solid ${T.rejectBorder};`,
    };
    return `<a href="${href}" style="display:inline-block;${styles[variant]}font-size:14px;font-weight:700;padding:13px 24px;border-radius:12px;text-decoration:none;letter-spacing:-0.01em;font-family:${T.fontSans};text-align:center;">${label}</a>`;
}

/**
 * Centered call-to-action strip.
 */
function foddaCtaStrip(html: string): string {
    return `<div style="background:${T.sectionBg};padding:24px 40px;text-align:center;border-bottom:1px solid ${T.border};">
    <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0;font-family:${T.fontSans};">${html}</p>
</div>`;
}

/**
 * Info card with left purple border, kicker label, and italic text.
 */
function foddaInfoCard(kicker: string, text: string): string {
    return `<div style="background:${T.cardBg};border:1px solid #e5e7eb;border-left:3px solid ${T.primary};border-radius:12px;padding:16px 20px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:${T.primary};margin-bottom:8px;font-family:${T.fontSans};">${kicker}</div>
    <p style="font-size:16px;font-style:italic;color:#1f2937;line-height:1.45;margin:0;font-family:${T.fontSerif};">${text}</p>
</div>`;
}

/**
 * White content body block — for general text content inside the wrapper.
 */
function foddaBody(html: string): string {
    return `<div style="background:#fff;padding:32px 40px;border-bottom:1px solid ${T.border};">
    <div style="font-size:14.5px;color:${T.textBody};font-weight:300;line-height:1.65;font-family:${T.fontSans};">${html}</div>
</div>`;
}

/**
 * Prompt item — monospace code-style block with purple left border.
 */
function foddaPromptItem(text: string): string {
    return `<div style="margin:0 0 12px 0;font-family:${T.fontMono};font-size:13px;background:${T.primaryLight};padding:12px 16px;border-left:3px solid ${T.primary};border-radius:6px;color:${T.textDark};">${text}</div>`;
}

/**
 * MCP URL info card (green variant).
 */
function foddaMcpCard(apiKey: string, mcpUrl?: string, sseUrl?: string): string {
    const standardUrl = mcpUrl || `https://mcp.fodda.ai/mcp?api_key=${apiKey}`;
    const desktopSseUrl = sseUrl || `https://mcp.fodda.ai/sse?api_key=${apiKey}`;
    return `<div style="background:${T.greenBg};border:1px solid ${T.greenBorder};border-radius:12px;padding:16px 20px;margin:16px 0;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:${T.greenDark};margin-bottom:10px;font-family:${T.fontSans};">🔗 Your MCP URLs</div>
    <div style="font-size:13px;color:${T.textDark};font-family:${T.fontSans};line-height:1.8;">
        <strong>Standard (Claude Web/Gemini):</strong><br>
        <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:11px;font-family:${T.fontMono};">${standardUrl}</code><br>
        <strong>SSE (Cursor/Windsurf/Desktop):</strong><br>
        <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:11px;font-family:${T.fontMono};">${desktopSseUrl}</code>
    </div>
</div>`;
}

/**
 * Signature block — Piers Fawkes / Founder, Fodda.
 */
function foddaSignature(name: string = 'Piers', title: string = 'Founder, Fodda'): string {
    return `<p style="margin:24px 0 0;font-size:14px;color:${T.textDark};font-weight:500;font-family:${T.fontSans};">${name}<br><span style="font-weight:300;color:${T.textMuted};font-size:13px;">${title}</span></p>`;
}


// ── EMAIL TEMPLATES ────────────────────────────────────────────────────────────

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
    SIGNUP_CONFIRMATION: {
        subject: (data: any) => {
            if (data?.intent === 'trial') return "Your Fodda Trial API Key is Ready";
            if (data?.intent === 'legacy_migration') return "Your Fodda account has been upgraded";
            if (data?.intent === 'claude') return "Activate Fodda in Claude — confirm your email";
            if (data?.intent === 'app') return "Welcome to Fodda — confirm your email to get started";
            if (data?.intent === 'api') return "Your Fodda API key — confirm your email to activate";
            return "Confirm your email to finish signing up for Fodda";
        },
        body: (data: { confirmationLink: string; intent?: string; apiKey?: string; mcpUrl?: string; sseUrl?: string; claudeConnectorUrl?: string }) => {
            if (data.intent === 'trial') {
                const stdUrl = data.mcpUrl || (data.apiKey ? `https://mcp.fodda.ai/mcp?api_key=${data.apiKey}` : '');
                const sseUrl = data.sseUrl || (data.apiKey ? `https://mcp.fodda.ai/sse?api_key=${data.apiKey}` : '');
                const claudeInstallUrl = data.claudeConnectorUrl || (stdUrl
                    ? `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(stdUrl)}`
                    : 'https://claude.ai/settings/connectors?modal=add-custom-connector');

                return `
Hi - I'm an automated agent that helps Piers and the Fodda team get people started quicker.

Looks like you recently filled a form (or the form was filled for you) to try out Fodda. Super cool. 

This is just a run of the mill note to say your Fodda trial is now active! Your API key and connection details are ready below.

3 things:

1. It would be super useful if you could please confirm your email address at some point using the link below so you can access your account portal dashboard later:

👉 Confirm my email
${data.confirmationLink}

2. If you use Claude, Perplexity or an AI system with an e-z connector, why don't you just plug in your MCP URL? 

⚡ Add Fodda to Claude in one click:
${claudeInstallUrl}

${data.apiKey || stdUrl ? `Your MCP URLs:
• Standard (Claude Web/Gemini): ${stdUrl}
• SSE (Cursor/Windsurf/Desktop): ${sseUrl}` : ''}

3. Need help getting started? Or the link didn't work? You can reply with your questions and I'll try to help you - or check out our quickstart guide:
👉 https://app.fodda.ai/Fodda_Quickstart.md

If you didn't sign up for Fodda, you can safely ignore this email.

Thanks for making your AI even smarter!

Team Fodda
                `.trim();
            }

            if (data.intent === 'legacy_migration') {
                return `
Hi there, I'm an intelligent assistant helping users get the most out of Fodda.

Your previous trial key no longer works so I took the opportunity to set you up on a free base account. Cool, eh?

Please confirm your email address using the link below so you can keep access to Fodda data.

👉 Confirm my email
${data.confirmationLink}

${(data.apiKey || data.mcpUrl) ? `Your MCP URL will be:\n• Standard (Claude Web/Gemini): ${data.mcpUrl || `https://mcp.fodda.ai/mcp?api_key=${data.apiKey}`}\n• SSE (Cursor/Windsurf/Desktop): ${data.sseUrl || `https://mcp.fodda.ai/sse?api_key=${data.apiKey}`}\n\n⚡ Add Fodda to Claude in one click:\nhttps://claude.ai/settings/connectors?modal=add-custom-connector\n(Paste your Standard MCP URL when prompted)\n` : ''}
Need help getting started? Just reply back to me with questions or check out our quickstart guide:
👉 https://app.fodda.ai/Fodda_Quickstart.md

If you don't want to use Fodda and hear from us, just reply with the initials 'WTF' and we'll work on getting you off the list.

Thanks

Team Fodda
                `.trim();
            }

            // Otherwise, keep the standard signup template
            const intentLines: Record<string, string> = {
                claude: "You're almost ready to connect Fodda to Claude. Just confirm your email to activate your API key.",
                app: "You're almost ready to start exploring Fodda. Just confirm your email to get started.",
                api: "You're almost ready to get API access to Fodda.",
                demo: "You're almost ready to demo Fodda.",
                account: "You're almost ready to complete your Fodda account setup but we need you to confirm your email address using the link below so you can access Fodda insights and our portal.",
            };
            const intentLine = intentLines[data.intent || 'account'] || intentLines.account;

            return `
Hi - I'm an intelligent agent helping our founder, Piers Fawkes, onboard new users.

${intentLine}

👉 Confirm my email
${data.confirmationLink}

${(data.apiKey || data.mcpUrl) ? `Your MCP URL will be:\n• Standard (Claude Web/Gemini): ${data.mcpUrl || `https://mcp.fodda.ai/mcp?api_key=${data.apiKey}`}\n• SSE (Cursor/Windsurf/Desktop): ${data.sseUrl || `https://mcp.fodda.ai/sse?api_key=${data.apiKey}`}\n\n⚡ Add Fodda to Claude in one click:\nhttps://claude.ai/settings/connectors?modal=add-custom-connector\n(Paste your Standard MCP URL when prompted)\n` : ''}
Need help getting started? Just reply back to me to get started or check out our quickstart guide:
👉 https://app.fodda.ai/Fodda_Quickstart.md

If you didn't sign up for Fodda, you should reply back with the initials 'WTF'. And if the link doesn't work for any reason, just reply here and I'll sort it.

Thanks — and see you on the inside.

Team Fodda
            `.trim();
        },
        html: (data: { confirmationLink: string; intent?: string; apiKey?: string; mcpUrl?: string; sseUrl?: string; claudeConnectorUrl?: string }) => {
            if (data.intent === 'trial') {
                const stdUrl = data.mcpUrl || (data.apiKey ? `https://mcp.fodda.ai/mcp?api_key=${data.apiKey}` : '');
                const claudeInstallUrl = data.claudeConnectorUrl || (stdUrl 
                    ? `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(stdUrl)}`
                    : 'https://claude.ai/settings/connectors?modal=add-custom-connector');

                return foddaWrap({
                    statusChip: { text: 'Trial Active', dotColor: T.green },
                    content: [
                        foddaHero({
                            kicker: 'Getting Started',
                            headline: 'Your trial is active',
                            bodyHtml: `<p style="margin:0 0 12px;">Hi — I'm an automated agent that helps Piers and the Fodda team get people started quicker.</p>
<p style="margin:0 0 12px;">Looks like you recently filled a form (or the form was filled for you) to try out Fodda. Super cool.</p>
<p style="margin:0;">Your API key and connection details are ready below.</p>`
                        }),
                        foddaSection('Step 1 · Confirm Email', `
                            <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0 0 16px;font-family:${T.fontSans};">Confirm your email so you can access your account portal dashboard later.</p>
                            ${foddaButton('Confirm My Email', data.confirmationLink)}
                            <p style="font-size:11px;color:${T.textMuted};margin:12px 0 0;font-family:${T.fontSans};">Or copy: ${data.confirmationLink}</p>
                        `),
                        foddaSection('Step 2 · Connect to Claude', `
                            <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0 0 16px;font-family:${T.fontSans};">If you use Claude, Perplexity or an AI system with an e-z connector, plug in your MCP URL.</p>
                            ${foddaButton('Add Fodda to Claude', claudeInstallUrl, 'secondary')}
                            ${data.apiKey ? foddaMcpCard(data.apiKey) : ''}
                        `),
                        foddaSection('Step 3 · Get Help', `
                            <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0 0 16px;font-family:${T.fontSans};">Need help getting started? Reply with your questions or check out our quickstart guide.</p>
                            ${foddaButton('Fodda Quickstart', 'https://app.fodda.ai/Fodda_Quickstart.md', 'secondary')}
                        `),
                        foddaCtaStrip('If you didn\'t sign up for Fodda, you can safely ignore this email.'),
                    ].join('\n')
                });
            }

            if (data.intent === 'legacy_migration') {
                return foddaWrap({
                    statusChip: { text: 'Account Upgraded', dotColor: T.green },
                    content: [
                        foddaHero({
                            kicker: 'Account Migration',
                            headline: 'You\'re all set',
                            bodyHtml: `<p style="margin:0 0 12px;">Hi there, I'm an intelligent assistant helping users get the most out of Fodda.</p>
<p style="margin:0;">Your previous trial key no longer works so I took the opportunity to set you up on a free base account. Cool, eh?</p>`
                        }),
                        foddaSection('Confirm Your Email', `
                            <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0 0 16px;font-family:${T.fontSans};">Please confirm your email address so you can keep access to Fodda data.</p>
                            ${foddaButton('Confirm My Email', data.confirmationLink)}
                            <p style="font-size:11px;color:${T.textMuted};margin:12px 0 0;font-family:${T.fontSans};">Or copy: ${data.confirmationLink}</p>
                        `),
                        data.apiKey ? foddaSection('Your MCP URLs', `
                            ${foddaMcpCard(data.apiKey)}
                            <div style="margin-top:12px;">${foddaButton('Add Fodda to Claude', 'https://claude.ai/settings/connectors?modal=add-custom-connector', 'secondary')}</div>
                            <p style="font-size:12px;color:${T.textMuted};margin:8px 0 0;font-family:${T.fontSans};">Paste your Standard MCP URL when prompted</p>
                        `) : '',
                        foddaSection('Need Help?', `
                            <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0 0 16px;font-family:${T.fontSans};">Just reply back with questions or check out our quickstart guide.</p>
                            ${foddaButton('Fodda Quickstart', 'https://app.fodda.ai/Fodda_Quickstart.md', 'secondary')}
                        `),
                        foddaCtaStrip('If you don\'t want to use Fodda, just reply with \'WTF\' and we\'ll work on getting you off the list.'),
                    ].join('\n')
                });
            }

            const intentLines: Record<string, string> = {
                claude: "You're almost ready to connect Fodda to Claude. Just confirm your email to activate your API key.",
                app: "You're almost ready to start exploring Fodda. Just confirm your email to get started.",
                api: "You're almost ready to get API access to Fodda.",
                demo: "You're almost ready to demo Fodda.",
                account: "You're almost ready to complete your Fodda account setup. Confirm your email to access Fodda insights and our portal.",
            };
            const intentLine = intentLines[data.intent || 'account'] || intentLines.account;

            return foddaWrap({
                content: [
                    foddaHero({
                        kicker: 'Almost There',
                        headline: 'Confirm your email',
                        bodyHtml: `<p style="margin:0 0 12px;">Hi — I'm an intelligent agent helping our founder, Piers Fawkes, onboard new users.</p>
<p style="margin:0;">${intentLine}</p>`
                    }),
                    foddaSection('Confirm Email', `
                        ${foddaButton('Confirm My Email', data.confirmationLink)}
                        <p style="font-size:11px;color:${T.textMuted};margin:12px 0 0;font-family:${T.fontSans};">Or copy: ${data.confirmationLink}</p>
                    `),
                    data.apiKey ? foddaSection('Your MCP URLs', `
                        ${foddaMcpCard(data.apiKey)}
                        <div style="margin-top:12px;">${foddaButton('Add Fodda to Claude', 'https://claude.ai/settings/connectors?modal=add-custom-connector', 'secondary')}</div>
                    `) : '',
                    foddaSection('Get Started', `
                        <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0 0 16px;font-family:${T.fontSans};">Just reply back to get started or check out our quickstart guide.</p>
                        ${foddaButton('Fodda Quickstart', 'https://app.fodda.ai/Fodda_Quickstart.md', 'secondary')}
                    `),
                    foddaCtaStrip('If you didn\'t sign up for Fodda, reply with \'WTF\' and we\'ll sort it. If the link doesn\'t work, just reply here.'),
                ].join('\n')
            });
        }
    },

    WELCOME_EMAIL: {
        subject: "Fodda: Did you find what you were looking for?",
        body: () => `
Hey there - would love to hear what you thought of Fodda? What was missing? What was hard to find?

Piers Fawkes
Founder
PSFK / Fodda
    `.trim(),
        html: () => foddaWrap({
            content: [
                foddaHero({
                    headline: 'Quick question',
                    bodyHtml: `<p style="margin:0;">Hey there — would love to hear what you thought of Fodda? What was missing? What was hard to find?</p>`
                }),
                foddaBody(foddaSignature('Piers Fawkes', 'Founder · PSFK / Fodda')),
            ].join('\n')
        })
    },

    ONBOARDING_PROMPTS: {
        subject: "5 prompts to start with",
        body: (data: { firstName?: string; graphId?: string; buyerType?: string; buyerIndustry?: string; prompts: string[] }) => {
            const { firstName, buyerType, buyerIndustry, prompts = [] } = data;

            // Personalisation line — only if we have a known buyer type or industry
            const isKnownType = buyerType && buyerType !== 'Unknown';
            const industryLabel = buyerIndustry || buyerType || '';
            const personalisationLine = isKnownType
                ? `Given you work in ${industryLabel.toLowerCase()}, here are 5 prompts worth trying —`
                : 'Here are 5 prompts worth trying —';

            const promptList = prompts.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join('\n');

            const greeting = firstName ? `${firstName},` : 'You';

            return `${greeting} you're set up. ${personalisationLine} paste any of these into Claude with Fodda connected, or into the app at fodda.ai.

${promptList}

I've intentionally kept these example prompts short. Fodda's knowledge graphs generally deliver the most precise and useful insights when you use specific, focused queries rather than longer, more general questions.
Let me know what comes back.

Piers`.trim();
        },
        html: (data: { firstName?: string; graphId?: string; buyerType?: string; buyerIndustry?: string; prompts: string[] }) => {
            const { firstName, buyerType, buyerIndustry, prompts = [] } = data;

            const isKnownType = buyerType && buyerType !== 'Unknown';
            const industryLabel = buyerIndustry || buyerType || '';
            const personalisationLine = isKnownType
                ? `Given you work in ${industryLabel.toLowerCase()}, here are 5 prompts worth trying —`
                : 'Here are 5 prompts worth trying —';

            const greeting = firstName ? `${firstName}, you're set up.` : `You're set up.`;
            const promptItems = prompts.slice(0, 5).map(p => foddaPromptItem(p)).join('\n');

            return foddaWrap({
                statusChip: { text: 'Onboarded', dotColor: T.green },
                content: [
                    foddaHero({
                        kicker: 'Getting Started',
                        headline: '5 prompts to try',
                        bodyHtml: `<p style="margin:0;">${greeting} ${personalisationLine} paste any of these into Claude with Fodda connected, or into the app at <a href="https://app.fodda.ai" style="color:${T.primary};font-weight:500;">fodda.ai</a>.</p>`
                    }),
                    foddaSection('Try These Prompts', `
                        ${promptItems}
                    `),
                    foddaBody(`
                        ${foddaInfoCard('Tip', 'I\'ve intentionally kept these example prompts short. Fodda\'s knowledge graphs generally deliver the most precise and useful insights when you use specific, focused queries rather than longer, more general questions.')}
                        <p style="margin:16px 0 0;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">Let me know what comes back.</p>
                        ${foddaSignature('Piers')}
                    `),
                ].join('\n')
            });
        }
    },

    CLIENT_WELCOME_PROMPTS: {
        subject: (data: { isUpgrade?: boolean }) => data.isUpgrade ? "Thank you for joining Fodda + 5 prompts to try" : "Welcome to Fodda + 5 prompts to try",
        body: (data: { firstName?: string; isUpgrade?: boolean; buyerType?: string; buyerIndustry?: string; prompts: string[] }) => {
            const { firstName, isUpgrade, buyerType, buyerIndustry, prompts = [] } = data;
            
            const action = isUpgrade ? "Thank you for joining Fodda." : "Welcome to Fodda.";
            const greeting = firstName ? `${action} Happy to have you with us, ${firstName}.` : action;

            const isKnownType = buyerType && buyerType !== 'Unknown';
            const industryLabel = buyerIndustry || buyerType || '';
            const personalisationLine = isKnownType
                ? `Given your focus in ${industryLabel.toLowerCase()}, I wanted to share 5 prompts that I think will show you the depth of the intelligence we've built —`
                : 'To help you get started, here are 5 prompts that show the depth of the intelligence we\'ve built —';

            const promptList = prompts.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join('\n');

            return `${greeting} ${personalisationLine} paste any of these into Claude with Fodda connected, or into the app at fodda.ai.

${promptList}

I've intentionally kept these example prompts short. Fodda's knowledge graphs generally deliver the most precise and useful insights when you use specific, focused queries rather than longer, more general questions.

I'm looking forward to seeing how you use the system. If you have any questions or hit any walls, just reply here.

Piers`.trim();
        },
        html: (data: { firstName?: string; isUpgrade?: boolean; buyerType?: string; buyerIndustry?: string; prompts: string[] }) => {
            const { firstName, isUpgrade, buyerType, buyerIndustry, prompts = [] } = data;

            const action = isUpgrade ? "Thank you for joining Fodda." : "Welcome to Fodda.";
            const greeting = firstName ? `${action} Happy to have you with us, ${firstName}.` : action;

            const isKnownType = buyerType && buyerType !== 'Unknown';
            const industryLabel = buyerIndustry || buyerType || '';
            const personalisationLine = isKnownType
                ? `Given your focus in ${industryLabel.toLowerCase()}, I wanted to share 5 prompts that I think will show you the depth of the intelligence we've built —`
                : 'To help you get started, here are 5 prompts that show the depth of the intelligence we\'ve built —';

            const promptItems = prompts.slice(0, 5).map(p => foddaPromptItem(p)).join('\n');

            return foddaWrap({
                statusChip: { text: isUpgrade ? 'Upgraded' : 'Welcome', dotColor: T.green },
                content: [
                    foddaHero({
                        kicker: isUpgrade ? 'Thank You' : 'Welcome',
                        headline: '5 prompts to try',
                        bodyHtml: `<p style="margin:0;">${greeting} ${personalisationLine} paste any of these into Claude with Fodda connected, or into the app at <a href="https://app.fodda.ai" style="color:${T.primary};font-weight:500;">fodda.ai</a>.</p>`
                    }),
                    foddaSection('Try These Prompts', `
                        ${promptItems}
                    `),
                    foddaBody(`
                        ${foddaInfoCard('Tip', 'I\'ve intentionally kept these example prompts short. Fodda\'s knowledge graphs generally deliver the most precise and useful insights when you use specific, focused queries rather than longer, more general questions.')}
                        <p style="margin:16px 0 0;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">I'm looking forward to seeing how you use the system. If you have any questions or hit any walls, just reply here.</p>
                        ${foddaSignature('Piers')}
                    `),
                ].join('\n')
            });
        }
    },

    DEVELOPER_ONBOARDING: {
        subject: "Fodda MCP: Your access details",
        body: (data: { firstName?: string; apiKey?: string; prompts?: string[] }) => {
            const greeting = data.firstName ? `${data.firstName}, you're set up.` : `You're set up.`;
            
            return `${greeting}

Your account is active on the Free Base plan with 100 API tokens per month. You can start using Fodda's knowledge graphs immediately in your agentic IDE or via direct API.

Here are your MCP connection URLs:
• Standard (Claude Web/Gemini): ${data.mcpUrl || (data.apiKey ? `https://mcp.fodda.ai/mcp?api_key=${data.apiKey}` : 'YOUR_MCP_URL')}
• SSE (Cursor/Windsurf/Desktop): ${data.sseUrl || (data.apiKey ? `https://mcp.fodda.ai/sse?api_key=${data.apiKey}` : 'YOUR_SSE_URL')}

To add this to your editor:
• Claude Web: Add in one click → https://claude.ai/settings/connectors?modal=add-custom-connector (paste the Standard URL)
• Cursor: Settings > Features > MCP > + Add New MCP Server > Type: SSE, URL: the SSE URL
• Windsurf: Preferences > MCP Servers > Add Server > Type: SSE, URL: the SSE URL

Once connected, try this first query to test the integration:
"Use Fodda to find 3 case studies of how retailers are removing friction from the buying journey."

If you need the full docs or direct API references, check out:
👉 https://app.fodda.ai/Fodda_Quickstart.md

Let me know what you build.

Piers
Founder, Fodda`.trim();
        },
        html: (data: { firstName?: string; apiKey?: string; prompts?: string[] }) => {
            const greeting = data.firstName ? `${data.firstName}, you're set up.` : `You're set up.`;

            return foddaWrap({
                statusChip: { text: 'Developer', dotColor: T.green },
                content: [
                    foddaHero({
                        kicker: 'MCP Access',
                        headline: 'Your access details',
                        bodyHtml: `<p style="margin:0 0 12px;">${greeting}</p>
<p style="margin:0;">Your account is active on the Free Base plan with <strong>100 API tokens per month</strong>. You can start using Fodda's knowledge graphs immediately in your agentic IDE or via direct API.</p>`
                    }),
                    foddaSection('MCP Connection URLs', `
                        ${foddaMcpCard(data.apiKey || 'YOUR_API_KEY')}
                    `),
                    foddaSection('Connect Your Editor', `
                        <div style="font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                            <strong style="color:${T.textDark};">Claude Web:</strong> ${foddaButton('Add to Claude →', 'https://claude.ai/settings/connectors?modal=add-custom-connector', 'secondary')}<br>
                            <span style="font-size:12px;color:${T.textMuted};">Paste the Standard URL when prompted</span><br><br>
                            <strong style="color:${T.textDark};">Cursor:</strong> Settings &gt; Features &gt; MCP &gt; + Add New MCP Server &gt; Type: SSE<br>
                            <strong style="color:${T.textDark};">Windsurf:</strong> Preferences &gt; MCP Servers &gt; Add Server &gt; Type: SSE
                        </div>
                    `),
                    foddaSection('Test It', `
                        ${foddaPromptItem('Use Fodda to find 3 case studies of how retailers are removing friction from the buying journey.')}
                    `),
                    foddaBody(`
                        <p style="margin:0 0 16px;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">If you need the full docs or direct API references:</p>
                        ${foddaButton('Fodda Quickstart', 'https://app.fodda.ai/Fodda_Quickstart.md', 'secondary')}
                        <p style="margin:16px 0 0;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">Let me know what you build.</p>
                        ${foddaSignature()}
                    `),
                ].join('\n')
            });
        }
    },

    PROMPT_VALIDATION_ALERT: {
        subject: "[Fodda] Onboarding prompts need review",
        body: (data: { userEmail: string; graphSlug: string; validatedCount: number; failedPrompts: string[]; validatedPrompts: string[]; needsReview: string[] }) => {
            const { userEmail, graphSlug, validatedCount, failedPrompts, validatedPrompts, needsReview } = data;
            return `Piers — a new user's onboarding prompts need a look.

User: ${userEmail}
Graph: ${graphSlug}
Passed: ${validatedCount}/5

Failed prompts (returned < 3 results from the API):
${failedPrompts.map(p => `- ${p}`).join('\n') || 'None'}

Prompts that were sent:
${validatedPrompts.map(p => `- ${p}`).join('\n') || 'None sent — all failed'}

Full candidate list to review and fix:
${needsReview.map((p, i) => `${i + 1}. ${p}`).join('\n')}

You can update the prompt bank at: server/data/prompt-bank.json
Then redeploy to fix for future users.`.trim();
        },
        html: (data: { userEmail: string; graphSlug: string; validatedCount: number; failedPrompts: string[]; validatedPrompts: string[]; needsReview: string[] }) => {
            const { userEmail, graphSlug, validatedCount, failedPrompts, validatedPrompts, needsReview } = data;
            const failedHtml = failedPrompts.length > 0
                ? failedPrompts.map(p => `<li style="font-size:13px;color:${T.reject};font-family:${T.fontMono};">${p}</li>`).join('')
                : `<li style="font-size:13px;color:${T.textMuted};font-family:${T.fontSans};">None</li>`;
            const sentHtml = validatedPrompts.length > 0
                ? validatedPrompts.map(p => `<li style="font-size:13px;color:${T.textBody};font-family:${T.fontMono};">${p}</li>`).join('')
                : `<li style="font-size:13px;color:${T.textMuted};font-family:${T.fontSans};">None sent — all failed</li>`;
            const reviewHtml = needsReview.map((p, i) => foddaPromptItem(`${i + 1}. ${p}`)).join('\n');

            return foddaWrap({
                headerLabel: 'fodda.ai · admin',
                statusChip: { text: 'Needs Review', dotColor: T.amber },
                content: [
                    foddaHero({
                        kicker: 'Prompt Validation',
                        headline: 'Onboarding prompts need review',
                        bodyHtml: `<p style="margin:0;">A new user's onboarding prompts need a look.</p>`
                    }),
                    foddaSection('Details', `
                        <div style="font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                            <strong>User:</strong> ${userEmail}<br>
                            <strong>Graph:</strong> ${graphSlug}<br>
                            <strong>Passed:</strong> ${validatedCount}/5
                        </div>
                    `),
                    foddaSection('Failed Prompts', `<ul style="margin:0;padding-left:20px;">${failedHtml}</ul>`),
                    foddaSection('Prompts Sent', `<ul style="margin:0;padding-left:20px;">${sentHtml}</ul>`),
                    foddaSection('Full Candidate List', reviewHtml),
                    foddaCtaStrip(`Update the prompt bank at <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:12px;">server/data/prompt-bank.json</code> then redeploy.`),
                ].join('\n')
            });
        }
    },

    PLAN_LIMIT_WARNING: {
        subject: "Heads up — you're approaching your included API calls",
        body: (data: { name?: string; planName?: string; limit?: number; setupUrl?: string }) => `
Hi${data.name ? ` ${data.name}` : ''} — I'm an intelligent agent that helps Fodda users get the most out of the system.

You're getting close to the API call allocation on your current Fodda plan.${data.planName ? ` Your current plan is ${data.planName} which includes ${data.limit || 100} API calls a month.` : ''}

That usually means one of two things:
1. You're exploring deeply (good sign), or
2. You're starting to rely on Fodda as part of your actual workflow (even better)

When you go beyond your included API calls, you have two options:
• Add a payment method to keep querying at $0.50 per API call (overage billing)
• Upgrade to a plan with more included API calls at a lower per-call cost
${data.setupUrl ? `
👉 Add a payment method (one click):
${data.setupUrl}
` : ''}
👉 View other plan options:
https://www.fodda.ai/pricing

If you're unsure which plan makes sense, reply here and tell me how you're using it. Happy to point you in the right direction.

Team Fodda
    `.trim(),
        html: (data: { name?: string; planName?: string; limit?: number; setupUrl?: string }) => {
            const planInfo = data.planName
                ? `Your current plan is <strong>${data.planName}</strong> which includes <strong>${data.limit || 100} API calls</strong> a month.`
                : '';

            return foddaWrap({
                statusChip: { text: 'Usage Alert', dotColor: T.amber },
                content: [
                    foddaHero({
                        kicker: 'Usage',
                        headline: 'Approaching your limit',
                        bodyHtml: `<p style="margin:0 0 12px;">You're getting close to the API call allocation on your current Fodda plan. ${planInfo}</p>
<p style="margin:0;">That usually means one of two things:</p>`
                    }),
                    foddaBody(`
                        <ol style="margin:0 0 20px;padding-left:20px;font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                            <li>You're exploring deeply (good sign), or</li>
                            <li>You're starting to rely on Fodda as part of your actual workflow (even better)</li>
                        </ol>
                        ${foddaInfoCard('Your Options', 'Add a payment method for overage at $0.50 per API call, or upgrade to a plan with more included calls at a lower per-call cost.')}
                    `),
                    foddaSection('Next Steps', `
                        <div style="text-align:center;">
                            ${data.setupUrl ? foddaButton('Add Payment Method', data.setupUrl) + '<br><br>' : ''}
                            ${foddaButton('View Plans & Pricing', 'https://www.fodda.ai/pricing', 'secondary')}
                        </div>
                        <p style="font-size:13px;color:${T.textMuted};margin:16px 0 0;text-align:center;font-family:${T.fontSans};">Not sure which plan? Just reply and tell us how you're using it.</p>
                    `),
                ].join('\n')
            });
        }
    },

    LAPSED_NOTIFICATION: {
        subject: "Your Fodda access has paused (no worries)",
        body: () => `
Hi — just a quick note.

Your Fodda access has paused because your subscription ended. No drama — everything you explored is still here if you want to pick it back up.

If the timing wasn't right, that's totally fine. Fodda isn't a "check every day" product — it's more of a reach-for-it-when-you-need-better context kind of thing.

When you're ready, you can:
• Reactivate anytime
• Jump back into the same graphs
• Or explore what's new since you last logged in

And if you decided Fodda wasn't useful for what you're working on, I'd genuinely love to know why. A one-line reply is more than enough.

Either way — thanks for giving it a try.

Piers
Founder, Fodda
    `.trim(),
        html: () => foddaWrap({
            statusChip: { text: 'Paused', dotColor: T.textMuted },
            content: [
                foddaHero({
                    headline: 'Your access has paused',
                    bodyHtml: `<p style="margin:0 0 12px;">Your Fodda access has paused because your subscription ended. No drama — everything you explored is still here if you want to pick it back up.</p>
<p style="margin:0;">If the timing wasn't right, that's totally fine. Fodda isn't a "check every day" product — it's more of a reach-for-it-when-you-need-better-context kind of thing.</p>`
                }),
                foddaSection('When You\'re Ready', `
                    <ul style="margin:0;padding-left:20px;font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                        <li>Reactivate anytime</li>
                        <li>Jump back into the same graphs</li>
                        <li>Or explore what's new since you last logged in</li>
                    </ul>
                `),
                foddaBody(`
                    <p style="margin:0 0 16px;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">And if you decided Fodda wasn't useful for what you're working on, I'd genuinely love to know why. A one-line reply is more than enough.</p>
                    <p style="margin:0;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">Either way — thanks for giving it a try.</p>
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    OVERAGE_ACTIVATED: {
        subject: "You're now being charged for Fodda usage",
        body: (data: { name?: string; limit?: number; overageRate?: string }) => `
Hi${data.name ? ` ${data.name}` : ''} — heads up.

You've exceeded your monthly token limit (${data.limit || 100} tokens) and overage billing is now active.

• Overage rate: ${data.overageRate || '$0.50'} per API call (×graph multiplier)
• This will be billed at the end of your billing cycle

Want a better rate? Upgrading your plan gives you more included tokens at a lower per-query cost — often significantly cheaper than paying overage.

👉 View plans and upgrade:
https://app.fodda.ai?view=billing

You can see your current usage anytime in the Account Portal.

No surprises — we'll only charge what you actually use. If you want to pause overage, remove your payment method from Billing settings.

Piers
Founder, Fodda
    `.trim(),
        html: (data: { name?: string; limit?: number; overageRate?: string }) => foddaWrap({
            statusChip: { text: 'Overage Active', dotColor: T.amber },
            content: [
                foddaHero({
                    kicker: 'Billing',
                    headline: 'Overage billing is active',
                    bodyHtml: `<p style="margin:0;">You've exceeded your monthly token limit (<strong>${data.limit || 100} tokens</strong>) and overage billing is now active.</p>`
                }),
                foddaSection('Current Rates', `
                    <div style="font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                        <strong>Overage rate:</strong> ${data.overageRate || '$0.50'} per API call (×graph multiplier)<br>
                        <strong>Billing:</strong> Billed at the end of your billing cycle
                    </div>
                `),
                foddaBody(`
                    ${foddaInfoCard('Save Money', 'Upgrading your plan gives you more included tokens at a lower per-query cost — often significantly cheaper than paying overage.')}
                    <div style="margin-top:20px;text-align:center;">
                        ${foddaButton('View Plans & Upgrade', 'https://app.fodda.ai?view=billing')}
                    </div>
                    <p style="margin:16px 0 0;font-size:12px;color:${T.textMuted};text-align:center;font-family:${T.fontSans};">No surprises — we'll only charge what you actually use. To pause overage, remove your payment method from Billing settings.</p>
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    OVERAGE_PAYMENT_FAILED: {
        subject: "Your Fodda overage payment failed",
        body: (data: { name?: string; amount?: string }) => `
Hi${data.name ? ` ${data.name}` : ''} —

We tried to charge your card for ${data.amount || 'your'} overage usage this billing cycle, but the payment didn't go through.

This usually happens when:
• The card on file has expired
• There are insufficient funds
• Your bank flagged the charge

To keep your overage access active, please update your payment method:

👉 Update payment method:
https://app.fodda.ai?view=billing

If you don't update within 7 days, your account will revert to the standard plan limit with no overage access.

If you have any questions, just reply to this email.

Piers
Founder, Fodda
    `.trim(),
        html: (data: { name?: string; amount?: string }) => foddaWrap({
            statusChip: { text: 'Payment Failed', dotColor: T.reject },
            content: [
                foddaHero({
                    kicker: 'Billing',
                    headline: 'Payment didn\'t go through',
                    bodyHtml: `<p style="margin:0;">We tried to charge your card for <strong>${data.amount || 'your'}</strong> overage usage this billing cycle, but the payment didn't go through.</p>`
                }),
                foddaSection('Common Reasons', `
                    <ul style="margin:0;padding-left:20px;font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                        <li>The card on file has expired</li>
                        <li>There are insufficient funds</li>
                        <li>Your bank flagged the charge</li>
                    </ul>
                `),
                foddaBody(`
                    <p style="margin:0 0 16px;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">To keep your overage access active, please update your payment method.</p>
                    <div style="text-align:center;">
                        ${foddaButton('Update Payment Method', 'https://app.fodda.ai?view=billing')}
                    </div>
                    <p style="margin:16px 0 0;font-size:12px;color:${T.textMuted};text-align:center;font-family:${T.fontSans};">If you don't update within 7 days, your account will revert to the standard plan limit with no overage access.</p>
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    AGENT_PAYMENT_NUDGE: {
        subject: "Quick tip — set up payment so your agent never stops",
        body: (data: { name?: string; setupUrl?: string }) => `
Hi${data.name ? ` ${data.name}` : ''} — I'm an intelligent agent that helps Fodda users get the most out of the system.

Quick tip now that you're set up: if you're connecting Fodda to an AI agent (Claude, Cursor, or via API), your agent will stop querying when it hits your plan's included API calls.

To prevent interruptions, you can set up a payment method now. Three options:

• Credit Card — add a card and overage kicks in automatically at $0.50 per API call beyond your allocation.${data.setupUrl ? ` One click:\n${data.setupUrl}` : ''}

• Lava PAYG — give your agent a metered wallet with a fixed monthly cap:
https://lava.so

• Choose a subscription plan. Learn more about plans:
https://www.fodda.ai/pricing

We are also set up to handle Stripe SPT payments from agents.

Team Fodda
    `.trim(),
        html: (data: { name?: string; setupUrl?: string }) => foddaWrap({
            content: [
                foddaHero({
                    kicker: 'Pro Tip',
                    headline: 'Keep your agent running',
                    bodyHtml: `<p style="margin:0 0 12px;">Quick tip now that you're set up: if you're connecting Fodda to an AI agent (Claude, Cursor, or via API), your agent will stop querying when it hits your plan's included API calls.</p>
<p style="margin:0;">To prevent interruptions, set up a payment method now.</p>`
                }),
                foddaSection('Payment Options', `
                    <div style="font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                        <strong style="color:${T.textDark};">💳 Credit Card</strong> — add a card and overage kicks in at $0.50 per API call beyond your allocation.<br>
                        <strong style="color:${T.textDark};">⚡ Lava PAYG</strong> — give your agent a metered wallet with a fixed monthly cap.<br>
                        <strong style="color:${T.textDark};">📋 Subscription</strong> — choose a plan with more included calls.
                    </div>
                    <div style="margin-top:20px;text-align:center;">
                        ${data.setupUrl ? foddaButton('Add Payment Method', data.setupUrl) + '&nbsp;&nbsp;' : ''}
                        ${foddaButton('View Plans', 'https://www.fodda.ai/pricing', 'secondary')}
                    </div>
                    <p style="font-size:12px;color:${T.textMuted};margin:16px 0 0;text-align:center;font-family:${T.fontSans};">We also handle Stripe SPT payments from agents.</p>
                `),
            ].join('\n')
        })
    },

    MAGIC_LINK_LOGIN: {
        subject: "Log in to Fodda",
        body: (data: { loginLink: string }) => `
Hi there,

Click the link below to log in to your Fodda account:

👉 Log In
${data.loginLink}

This link is valid for 15 minutes. If you didn't request this, you can safely ignore this email.

Piers
Founder, Fodda
    `.trim(),
        html: (data: { loginLink: string }) => foddaWrap({
            content: [
                foddaHero({
                    headline: 'Log in to Fodda',
                    bodyHtml: `<p style="margin:0;">Click the button below to log in to your Fodda account. This link is valid for 15 minutes.</p>`
                }),
                foddaSection('Your Login Link', `
                    <div style="text-align:center;">
                        ${foddaButton('Log In to Fodda', data.loginLink)}
                    </div>
                    <p style="font-size:11px;color:${T.textMuted};margin:12px 0 0;text-align:center;font-family:${T.fontSans};">Or copy: ${data.loginLink}</p>
                `),
                foddaCtaStrip('If you didn\'t request this, you can safely ignore this email.'),
            ].join('\n')
        })
    },

    NEW_USER_JOINED: {
        subject: "New team member joined your Fodda account",
        body: (data: { newUserName: string; newUserEmail: string; newUserRole: string; accountName: string; portalLink: string }) => `
Hi — quick update.

${data.newUserName} (${data.newUserEmail}) just joined your Fodda account "${data.accountName}" as ${data.newUserRole}.

You can manage your team, adjust roles, or review their access here:

👉 Open Account Portal
${data.portalLink}

If you weren't expecting this, it's possible someone has your team's signup code. You can regenerate it from the Account Portal.

Piers
Founder, Fodda
    `.trim(),
        html: (data: { newUserName: string; newUserEmail: string; newUserRole: string; accountName: string; portalLink: string }) => foddaWrap({
            statusChip: { text: 'New Member', dotColor: T.green },
            content: [
                foddaHero({
                    kicker: 'Team Update',
                    headline: 'New member joined',
                    bodyHtml: `<p style="margin:0;"><strong>${data.newUserName}</strong> (${data.newUserEmail}) just joined your Fodda account "<strong>${data.accountName}</strong>" as <strong>${data.newUserRole}</strong>.</p>`
                }),
                foddaSection('Manage Team', `
                    <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0 0 16px;font-family:${T.fontSans};">You can manage your team, adjust roles, or review their access here.</p>
                    <div style="text-align:center;">
                        ${foddaButton('Open Account Portal', data.portalLink)}
                    </div>
                `),
                foddaCtaStrip('If you weren\'t expecting this, it\'s possible someone has your team\'s signup code. You can regenerate it from the Account Portal.'),
            ].join('\n')
        })
    },

    PLAN_UPGRADED: {
        subject: "Your Fodda plan has been upgraded!",
        body: (data: { planName: string; queryLimit: string; name?: string; apiKey?: string }) => `
Hi${data.name ? ` ${data.name}` : ''} 👋

Great news — your Fodda plan has been upgraded to **${data.planName}**!

Here's what's changed:
• Monthly API call allowance: ${data.queryLimit} API calls/month
• Your API call counter has been reset for the new billing period
${data.apiKey ? `
🔗 CONNECT FODDA
• Standard MCP URL (Claude Web/Gemini): ${data.mcpUrl || `https://mcp.fodda.ai/mcp?api_key=${data.apiKey}`}
• SSE MCP URL (Cursor/Windsurf/Desktop): ${data.sseUrl || `https://mcp.fodda.ai/sse?api_key=${data.apiKey}`}

⚡ Add Fodda to Claude in one click:
https://claude.ai/settings/connectors?modal=add-custom-connector
(Paste the Standard MCP URL above when prompted)
` : ''}
You can manage your plan and see your API call usage anytime in the Account Portal:
👉 https://app.fodda.ai

If you have any questions about your plan, just reply to this email.

Thanks for upgrading — enjoy the expanded access!

Piers
Founder, Fodda
    `.trim(),
        html: (data: { planName: string; queryLimit: string; name?: string; apiKey?: string }) => foddaWrap({
            statusChip: { text: 'Upgraded', dotColor: T.green },
            content: [
                foddaHero({
                    kicker: 'Plan Update',
                    headline: `Welcome to ${data.planName}`,
                    bodyHtml: `<p style="margin:0;">Great news — your Fodda plan has been upgraded! Here's what's changed.</p>`
                }),
                foddaSection('What\'s New', `
                    <div style="font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                        <strong>Monthly API calls:</strong> ${data.queryLimit} API calls/month<br>
                        <strong>Counter:</strong> Reset for the new billing period
                    </div>
                `),
                data.apiKey ? foddaSection('Connect Fodda', `
                    ${foddaMcpCard(data.apiKey)}
                    <div style="margin-top:12px;text-align:center;">
                        ${foddaButton('Add to Claude →', 'https://claude.ai/settings/connectors?modal=add-custom-connector', 'secondary')}
                    </div>
                    <p style="font-size:12px;color:${T.textMuted};margin:8px 0 0;text-align:center;font-family:${T.fontSans};">Paste the Standard MCP URL when prompted</p>
                `) : '',
                foddaBody(`
                    <div style="text-align:center;">
                        ${foddaButton('Open Account Portal', 'https://app.fodda.ai', 'secondary')}
                    </div>
                    <p style="margin:16px 0 0;font-size:14px;color:${T.textBody};text-align:center;font-family:${T.fontSans};">Thanks for upgrading — enjoy the expanded access!</p>
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    TOP_UP_CONFIRMED: {
        subject: "API calls added to your Fodda account!",
        body: (data: { tokenAmount: number; totalBonus: number; name?: string }) => `
Hi${data.name ? ` ${data.name}` : ''} 👋

Your top-up purchase has been applied — **${data.tokenAmount} bonus API calls** have been added to your account!

Here's your current balance:
• Bonus API calls available: ${data.totalBonus}
• These API calls are on top of your monthly plan allowance
• They don't expire and won't reset at the end of the billing cycle

You can see your API call usage anytime in the Account Portal:
👉 https://app.fodda.ai

Thanks for the support — happy researching!

Piers
Founder, Fodda
    `.trim(),
        html: (data: { tokenAmount: number; totalBonus: number; name?: string }) => foddaWrap({
            statusChip: { text: 'Top-Up Applied', dotColor: T.green },
            content: [
                foddaHero({
                    kicker: 'Billing',
                    headline: `${data.tokenAmount} calls added`,
                    bodyHtml: `<p style="margin:0;">Your top-up purchase has been applied — <strong>${data.tokenAmount} bonus API calls</strong> have been added to your account!</p>`
                }),
                foddaSection('Your Balance', `
                    <div style="background:${T.greenBg};border:1px solid ${T.greenBorder};border-radius:12px;padding:16px 20px;">
                        <div style="font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                            <strong>Bonus API calls available:</strong> ${data.totalBonus}<br>
                            <strong>These are on top of</strong> your monthly plan allowance<br>
                            <strong>They don't expire</strong> and won't reset at the end of the billing cycle
                        </div>
                    </div>
                `),
                foddaBody(`
                    <div style="text-align:center;">
                        ${foddaButton('View Usage in Portal', 'https://app.fodda.ai', 'secondary')}
                    </div>
                    <p style="margin:16px 0 0;font-size:14px;color:${T.textBody};text-align:center;font-family:${T.fontSans};">Thanks for the support — happy researching!</p>
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    EXPERT_GRAPH_SUBMITTED_ADMIN: {
        subject: "[Fodda] New Expert Graph Submitted for Review",
        body: (data: { expertName: string; expertEmail: string; graphName: string; graphSlug: string; trendCount?: number; evidenceCount?: number }) => `
Piers — a new expert graph has been submitted for review.

Expert: ${data.expertName} (${data.expertEmail})
Graph: ${data.graphName}
Slug: ${data.graphSlug}
Trends: ${data.trendCount || 'Pending extraction'}
Evidence: ${data.evidenceCount || 'Pending extraction'}

Review it here:
👉 https://expert.fodda.ai/admin?review=${data.graphSlug}

Or log in to the App at https://app.fodda.ai to view the submission.
    `.trim(),
        html: (data: { expertName: string; expertEmail: string; graphName: string; graphSlug: string; trendCount?: number; evidenceCount?: number }) => foddaWrap({
            headerLabel: 'fodda.ai · admin',
            statusChip: { text: 'New Submission', dotColor: T.amber },
            content: [
                foddaHero({
                    kicker: 'Expert Graph',
                    headline: 'New submission for review',
                    bodyHtml: `<p style="margin:0;">A new expert graph has been submitted for review.</p>`
                }),
                foddaSection('Submission Details', `
                    <div style="font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                        <strong>Expert:</strong> ${data.expertName} (${data.expertEmail})<br>
                        <strong>Graph:</strong> ${data.graphName}<br>
                        <strong>Slug:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:12px;">${data.graphSlug}</code><br>
                        <strong>Trends:</strong> ${data.trendCount || 'Pending extraction'}<br>
                        <strong>Evidence:</strong> ${data.evidenceCount || 'Pending extraction'}
                    </div>
                `),
                foddaSection('Actions', `
                    <div style="text-align:center;">
                        ${foddaButton('Review Submission', `https://expert.fodda.ai/admin?review=${data.graphSlug}`)}
                        &nbsp;&nbsp;
                        ${foddaButton('View in App', 'https://app.fodda.ai', 'secondary')}
                    </div>
                `),
            ].join('\n')
        })
    },

    EXPERT_GRAPH_APPROVED: {
        subject: "Your Fodda graph is live! 🎉",
        body: (data: { expertName: string; graphName: string }) => `
Hi ${data.expertName} 👋

Great news — your graph "${data.graphName}" has been reviewed and approved!

It's now live on the Fodda network and queryable through the API, MCP, and Sandbox.

You can check your API call usage and earnings in the Account Portal:
👉 https://app.fodda.ai → My Graphs

Thanks for contributing to the Fodda network. The more great content we have, the more valuable it becomes for everyone.

Piers
Founder, Fodda
    `.trim(),
        html: (data: { expertName: string; graphName: string }) => foddaWrap({
            statusChip: { text: 'Approved', dotColor: T.green },
            content: [
                foddaHero({
                    kicker: 'Expert Graph',
                    headline: 'Your graph is live! 🎉',
                    bodyHtml: `<p style="margin:0;">Great news — your graph "<strong>${data.graphName}</strong>" has been reviewed and approved! It's now live on the Fodda network and queryable through the API, MCP, and Sandbox.</p>`
                }),
                foddaSection('What\'s Next', `
                    <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0 0 16px;font-family:${T.fontSans};">You can check your API call usage and earnings in the Account Portal.</p>
                    <div style="text-align:center;">
                        ${foddaButton('View My Graphs', 'https://app.fodda.ai')}
                    </div>
                `),
                foddaBody(`
                    ${foddaInfoCard('Thank You', 'Thanks for contributing to the Fodda network. The more great content we have, the more valuable it becomes for everyone.')}
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    EXPERT_GRAPH_FEEDBACK: {
        subject: "Revision requested for your Fodda graph",
        body: (data: { expertName: string; graphName: string; feedback: string }) => `
Hi ${data.expertName},

Thanks for submitting "${data.graphName}" to the Fodda network.

After reviewing it, we have some feedback before we can approve it:

---
${data.feedback}
---

You can update your submission in the Account Portal:
👉 https://app.fodda.ai → My Graphs → Edit & Resubmit

If you have any questions, just reply to this email.

Piers
Founder, Fodda
    `.trim(),
        html: (data: { expertName: string; graphName: string; feedback: string }) => foddaWrap({
            statusChip: { text: 'Revision Needed', dotColor: T.amber },
            content: [
                foddaHero({
                    kicker: 'Expert Graph',
                    headline: 'Revision requested',
                    bodyHtml: `<p style="margin:0;">Thanks for submitting "<strong>${data.graphName}</strong>" to the Fodda network. After reviewing it, we have some feedback before we can approve it.</p>`
                }),
                foddaSection('Feedback', `
                    ${foddaInfoCard('Reviewer Notes', data.feedback)}
                `),
                foddaSection('Next Steps', `
                    <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0 0 16px;font-family:${T.fontSans};">You can update your submission in the Account Portal.</p>
                    <div style="text-align:center;">
                        ${foddaButton('Edit & Resubmit', 'https://app.fodda.ai')}
                    </div>
                `),
                foddaCtaStrip('If you have any questions, just reply to this email.'),
            ].join('\n')
        })
    },

    PARTNER_WELCOME: {
        subject: "Your Fodda Studio Beta access is ready",
        body: (data: { name?: string; email: string; apiKey: string; stripeLink: string; companyName?: string }) => `
Hi${data.name ? ` ${data.name}` : ''} 👋

Thanks for joining the Fodda Studio Beta! You now have access to query across ALL Fodda knowledge graphs — trend intelligence, expert opinions, and real-time supplemental data from 20+ institutional sources.

🔑 YOUR ACCESS
• App Login: https://app.fodda.ai (use ${data.email})
• API Key: ${data.apiKey}
• Standard MCP URL (Web): ${data.mcpUrl || `https://mcp.fodda.ai/mcp?api_key=${data.apiKey}`}
• SSE MCP URL (Desktop): ${data.sseUrl || `https://mcp.fodda.ai/sse?api_key=${data.apiKey}`}

💳 ACTIVATE YOUR STUDIO PLAN ($1/month)
To lock in your Studio Beta access with 25,000 API calls/month, activate here:
👉 ${data.stripeLink}?prefilled_email=${encodeURIComponent(data.email)}

You can start exploring right away on our Base plan (100 API calls/month). When you're ready for the full Studio allocation, just click the link above.

📖 GETTING STARTED
1. Log into app.fodda.ai and explore the graph catalog
2. Try a query in the chat sandbox
3. Add Fodda to Claude in one click → https://claude.ai/settings/connectors?modal=add-custom-connector (paste the Standard MCP URL)
4. Or call the API directly — docs at https://app.fodda.ai/Fodda_Quickstart.md

🤖 AGENT-FRIENDLY SETUP GUIDE
Feed this markdown doc to your AI agent (Claude, Codex, Cursor, etc.) for automated setup:
👉 https://app.fodda.ai/Fodda_Quickstart.md

📋 PROMPTING GUIDE
For tips on getting the best results, there's a prompting guide at https://app.fodda.ai

👥 ADD TEAM MEMBERS
To add colleagues from your company, go to https://app.fodda.ai → Account Settings → Team Members and follow the instructions. Team members must use a matching company email domain.

I'll check in next week to see how things are going. If anything isn't working, just reply here.

Piers
Founder, Fodda
    `.trim(),
        html: (data: { name?: string; email: string; apiKey: string; stripeLink: string; companyName?: string }) => foddaWrap({
            statusChip: { text: 'Studio Beta', dotColor: T.green },
            content: [
                foddaHero({
                    kicker: 'Welcome',
                    headline: 'Studio Beta is ready',
                    bodyHtml: `<p style="margin:0;">Thanks for joining the Fodda Studio Beta! You now have access to query across <strong>ALL</strong> Fodda knowledge graphs — trend intelligence, expert opinions, and real-time supplemental data from 20+ institutional sources.</p>`
                }),
                foddaSection('Your Access', `
                    <div style="background:${T.greenBg};border:1px solid ${T.greenBorder};border-radius:12px;padding:16px 20px;">
                        <div style="font-size:13px;color:${T.textDark};font-family:${T.fontSans};line-height:1.8;">
                            <strong>App Login:</strong> <a href="https://app.fodda.ai" style="color:${T.primary};">app.fodda.ai</a> (use ${data.email})<br>
                            <strong>API Key:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:12px;font-family:${T.fontMono};">${data.apiKey}</code><br>
                            <strong>Standard MCP URL:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:11px;font-family:${T.fontMono};">${data.mcpUrl || `https://mcp.fodda.ai/mcp?api_key=${data.apiKey}`}</code><br>
                            <strong>SSE MCP URL:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:11px;font-family:${T.fontMono};">${data.sseUrl || `https://mcp.fodda.ai/sse?api_key=${data.apiKey}`}</code>
                        </div>
                    </div>
                `),
                foddaSection('Activate Studio Plan', `
                    <div style="background:${T.amberBg};border:1px solid ${T.amberBorder};border-radius:12px;padding:20px;text-align:center;">
                        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#854d0e;margin-bottom:8px;font-family:${T.fontSans};">💳 $1/month · 25,000 API calls</div>
                        <div style="margin-top:12px;">
                            ${foddaButton('Activate Studio Beta →', `${data.stripeLink}?prefilled_email=${encodeURIComponent(data.email)}`)}
                        </div>
                        <p style="font-size:12px;color:${T.textMuted};margin:12px 0 0;font-family:${T.fontSans};">Start on Base (100 calls/month) now. Upgrade when ready.</p>
                    </div>
                `),
                foddaSection('Getting Started', `
                    <ol style="margin:0;padding-left:20px;font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                        <li>Log into <a href="https://app.fodda.ai" style="color:${T.primary};">app.fodda.ai</a> and explore the graph catalog</li>
                        <li>Try a query in the chat sandbox</li>
                        <li><a href="https://claude.ai/settings/connectors?modal=add-custom-connector" style="color:${T.primary};">Add Fodda to Claude in one click →</a> (paste the Standard MCP URL)</li>
                        <li>Or call the API directly — docs at <a href="https://app.fodda.ai/Fodda_Quickstart.md" style="color:${T.primary};">Fodda Quickstart</a></li>
                    </ol>
                `),
                foddaSection('Agent Setup & Guides', `
                    ${foddaInfoCard('🤖 Agent-Friendly Setup', 'Feed the Fodda Quickstart doc to your AI agent (Claude, Codex, Cursor, etc.) for automated setup.')}
                    <div style="margin-top:12px;">
                        ${foddaButton('Quickstart Guide', 'https://app.fodda.ai/Fodda_Quickstart.md', 'secondary')}
                        &nbsp;&nbsp;
                        ${foddaButton('Prompting Guide', 'https://app.fodda.ai', 'secondary')}
                    </div>
                `),
                foddaSection('Add Team Members', `
                    <p style="font-size:14px;color:${T.textBody};line-height:1.6;margin:0;font-family:${T.fontSans};">To add colleagues from your company, go to <a href="https://app.fodda.ai" style="color:${T.primary};font-weight:500;">app.fodda.ai</a> → Account Settings → Team Members. Team members must use a matching company email domain.</p>
                `),
                foddaBody(`
                    <p style="margin:0;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">I'll check in next week to see how things are going. If anything isn't working, just reply here.</p>
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    EXPERT_GRAPH_DECLINED: {
        subject: "Update on your Fodda graph submission",
        body: (data: { expertName: string; graphName: string; reason?: string }) => `
Hi ${data.expertName},

Thanks for your interest in contributing to the Fodda network.

Unfortunately, we're unable to accept "${data.graphName}" at this time.${data.reason ? `\n\nReason: ${data.reason}` : ''}

This doesn't mean the door is closed — if you'd like to discuss what would make a strong submission, just reply to this email and we can chat.

Piers
Founder, Fodda
    `.trim(),
        html: (data: { expertName: string; graphName: string; reason?: string }) => foddaWrap({
            statusChip: { text: 'Not Accepted', dotColor: T.reject },
            content: [
                foddaHero({
                    kicker: 'Expert Graph',
                    headline: 'Submission update',
                    bodyHtml: `<p style="margin:0;">Thanks for your interest in contributing to the Fodda network. Unfortunately, we're unable to accept "<strong>${data.graphName}</strong>" at this time.</p>`
                }),
                data.reason ? foddaSection('Reason', `
                    ${foddaInfoCard('Details', data.reason)}
                `) : '',
                foddaBody(`
                    <p style="margin:0;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">This doesn't mean the door is closed — if you'd like to discuss what would make a strong submission, just reply to this email and we can chat.</p>
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    SUBSCRIPTION_CANCELLED: {
        subject: "Your Fodda subscription has ended",
        body: (data: { name?: string; planName?: string }) => `
Hi${data.name ? ` ${data.name}` : ''} —

Your Fodda subscription${data.planName ? ` (${data.planName})` : ''} has been cancelled. Your account has been moved to the free Base plan.

Your data, graphs, and research history are all still here — nothing is lost.

If you'd like to resubscribe at any time, just log in and visit the Billing section in your account:
👉 https://app.fodda.ai

If you cancelled by mistake or have questions, just reply to this email.

Piers
Founder, Fodda
    `.trim(),
        html: (data: { name?: string; planName?: string }) => foddaWrap({
            statusChip: { text: 'Cancelled', dotColor: T.textMuted },
            content: [
                foddaHero({
                    headline: 'Subscription ended',
                    bodyHtml: `<p style="margin:0;">Your Fodda subscription${data.planName ? ` (<strong>${data.planName}</strong>)` : ''} has been cancelled. Your account has been moved to the free Base plan.</p>`
                }),
                foddaBody(`
                    ${foddaInfoCard('Your Data Is Safe', 'Your data, graphs, and research history are all still here — nothing is lost.')}
                    <p style="margin:16px 0 16px;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">If you'd like to resubscribe at any time, just log in and visit the Billing section.</p>
                    <div style="text-align:center;">
                        ${foddaButton('Open Account Portal', 'https://app.fodda.ai', 'secondary')}
                    </div>
                    <p style="margin:16px 0 0;font-size:12px;color:${T.textMuted};text-align:center;font-family:${T.fontSans};">If you cancelled by mistake, just reply to this email.</p>
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    PAYMENT_UNMATCHED_ADMIN: {
        subject: "[Fodda] ⚠️ Unmatched payment received",
        body: (data: { customerEmail: string; amount: string; stripePriceId: string; sessionId: string; reason: string }) => `
Piers — a Stripe payment came in but couldn't be matched to a Fodda account.

Customer Email: ${data.customerEmail || 'Unknown'}
Amount: ${data.amount}
Stripe Price ID: ${data.stripePriceId}
Session: ${data.sessionId}
Reason: ${data.reason}

Action needed:
1. Check if the email exists in Airtable (Users table)
2. If they're a new customer, create their account manually
3. Apply the payment to their account

The payment is safe in Stripe — nothing is lost. But the customer has been emailed to let them know we're setting things up.
    `.trim(),
        html: (data: { customerEmail: string; amount: string; stripePriceId: string; sessionId: string; reason: string }) => foddaWrap({
            headerLabel: 'fodda.ai · admin',
            statusChip: { text: 'Unmatched', dotColor: T.reject },
            content: [
                foddaHero({
                    kicker: 'Payment Alert',
                    headline: 'Unmatched payment received',
                    bodyHtml: `<p style="margin:0;">A Stripe payment came in but couldn't be matched to a Fodda account.</p>`
                }),
                foddaSection('Payment Details', `
                    <div style="font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                        <strong>Customer Email:</strong> ${data.customerEmail || 'Unknown'}<br>
                        <strong>Amount:</strong> ${data.amount}<br>
                        <strong>Stripe Price ID:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:12px;">${data.stripePriceId}</code><br>
                        <strong>Session:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:12px;">${data.sessionId}</code><br>
                        <strong>Reason:</strong> ${data.reason}
                    </div>
                `),
                foddaSection('Action Needed', `
                    <ol style="margin:0;padding-left:20px;font-size:14px;color:${T.textBody};line-height:1.8;font-family:${T.fontSans};">
                        <li>Check if the email exists in Airtable (Users table)</li>
                        <li>If they're a new customer, create their account manually</li>
                        <li>Apply the payment to their account</li>
                    </ol>
                `),
                foddaCtaStrip('The payment is safe in Stripe — nothing is lost. The customer has been emailed.'),
            ].join('\n')
        })
    },

    PAYMENT_UNMATCHED_BUYER: {
        subject: "We received your payment — setting up your account",
        body: (data: { customerEmail: string }) => `
Hi there 👋

Thanks for your payment! We received it successfully.

We're setting up your Fodda account now. If you already have an account, could you reply to this email and let us know the company name or email address associated with it? That way we can make sure your payment is applied to the right place.

If you're brand new to Fodda, we'll have your account ready shortly and will follow up with your login details.

Thanks for your patience!

Piers
Founder, Fodda
    `.trim(),
        html: (data: { customerEmail: string }) => foddaWrap({
            statusChip: { text: 'Payment Received', dotColor: T.green },
            content: [
                foddaHero({
                    kicker: 'Payment',
                    headline: 'Setting up your account',
                    bodyHtml: `<p style="margin:0;">Thanks for your payment! We received it successfully and we're setting up your Fodda account now.</p>`
                }),
                foddaBody(`
                    <p style="margin:0 0 16px;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">If you already have an account, could you reply to this email and let us know the company name or email address associated with it? That way we can make sure your payment is applied to the right place.</p>
                    <p style="margin:0;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">If you're brand new to Fodda, we'll have your account ready shortly and will follow up with your login details.</p>
                    ${foddaSignature()}
                `),
            ].join('\n')
        })
    },

    EXPERT_ONBOARDING_STALLED: {
        subject: "Need help setting up your Fodda Human Agent?",
        body: (data: { name?: string }) => `
Hi${data.name ? ` ${data.name}` : ''},

We noticed you started setting up your Human Agent but didn't finish — no worries, it happens!

If you got stuck or have questions, just reply to this email. We're happy to help.

Or jump back in anytime:
👉 https://fodda.ai/join-experts

— The Fodda Team
        `.trim(),
        html: (data: { name?: string }) => foddaWrap({
            statusChip: { text: 'Incomplete', dotColor: T.amber },
            content: [
                foddaHero({
                    kicker: 'Human Agent Setup',
                    headline: 'Need a hand?',
                    bodyHtml: `<p style="margin:0;">We noticed you started setting up your Human Agent but didn't finish — no worries, it happens!</p>`
                }),
                foddaBody(`
                    <p style="margin:0 0 16px;font-size:14px;color:${T.textBody};font-family:${T.fontSans};">If you got stuck or have questions, just reply to this email. We're happy to help.</p>
                    <div style="text-align:center;">
                        ${foddaButton('Resume Expert Setup →', 'https://fodda.ai/join-experts')}
                    </div>
                    <p style="margin:16px 0 0;font-size:13px;color:${T.textMuted};text-align:center;font-family:${T.fontSans};">— The Fodda Team</p>
                `),
            ].join('\n')
        })
    },

    EXPERT_ONBOARDING_RESUME: {
        subject: "Your Human Agent progress is saved — resume anytime",
        body: (data: { name?: string }) => `
Hi${data.name ? ` ${data.name}` : ''},

Your Human Agent setup progress has been saved.

When you're ready, pick up where you left off:
👉 https://fodda.ai/join-experts

Your progress will be restored automatically.

— The Fodda Team
        `.trim(),
        html: (data: { name?: string }) => foddaWrap({
            statusChip: { text: 'Progress Saved', dotColor: T.green },
            content: [
                foddaHero({
                    kicker: 'Human Agent Setup',
                    headline: 'Progress saved',
                    bodyHtml: `<p style="margin:0;">Your Human Agent setup progress has been saved. When you're ready, pick up where you left off.</p>`
                }),
                foddaBody(`
                    <div style="text-align:center;">
                        ${foddaButton('Resume Expert Setup →', 'https://fodda.ai/join-experts')}
                    </div>
                    <p style="margin:16px 0 0;font-size:13px;color:${T.textMuted};text-align:center;font-family:${T.fontSans};">Your progress will be restored automatically.</p>
                    <p style="margin:16px 0 0;font-size:13px;color:${T.textMuted};text-align:center;font-family:${T.fontSans};">— The Fodda Team</p>
                `),
            ].join('\n')
        })
    }

};
