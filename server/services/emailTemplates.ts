
interface EmailTemplate {
    subject: string;
    body: (data: any) => string;
}

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
    SIGNUP_CONFIRMATION: {
        subject: "Confirm your email to finish signing up for Fodda",
        body: (data: { confirmationLink: string }) => `
Hi — Piers here 👋

Just one quick step before you’re fully in.

Please confirm your email address by clicking the link below:

👉 Confirm my email address
${data.confirmationLink}

This helps us make sure it’s really you — and that you actually want access to Fodda.

Once confirmed, you’ll be able to explore expert-built knowledge graphs — structured context designed to help AI (and humans) reason more clearly than with generic web data alone.

If you didn’t sign up for Fodda, you can safely ignore this email.
And if the link doesn’t work for any reason, just reply here and I’ll sort it.

Thanks — and see you on the inside.

Piers
Founder, Fodda
    `.trim()
    },

    WELCOME_EMAIL: {
        subject: "A quick note on how Fodda is different",
        body: () => `
Hi — Piers again.

A quick bit of context as you get started.

Most AI tools are trained on everything. Fodda is built around the idea that what really matters is which perspective you feed in, and when.

Each Fodda graph is:
• Curated by a human expert
• Structured so AI can trace relationships, not just keywords
• Designed to be queried repeatedly, not dumped into a prompt once

Some people use Fodda to:
• Get smarter foundations for strategy or research
• Power internal AI tools with explainable context
• Compare how different expert perspectives frame the same question

There’s no “right” way to use it yet. Part of the point is seeing what changes when your AI stops guessing and starts reasoning with grounded input.

If you want a nudge on where to start, hit reply and tell me what you’re working on.

Piers
    `.trim()
    },

    PLAN_LIMIT_WARNING: {
        subject: "Heads up — you’re nearing your Fodda plan limit",
        body: () => `
Hi — quick heads up.

You’re getting close to the usage limit on your current Fodda plan.

That usually means one of two things:
1. You’re exploring deeply (good sign), or
2. You’re starting to rely on Fodda as part of your actual workflow (even better)

If you do hit the limit, nothing breaks — you just won’t be able to run additional queries until the cycle resets or you upgrade.

Upgrading gets you:
• More graph access
• Higher query limits
• Fewer interruptions when you’re mid-thinking

No pressure either way. Fodda is meant to earn its place, not force it.

If you’re unsure which plan makes sense, reply here and tell me how you’re using it. I’m happy to point you in the right direction.

Piers
    `.trim()
    },

    LAPSED_NOTIFICATION: {
        subject: "Your Fodda access has paused (no worries)",
        body: () => `
Hi — just a quick note.

Your Fodda access has paused because your subscription ended. No drama — everything you explored is still here if you want to pick it back up.

If the timing wasn’t right, that’s totally fine. Fodda isn’t a “check every day” product — it’s more of a reach-for-it-when-you-need-better context kind of thing.

When you’re ready, you can:
• Reactivate anytime
• Jump back into the same graphs
• Or explore what’s new since you last logged in

And if you decided Fodda wasn’t useful for what you’re working on, I’d genuinely love to know why. A one-line reply is more than enough.

Either way — thanks for giving it a try.

Piers
Founder, Fodda
    `.trim()
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
    `.trim()
    }

};
