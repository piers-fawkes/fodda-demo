import { Router } from 'express';
import { randomBytes } from 'crypto';
import { 
  queryAirtable, 
  createAirtableRecord, 
  updateAirtableRecord, 
  DatabaseUnavailableError,
  escapeAirtableString
} from '../db.js';
import { 
  USERS_TABLE, 
  ACCOUNTS_TABLE, 
  PLANS_TABLE 
} from '../constants.js';
import { 
  extractNumericLimit, 
  extractRealValue,
  extractCorporateDomain,
  authenticateSession,
  rewriteContext
} from '../helpers.js';
import { sendSystemEmail, sendDirectEmail } from "../services/emailService.js";
import { enrichUserBuyerType } from "../services/userEnrichmentService.js";
import { selectPrompts } from "../services/promptSelector.js";
import { validateAndSelectPrompts } from "../services/promptValidator.js";
import { detectAccountType } from "../services/accountTypeService.js";

const router = Router();

// --- Account & Profile Endpoints ---

router.post("/invite", async (req, res) => {
  try {
    const { email, role, accountId, requesterEmail } = req.body;
    if (!email || !accountId || !requesterEmail) return res.status(400).json({ ok: false, error: "Missing required fields" });

    const user = await authenticateSession(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    if (requesterEmail.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    if (accountId !== user.accountId) {
      return res.status(403).json({ ok: false, error: "Forbidden. You cannot invite users to a different account." });
    }

    if (user.role !== 'Owner' && user.role !== 'Admin') {
      return res.status(403).json({ ok: false, error: "Only Owner or Admin can invite users" });
    }

    const emails = email.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0) return res.status(400).json({ ok: false, error: "No valid emails provided" });

    const results = { successful: [] as any[], failed: [] as any[] };

    for (const singleEmail of emails) {
      try {
        const existingUser = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(singleEmail)}'`);
        if (existingUser.records && existingUser.records.length > 0) {
          results.failed.push({ email: singleEmail, reason: "User already exists" });
          continue;
        }

        const uniqueHandle = singleEmail.split('@')[0] + randomBytes(2).toString('hex');
        const userFields = {
          "User Name": uniqueHandle,
          "email": singleEmail,
          "Role": (role === 'Owner' || role === 'Admin') ? role : 'Employee',
          "Account": [accountId],
          "emailConfirmed": false,
          "User Full Name": singleEmail.split('@')[0]
        };

        const userRecord = await createAirtableRecord(USERS_TABLE, userFields);
        const inviteUserId = userRecord.records[0].id;
        const inviteFirstName = String(userRecord.records[0].fields?.['First Name'] || singleEmail.split('@')[0] || '');

        enrichUserBuyerType(singleEmail, inviteFirstName, '', '', updateAirtableRecord, USERS_TABLE, inviteUserId).catch(e => console.error('[Enrichment] Failed:', e));

        setTimeout(async () => {
          try {
            const freshUser = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${escapeAirtableString(inviteUserId)}'`);
            const uf = freshUser.records?.[0]?.fields || {};
            const accountIds: string[] = uf.Account || [];
            let graphSlug = 'default';
            if (accountIds[0]) {
              const acct = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountIds[0])}'`);
              graphSlug = (acct.records?.[0]?.fields?.vertical || 'default').toLowerCase();
            }
            const candidates = selectPrompts(graphSlug, uf.buyer_type || 'Unknown', uf.buyer_industry || '', 10);
            const { prompts } = await validateAndSelectPrompts(candidates, graphSlug, singleEmail, sendSystemEmail) as any;
            const finalPrompts = prompts.length >= 3 ? prompts : candidates.slice(0, 5);
            await sendSystemEmail('ONBOARDING_PROMPTS', singleEmail, { firstName: inviteFirstName, graphId: graphSlug, buyerType: uf.buyer_type || 'Unknown', buyerIndustry: uf.buyer_industry || '', prompts: finalPrompts });
          } catch (e) { console.error('[Onboarding] Failed:', e); }
        }, 5 * 60 * 1000);

        results.successful.push({ id: inviteUserId, ...userFields });
      } catch (err: any) {
        results.failed.push({ email: singleEmail, reason: err.message });
      }
    }

    res.json({ ok: true, results });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/update", async (req, res) => {
  try {
    const { accountId, updates } = req.body;
    if (!accountId || !updates) {
      return res.status(400).json({ ok: false, error: "Missing accountId or updates" });
    }

    const user = await authenticateSession(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    if (accountId !== user.accountId) {
      return res.status(403).json({ ok: false, error: "Forbidden. You cannot update a different account." });
    }

    if (user.role !== 'Owner' && user.role !== 'Admin') {
      return res.status(403).json({ ok: false, error: "Only Owner or Admin can update account settings." });
    }

    const payload: any = {};
    if (updates.name !== undefined) payload["Account Name"] = updates.name;
    if (updates.context !== undefined) {
      payload["accountContext"] = await rewriteContext(updates.context, 'company');
    }
    if (updates.autoProvisionToggle !== undefined) payload["autoProvisionToggle"] = Boolean(updates.autoProvisionToggle);
    if (updates.autoProvisionDomain !== undefined) payload["autoProvisionDomain"] = updates.autoProvisionDomain;

    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, payload);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[Account Update] Error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/cron/monthly-reset", async (req, res) => {
  try {
    // Finding 5: header only — body param would appear in request body logs
    const cronSecret = req.headers['x-cron-secret'];
    const expectedSecret = process.env.CRON_SECRET || process.env.FODDA_MCP_SECRET;

    if (!expectedSecret || cronSecret !== expectedSecret) {
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

    let allAccounts: any[] = [];
    let offset = '';
    do {
      const query = await queryAirtable(ACCOUNTS_TABLE, '', offset ? `offset=${offset}` : '');
      allAccounts = allAccounts.concat(query.records || []);
      offset = query.offset || '';
    } while (offset);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    const nextRenewalDate = nextMonth.toISOString().split('T')[0];

    for (const acc of allAccounts) {
      if (Number(acc.fields.planCode) === 7) continue;
      // Skip subscription accounts — Stripe handles their renewal via invoice.payment_succeeded
      const subStatus = acc.fields.subscriptionStatus;
      if (subStatus === 'active' || subStatus === 'trialing') continue;
      await updateAirtableRecord(ACCOUNTS_TABLE, acc.id, {
        "queriesUsedThisCycle": 0,
        "limitReached": false,
        "nextRenewalDate": nextRenewalDate
      }).catch(e => console.error(`Reset error ${acc.id}:`, e));
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/plans", async (req, res) => {
  try {
    const plans = await queryAirtable(PLANS_TABLE, `{showInApp?} = TRUE()`);
    const formattedPlans = plans.records.map((r: any) => ({
      id: r.id,
      name: r.fields["Package Name"] || "Unnamed Plan",
      description: r.fields["Package Description"] || "",
      price: r.fields["monthlyPriceUSD"] != null ? `$${r.fields["monthlyPriceUSD"]}` : "$0",
      monthlyQueryLimit: r.fields["Monthly Query Limit"] || 0,
      planCode: Number(r.fields["planCode"]) || 0,
      stripeLink: r.fields["stripeLink"] || r.fields["Stripe Link"] || "",
      includesPublicApis: r.fields["Includes Public APIs?"] || false,
      graphsIncluded: r.fields["Graphs Included"] || "",
      billingMode: r.fields["billingMode"] || null,
      stripePriceId: r.fields["stripePriceId"] || "",
      upsellsPlanCode: r.fields["upsellsPlanCode"] ? Number(r.fields["upsellsPlanCode"]) : undefined,
    }));
    formattedPlans.sort((a: any, b: any) => a.planCode - b.planCode);
    res.json({ ok: true, plans: formattedPlans });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: "Failed to load plans." });
  }
});

router.post("/stripe/webhook", async (req: any, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) return res.status(500).json({ error: "Stripe not configured" });

  // Finding 2: webhook secret is required — never fall back to unverified body.
  // An attacker could forge checkout.session.completed to get free plan upgrades.
  if (!webhookSecret) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET is not set — webhook rejected for safety');
    return res.status(500).json({ error: "Webhook not configured. Set STRIPE_WEBHOOK_SECRET." });
  }
  if (!sig) {
    return res.status(400).json({ error: "Missing Stripe signature header" });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);
    const event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);

    console.log(`[Stripe Webhook] Event: ${event.type}`);

    // ═══════════════════════════════════════════════════════════════════
    // CHECKOUT.SESSION.COMPLETED — New purchase or subscription started
    // ═══════════════════════════════════════════════════════════════════
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object || event;
      const customerEmail = session.customer_email || session.customer_details?.email;
      if (!customerEmail) return res.status(400).json({ error: "No email" });

      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      const stripePriceId = lineItems.data?.[0]?.price?.id || null;
      if (!stripePriceId) return res.status(400).json({ error: "No Price ID" });

      const planQuery = await queryAirtable(PLANS_TABLE, `{stripePriceId} = '${stripePriceId}'`);
      const planRecord = planQuery.records?.[0];
      if (!planRecord) return res.status(400).json({ error: "Plan not found" });

      const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${customerEmail}'`);
      let userRecord = userQuery.records?.[0];
      let accountId = userRecord?.fields?.["Account"]?.[0];

      // ═══ FALLBACK: Domain-match if buyer email not in Users table ═══
      if (!userRecord || !accountId) {
        const buyerDomain = customerEmail.split('@')[1]?.toLowerCase();
        if (buyerDomain) {
          // Search for any Owner or Admin with the same email domain
          const domainUsers = await queryAirtable(USERS_TABLE, `AND(OR({Role} = 'Owner', {Role} = 'Admin'), FIND('${buyerDomain}', {email}))`);
          const domainMatches = (domainUsers.records || []).filter((u: any) => {
            const uDomain = (u.fields.email || '').split('@')[1]?.toLowerCase();
            return uDomain === buyerDomain && u.fields.Account?.[0];
          });

          if (domainMatches.length === 1) {
            // Exactly one account matches — auto-assign
            const matchedUser = domainMatches[0];
            accountId = matchedUser.fields.Account[0];
            const amountStr = `$${(Number(session.amount_total || 0) / 100).toFixed(2)}`;
            console.log(`[Stripe] Domain-matched ${customerEmail} to account ${accountId} via ${matchedUser.fields.email}`);

            // Notify admin that auto-matching succeeded
            sendSystemEmail('PAYMENT_UNMATCHED_ADMIN', 'piers@psfk.com', { customerEmail, amount: amountStr, stripePriceId: stripePriceId || '', sessionId: session.id || '', reason: `✅ AUTO-RESOLVED: Domain-matched to account ${accountId} via ${matchedUser.fields.email}. No action needed.` }).catch(() => {});

            if (!userRecord) {
              // Create user record for the buyer and link to the matched account
              const buyerName = customerEmail.split('@')[0];
              const newUser = await createAirtableRecord(USERS_TABLE, {
                "email": customerEmail,
                "First Name": buyerName,
                "Role": "Owner", // Buyer becomes Owner
                "Account": [accountId],
                "emailConfirmed": true,
              });
              userRecord = newUser.records?.[0];

              // If the matched user was an Admin, promote to Owner since buyer is paying
              if (matchedUser.fields.Role === 'Admin') {
                await updateAirtableRecord(USERS_TABLE, matchedUser.id, { "Role": "Owner" });
              }
            } else if (!accountId) {
              // User exists but has no account — link them
              accountId = matchedUser.fields.Account[0];
              await updateAirtableRecord(USERS_TABLE, userRecord.id, { "Account": [accountId] });
            }
          }
        }
      }

      if (!userRecord) {
        // Safety net: alert admin + email buyer
        const amountStr = `$${(Number(session.amount_total || 0) / 100).toFixed(2)}`;
        sendSystemEmail('PAYMENT_UNMATCHED_ADMIN', 'piers@psfk.com', { customerEmail, amount: amountStr, stripePriceId: stripePriceId || '', sessionId: session.id || '', reason: 'User not found in Airtable (domain-match also failed)' }).catch(() => {});
        sendDirectEmail(customerEmail, 'We received your payment — setting up your account', `Hi there 👋\n\nThanks for your payment! We received it successfully.\n\nWe're setting up your Fodda account now. If you already have an account, could you reply to this email and let us know the company name or email address associated with it?\n\nIf you're brand new to Fodda, we'll have your account ready shortly.\n\nPiers\nFounder, Fodda`).catch(() => {});
        console.warn(`[Stripe] UNMATCHED PAYMENT: No user found for ${customerEmail} (${amountStr})`);
        return res.json({ received: true, warning: "User not found - admin notified" });
      }

      if (!accountId) {
        const amountStr = `$${(Number(session.amount_total || 0) / 100).toFixed(2)}`;
        sendSystemEmail('PAYMENT_UNMATCHED_ADMIN', 'piers@psfk.com', { customerEmail, amount: amountStr, stripePriceId: stripePriceId || '', sessionId: session.id || '', reason: 'User exists but has no linked Account' }).catch(() => {});
        console.warn(`[Stripe] UNMATCHED PAYMENT: User ${customerEmail} has no linked account`);
        return res.json({ received: true, warning: "Account missing - admin notified" });
      }

      const planCode = Number(planRecord.fields["planCode"] || 0);
      const isTopUp = planCode === 7;
      const isSubscription = session.mode === 'subscription';

      if (isTopUp) {
        // ═══ TOP-UP PATH: Add bonus tokens, don't change the plan ═══
        const topUpAmount = Number(planRecord.fields["Monthly Query Limit"] || 100);
        const priceUSD = Number(session.amount_total || 0) / 100;

        const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${accountId}'`);
        const accountRecord = accountQuery.records?.[0];
        const currentBonus = Number(accountRecord?.fields?.bonusTokens || 0);
        const sourceGraphId = accountRecord?.fields?.sourceGraphId || '';

        await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
          "bonusTokens": currentBonus + topUpAmount,
          "limitReached": false,
        });

        try {
          const { TOKEN_PURCHASES_TABLE } = await import('../constants.js');
          await createAirtableRecord(TOKEN_PURCHASES_TABLE, {
            "accountId": accountId,
            "userEmail": customerEmail,
            "amount": topUpAmount,
            "priceUSD": priceUSD,
            "stripeSessionId": session.id || '',
            "referralGraphId": sourceGraphId,
            "payoutStatus": sourceGraphId ? 'pending' : 'not_applicable',
            "purchaseDate": new Date().toISOString().split('T')[0],
            "type": 'top_up',
          });
        } catch (logErr) {
          console.error('[Stripe] Token Purchase log failed:', logErr);
        }

        sendSystemEmail('TOP_UP_CONFIRMED', customerEmail, {
          tokenAmount: topUpAmount,
          totalBonus: currentBonus + topUpAmount,
          name: userRecord.fields["First Name"],
        }).catch(() => {});

        console.log(`[Stripe] Top-up: ${topUpAmount} tokens added for ${customerEmail}`);

      } else {
        // ═══ PLAN UPGRADE / SUBSCRIPTION START ═══
        const todayISO = new Date().toISOString().split('T')[0];
        const nextRenewal = new Date();
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        const nextRenewalDate = nextRenewal.toISOString().split('T')[0];

        const accountUpdate: any = {
          "Plan": [planRecord.id],
          "queriesUsedThisCycle": 0,
          "limitReached": false,
          "lastPaidDate": todayISO,
          "nextRenewalDate": nextRenewalDate,
          "accountStatus": "active"
        };

        // Store Stripe subscription data if this is a subscription checkout
        if (isSubscription) {
          accountUpdate["stripeCustomerId"] = session.customer || '';
          accountUpdate["stripeSubscriptionId"] = session.subscription || '';
          // Check if trial is active and use Stripe's billing dates for accuracy
          const sub = session.subscription ? (await stripe.subscriptions.retrieve(session.subscription as string) as any) : null;
          accountUpdate["subscriptionStatus"] = sub?.status === 'trialing' ? 'trialing' : 'active';

          // Use Stripe's current_period_end for the renewal date (accounts for trial)
          if (sub?.current_period_end) {
            const periodEnd = new Date(sub.current_period_end * 1000);
            accountUpdate["nextRenewalDate"] = periodEnd.toISOString().split('T')[0];
            console.log(`[Stripe] Renewal date set from Stripe period_end: ${accountUpdate["nextRenewalDate"]}`);
          }

          console.log(`[Stripe] Subscription started for ${customerEmail}: ${session.subscription} (status: ${accountUpdate["subscriptionStatus"]})`);
        }

        // Set vertical based on plan's included graphs
        const graphsIncluded = String(planRecord.fields["Graphs Included"] || "").toLowerCase().trim();
        if (graphsIncluded.includes('all')) {
          accountUpdate["vertical"] = "all";
        } else if (graphsIncluded.includes('single')) {
          const currentAccount = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${accountId}'`);
          const currentVertical = String(currentAccount.records?.[0]?.fields?.vertical || '').toLowerCase().trim();
          if (currentVertical && currentVertical !== 'all' && currentVertical !== '') {
            accountUpdate["vertical"] = currentVertical;
          } else {
            accountUpdate["vertical"] = "retail";
          }
        } else {
          accountUpdate["vertical"] = "retail";
        }

        await updateAirtableRecord(ACCOUNTS_TABLE, accountId, accountUpdate);

        // Log plan upgrade to Token Purchases table
        try {
          const { TOKEN_PURCHASES_TABLE } = await import('../constants.js');
          const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${accountId}'`);
          const sourceGraphId = accountQuery.records?.[0]?.fields?.sourceGraphId || '';
          const priceUSD = Number(session.amount_total || 0) / 100;

          await createAirtableRecord(TOKEN_PURCHASES_TABLE, {
            "accountId": accountId,
            "userEmail": customerEmail,
            "amount": Number(planRecord.fields["Monthly Query Limit"] || 0),
            "priceUSD": priceUSD,
            "stripeSessionId": session.id || '',
            "referralGraphId": sourceGraphId,
            "payoutStatus": sourceGraphId ? 'pending' : 'not_applicable',
            "purchaseDate": todayISO,
            "type": isSubscription ? 'subscription_start' : 'plan_upgrade',
          });
        } catch (logErr) {
          console.error('[Stripe] Token Purchase log (upgrade) failed:', logErr);
        }

        // Look up the account's API key so we can include MCP URLs in the upgrade email
        let upgradeApiKey = '';
        try {
          const { API_KEYS_TABLE } = await import('../constants.js');
          const keysQuery = await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${accountId}', {API Key Status} = 'Active')`);
          upgradeApiKey = keysQuery.records?.[0]?.fields?.['API Key'] || '';
        } catch (e) { /* non-critical — email will just omit MCP URLs */ }

        sendSystemEmail('PLAN_UPGRADED', customerEmail, { 
            planName: planRecord.fields["Package Name"], 
            queryLimit: planRecord.fields["Monthly Query Limit"]?.toLocaleString(), 
            name: userRecord.fields["First Name"],
            apiKey: upgradeApiKey
        }).catch(() => {});
      }

    // ═══════════════════════════════════════════════════════════════════
    // INVOICE.PAYMENT_SUCCEEDED — Monthly subscription renewal
    // ═══════════════════════════════════════════════════════════════════
    } else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data?.object as any;
      const customerId = invoice.customer;
      const subscriptionId = invoice.subscription;
      
      // Skip the first invoice (handled by checkout.session.completed)
      if (invoice.billing_reason === 'subscription_create') {
        console.log(`[Stripe] Skipping initial subscription invoice for ${customerId}`);
        return res.json({ received: true });
      }

      if (!customerId) return res.json({ received: true });

      // Find account by stripeCustomerId
      const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `{stripeCustomerId} = '${customerId}'`);
      const accountRecord = accountQuery.records?.[0];
      if (!accountRecord) {
        console.warn(`[Stripe] No account found for customer ${customerId}`);
        return res.json({ received: true });
      }

      const todayISO = new Date().toISOString().split('T')[0];
      const nextRenewal = new Date();
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);

      await updateAirtableRecord(ACCOUNTS_TABLE, accountRecord.id, {
        "queriesUsedThisCycle": 0,
        "limitReached": false,
        "lastPaidDate": todayISO,
        "nextRenewalDate": nextRenewal.toISOString().split('T')[0],
        "subscriptionStatus": "active",
      });

      console.log(`[Stripe] Subscription renewed for account ${accountRecord.id} (customer: ${customerId})`);

    // ═══════════════════════════════════════════════════════════════════
    // CUSTOMER.SUBSCRIPTION.DELETED — Subscription cancelled
    // ═══════════════════════════════════════════════════════════════════
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data?.object;
      const customerId = subscription.customer;

      const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `{stripeCustomerId} = '${customerId}'`);
      const accountRecord = accountQuery.records?.[0];
      if (!accountRecord) {
        console.warn(`[Stripe] No account found for cancelled subscription customer ${customerId}`);
        return res.json({ received: true });
      }

      // Find the Base/Free plan to downgrade to
      const basePlanQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 2`);
      const basePlan = basePlanQuery.records?.[0];

      const downgradeUpdate: any = {
        "stripeSubscriptionId": "",
        "subscriptionStatus": "cancelled",
        "accountStatus": "active", // Keep account active, just on free plan
      };
      if (basePlan) {
        downgradeUpdate["Plan"] = [basePlan.id];
      }

      await updateAirtableRecord(ACCOUNTS_TABLE, accountRecord.id, downgradeUpdate);

      // Find account owner email for notification
      const usersQuery = await queryAirtable(USERS_TABLE, `SEARCH('${escapeAirtableString(accountRecord.id)}', ARRAYJOIN({Account}))`);
      const ownerUser = usersQuery.records?.find((u: any) => u.fields.Role === 'Owner') || usersQuery.records?.[0];
      if (ownerUser?.fields?.email) {
        sendSystemEmail('SUBSCRIPTION_CANCELLED', ownerUser.fields.email, {
          name: ownerUser.fields["First Name"] || 'there',
          planName: accountRecord.fields["Plan Name"] || 'your plan',
        }).catch(() => {});
      }

      console.log(`[Stripe] Subscription cancelled for account ${accountRecord.id}`);

    // ═══════════════════════════════════════════════════════════════════
    // CUSTOMER.SUBSCRIPTION.UPDATED — Plan change or status update
    // ═══════════════════════════════════════════════════════════════════
    } else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data?.object;
      const customerId = subscription.customer;

      const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `{stripeCustomerId} = '${customerId}'`);
      const accountRecord = accountQuery.records?.[0];
      if (!accountRecord) return res.json({ received: true });

      // Update subscription status
      const statusUpdate: any = {
        "subscriptionStatus": subscription.status === 'active' ? 'active' : 
                              subscription.status === 'trialing' ? 'trialing' :
                              subscription.status === 'past_due' ? 'past_due' : subscription.status,
      };

      // If the plan changed via Stripe portal, update accordingly
      const newPriceId = subscription.items?.data?.[0]?.price?.id;
      if (newPriceId) {
        const planQuery = await queryAirtable(PLANS_TABLE, `{stripePriceId} = '${newPriceId}'`);
        const newPlan = planQuery.records?.[0];
        if (newPlan && newPlan.id !== accountRecord.fields["Plan"]?.[0]) {
          statusUpdate["Plan"] = [newPlan.id];
          console.log(`[Stripe] Plan changed via portal for account ${accountRecord.id} to ${newPlan.fields["Package Name"]}`);
        }
      }

      await updateAirtableRecord(ACCOUNTS_TABLE, accountRecord.id, statusUpdate);
      console.log(`[Stripe] Subscription updated for account ${accountRecord.id}: status=${subscription.status}`);
    }

    res.json({ ok: true, received: true });
  } catch (err: any) {
    console.error('[Stripe Webhook] Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});
// --- Subscription Checkout ---
// Creates a Stripe Checkout Session for subscription plans with optional trial period.
// ═══════════════════════════════════════════════════════════════════
// CUSTOM CHECKOUT SESSION (FOR SALES/ADMIN OFFERS)
// ═══════════════════════════════════════════════════════════════════
router.post("/checkout/custom", async (req, res) => {
  const { planCode, email, trialDays, successUrl, cancelUrl } = req.body;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: "Stripe not configured" });

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);

    const planQuery = await queryAirtable(PLANS_TABLE, `{planCode} = ${planCode}`);
    const plan = planQuery.records?.[0];
    if (!plan || !plan.fields.stripePriceId) {
      return res.status(400).json({ error: "Plan or Price ID not found" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: plan.fields.stripePriceId as string, quantity: 1 }],
      mode: 'subscription',
      customer_email: email || undefined,
      subscription_data: {
        trial_period_days: trialDays ? Number(trialDays) : undefined,
      },
      success_url: successUrl || `${process.env.FODDA_APP_URL || 'https://app.fodda.ai'}/?checkout=success`,
      cancel_url: cancelUrl || `${process.env.FODDA_APP_URL || 'https://app.fodda.ai'}/?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    res.json({ ok: true, checkout_url: session.url });
  } catch (e: any) {
    console.error("[Stripe] Custom Checkout Error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/checkout/subscribe", async (req, res) => {
  try {
    const { email, planCode, trialDays } = req.body;
    if (!email || !planCode) return res.status(400).json({ ok: false, error: "Missing email or planCode" });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    // Look up plan
    const planQuery = await queryAirtable(PLANS_TABLE, `{planCode} = ${planCode}`);
    const planRecord = planQuery.records?.[0];
    if (!planRecord) return res.status(404).json({ ok: false, error: "Plan not found" });

    const stripePriceId = planRecord.fields["stripePriceId"];
    if (!stripePriceId) return res.status(400).json({ ok: false, error: "No Stripe price configured for this plan" });

    const billingMode = planRecord.fields["billingMode"] || 'subscription';
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);

    const appUrl = process.env.APP_URL || 'https://app.fodda.ai';
    const sessionParams: any = {
      mode: billingMode === 'one_time' ? 'payment' : 'subscription',
      customer_email: email,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${appUrl}?checkout=success`,
      cancel_url: `${appUrl}?checkout=cancelled`,
      metadata: { planCode: String(planCode), email },
    };

    // Add trial period for subscription mode if specified
    if (billingMode !== 'one_time' && trialDays && trialDays > 0) {
      sessionParams.subscription_data = {
        trial_period_days: Math.min(trialDays, 30), // Cap at 30 days
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log(`[Checkout] Created ${billingMode} session for ${email} (plan ${planCode}${trialDays ? `, trial: ${trialDays}d` : ''})`);
    res.json({ ok: true, checkout_url: session.url });
  } catch (err: any) {
    console.error('[Checkout] Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Billing Portal ---
// Creates a Stripe Billing Portal session for self-service subscription management.
router.post("/billing/portal", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: "Missing email" });

    const user = await authenticateSession(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    if (email.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    // Look up user → account → stripeCustomerId
    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(email)}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) return res.status(404).json({ ok: false, error: "User not found" });

    const accountId = userRecord.fields["Account"]?.[0];
    if (!accountId) return res.status(400).json({ ok: false, error: "No account" });

    const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountId)}'`);
    const accountRecord = accountQuery.records?.[0];
    const stripeCustomerId = accountRecord?.fields?.stripeCustomerId;

    if (!stripeCustomerId) {
      return res.status(400).json({ ok: false, error: "No Stripe customer found. Subscribe to a plan first." });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);
    const appUrl = process.env.APP_URL || 'https://app.fodda.ai';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: appUrl,
    });

    console.log(`[Billing Portal] Created portal session for ${email}`);
    res.json({ ok: true, portal_url: portalSession.url });
  } catch (err: any) {
    console.error('[Billing Portal] Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Trial → Base Account Conversion ---
// Called by MCP when a trial user provides their email.
// Creates a Base account scoped to the graph that sourced them.

router.post("/trial-convert", async (req, res) => {
  try {
    const { email, trialKey, firstName } = req.body;
    if (!email || !trialKey) {
      return res.status(400).json({ ok: false, error: "Email and trialKey are required." });
    }

    // Validate the trial key format
    if (!trialKey.startsWith('sk_trial_')) {
      return res.status(400).json({ ok: false, error: "Invalid trial key format." });
    }

    // Extract graphId from trial key: sk_trial_2026-macro-trend-graph → 2026-macro-trend-graph
    const graphId = trialKey.replace('sk_trial_', '');

    // Check if user already exists
    const existingUser = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(email)}'`);
    if (existingUser.records && existingUser.records.length > 0) {
      // User already exists — just return success so the MCP doesn't show an error
      const existingAccountId = existingUser.records[0].fields?.Account?.[0];
      return res.json({
        ok: true,
        alreadyExists: true,
        message: "Account already exists. User can log in at app.fodda.ai.",
        accountId: existingAccountId || null
      });
    }

    // Look up the Base plan (planCode 2)
    const basePlanQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 2`);
    const basePlanRecord = basePlanQuery.records?.[0];
    const basePlanId = basePlanRecord?.id;

    // Create the account
    const displayName = firstName || email.split('@')[0];
    const companyName = `${displayName}'s Account`;
    const todayISO = new Date().toISOString().split('T')[0];

    const accountFields: any = {
      "Account Name": companyName,
      "legalName": companyName,
      "signupCode": randomBytes(4).toString('hex').toUpperCase(),
      "vertical": graphId,
      "lastPaidDate": todayISO,
      "lastAmountPaid": 0,
      "sourceGraphId": graphId,
      "sourceTrialKey": trialKey,
    };
    if (basePlanId) accountFields["Plan"] = [basePlanId];

    const corpDomain = extractCorporateDomain(email);
    if (corpDomain) {
      accountFields["autoProvisionDomain"] = corpDomain;
      accountFields["autoProvisionToggle"] = true;
    }

    const accountRecord = await createAirtableRecord(ACCOUNTS_TABLE, accountFields);
    const accountId = accountRecord.records[0].id;

    // Create API key for the account
    const { API_KEYS_TABLE } = await import('../constants.js');
    const apiKeyString = `sk_live_${randomBytes(24).toString('hex')}`;
    await createAirtableRecord(API_KEYS_TABLE, {
      "API Key": apiKeyString,
      "API Key Status": "Active",
      "Account": [accountId]
    });

    // Create the user
    const baseHandle = displayName.toLowerCase().replace(/[^a-z0-9]/g, "") || 'user';
    let uniqueHandle = baseHandle;
    let counter = 1;
    let isUnique = false;
    while (!isUnique && counter < 20) {
      const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${escapeAirtableString(uniqueHandle)}'`);
      if (!handleCk.records || handleCk.records.length === 0) isUnique = true;
      else { uniqueHandle = `${baseHandle}${counter}`; counter++; }
    }
    if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;

    const userFields = {
      "User Name": uniqueHandle,
      "First Name": displayName,
      "User Full Name": displayName,
      "email": email,
      "Role": "Owner",
      "Account": [accountId],
      "emailConfirmed": false,
      "apiUse": "Mainly Claude",
      "onboardingIntent": "account",
    };
    const userRecord = await createAirtableRecord(USERS_TABLE, userFields);
    const userId = userRecord.records[0].id;

    // Set account owner
    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, { "Account Owner": [userId] });

    // Send confirmation email
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const confirmationLink = `${baseUrl}/api/auth/confirm?email=${encodeURIComponent(email)}`;
    sendSystemEmail('SIGNUP_CONFIRMATION', email, {
      name: displayName,
      confirmationLink,
      intent: 'account',
      apiKey: apiKeyString
    }).catch(e => console.error("[Trial-Convert] Email failed:", e));

    // Fire-and-forget: enrich the user
    enrichUserBuyerType(email, displayName, '', '', updateAirtableRecord, USERS_TABLE, userId).catch(() => {});

    // Schedule onboarding prompts email (5 mins delay to allow enrichment to populate buyer_type)
    setTimeout(async () => {
      try {
        const freshUser = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${escapeAirtableString(userId)}'`);
        const fuf = freshUser.records?.[0]?.fields || {};
        const accountIds: string[] = fuf.Account || [];
        let accountFields: any = {};
        if (accountIds[0]) {
          const acct = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountIds[0])}'`);
          accountFields = acct.records?.[0]?.fields || {};
        }

        const candidates = selectPrompts(graphId, fuf.buyer_type || 'Unknown', fuf.buyer_industry || '', 10);
        const { prompts } = await validateAndSelectPrompts(candidates, graphId, email, sendSystemEmail) as any;
        const finalPrompts = prompts.length >= 3 ? prompts : candidates.slice(0, 5);
        
        // Contextual Onboarding
        const accountType = detectAccountType(accountFields);
        if (accountType === 'client') {
          await sendSystemEmail('CLIENT_WELCOME_PROMPTS', email, {
            firstName: displayName,
            isUpgrade: true, // Trial-convert is an upgrade event
            graphId,
            buyerType: fuf.buyer_type || 'Unknown',
            buyerIndustry: fuf.buyer_industry || '',
            prompts: finalPrompts,
          }, { cc: ['team@fodda.ai'] });
        } else {
          await sendSystemEmail('ONBOARDING_PROMPTS', email, {
            firstName: displayName,
            graphId,
            buyerType: fuf.buyer_type || 'Unknown',
            buyerIndustry: fuf.buyer_industry || '',
            prompts: finalPrompts,
          });
        }
        console.log(`[Trial-Convert] Onboarding prompts sent to ${email} for graph ${graphId} (Type: ${accountType})`);
      } catch (e) {
        console.error('[Trial-Convert] Onboarding prompts failed:', e);
      }
    }, 5 * 60 * 1000); // 5 minutes

    console.log(`[Trial-Convert] Created Base account for ${email} via ${trialKey} (graph: ${graphId})`);

    res.json({
      ok: true,
      alreadyExists: false,
      message: `Base account created for ${email}. Confirmation email sent.`,
      accountId,
      graphId,
      plan: "Base",
      monthlyTokens: 100,
    });
  } catch (err: any) {
    console.error("[Trial-Convert] Error:", err);
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- B2B Agent Auto-Provisioning ---
// Called autonomously by the Sales Agent to provision targets.
router.post("/b2b-provision", async (req, res) => {
  try {
    const { email, company, sourceGraphId } = req.body;
    const internalSecret = req.headers['x-internal-secret'];
    
    // 1. Authenticate
    if (!process.env.FODDA_INTERNAL_API_KEY || internalSecret !== process.env.FODDA_INTERNAL_API_KEY) {
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required." });
    }

    const { API_KEYS_TABLE } = await import('../constants.js');

    // 2. Check if user already exists
    const existingUser = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(email)}'`);
    if (existingUser.records && existingUser.records.length > 0) {
      const existingAccountId = existingUser.records[0].fields?.Account?.[0];
      if (existingAccountId) {
        // Fetch existing active API key
        const keysQuery = await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${escapeAirtableString(existingAccountId)}', {API Key Status} = 'Active')`);
        const existingKey = keysQuery.records?.[0]?.fields?.['API Key'];
        if (existingKey) {
          console.log(`[B2B Provision] User ${email} already exists. Returning existing key.`);
          return res.json({ ok: true, apiKey: existingKey, accountId: existingAccountId });
        }
      }
    }

    // 3. Provision New Account
    // Look up the Base plan (planCode 2)
    const basePlanQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 2`);
    const basePlanId = basePlanQuery.records?.[0]?.id;

    const companyName = company || email.split('@')[0] + "'s Account";
    const graphId = sourceGraphId || 'retail';
    const todayISO = new Date().toISOString().split('T')[0];

    const accountFields: any = {
      "Account Name": companyName,
      "legalName": companyName,
      "signupCode": randomBytes(4).toString('hex').toUpperCase(),
      "vertical": graphId,
      "lastPaidDate": todayISO,
      "lastAmountPaid": 0,
      "sourceGraphId": "b2b-sales-agent",
    };
    if (basePlanId) accountFields["Plan"] = [basePlanId];

    const corpDomain = extractCorporateDomain(email);
    if (corpDomain) {
      accountFields["autoProvisionDomain"] = corpDomain;
      accountFields["autoProvisionToggle"] = true;
    }

    const accountRecord = await createAirtableRecord(ACCOUNTS_TABLE, accountFields);
    const accountId = accountRecord.records[0].id;

    // Create API key
    const apiKeyString = `sk_live_${randomBytes(24).toString('hex')}`;
    await createAirtableRecord(API_KEYS_TABLE, {
      "API Key": apiKeyString,
      "API Key Status": "Active",
      "Account": [accountId]
    });

    // Create User
    const baseHandle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, "") || 'user';
    let uniqueHandle = baseHandle;
    let counter = 1;
    let isUnique = false;
    while (!isUnique && counter < 20) {
      const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${escapeAirtableString(uniqueHandle)}'`);
      if (!handleCk.records || handleCk.records.length === 0) isUnique = true;
      else { uniqueHandle = `${baseHandle}${counter}`; counter++; }
    }
    if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;

    const userFields = {
      "User Name": uniqueHandle,
      "First Name": email.split('@')[0],
      "User Full Name": company || email.split('@')[0],
      "email": email,
      "Role": "Owner",
      "Account": [accountId],
      "emailConfirmed": true, // Bypassing manual email confirmation!
      "apiUse": "B2B Agent Integration",
      "buyer_type": "AI Startup/Developer"
    };
    const userRecord = await createAirtableRecord(USERS_TABLE, userFields);
    const userId = userRecord.records[0].id;

    // Set account owner
    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, { "Account Owner": [userId] });

    console.log(`[B2B Provision] Successfully auto-provisioned ${email} via Sales Agent.`);

    res.json({
      ok: true,
      apiKey: apiKeyString,
      accountId
    });
  } catch (err: any) {
    console.error("[B2B Provision] Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Get Account Users ---
router.get("/:accountId/users", async (req, res) => {
  try {
    const user = await authenticateSession(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { accountId } = req.params;
    if (accountId !== user.accountId) {
      return res.status(403).json({ ok: false, error: "Forbidden. You cannot access users of a different account." });
    }

    const { USERS_TABLE } = await import('../constants.js');
    const usersQuery = await queryAirtable(USERS_TABLE, `SEARCH('${escapeAirtableString(accountId)}', ARRAYJOIN({Account}))`);

    const users = (usersQuery.records || []).map((r: any) => {
      const f = r.fields || {};
      return {
        id: r.id,
        email: f.email || f.Email || '',
        firstName: f['First Name'] || '',
        lastName: f['Last Name'] || '',
        userName: f['User Name'] || '',
        name: f['User Full Name'] || '',
        jobTitle: f['Job Title'] || '',
        role: f.Role || 'Employee',
        lastLogin: f.lastLogin || null,
        monthlyQueries: Number(f.monthlyQueries || 0),
        maxplanQueries: Number(f.maxplanQueries || 0),
        emailConfirmed: !!f.emailConfirmed
      };
    });

    res.json({ ok: true, users });
  } catch (err: any) {
    console.error("[AccountRouter] Failed to fetch users for account:", err);
    if (err instanceof DatabaseUnavailableError) {
      return res.status(503).json({ ok: false, error: err.message });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Account Status (for MCP `get_my_account` tool) ---
// Returns rich account info for in-conversation display.
// Accepts API key via X-API-Key header or Authorization Bearer token.

router.get("/status", async (req, res) => {
  try {
    const rawApiKey = (req.headers['x-api-key'] as string)
      || (req.headers['authorization'] as string || '').replace(/^Bearer\s+/i, '');

    if (!rawApiKey) {
      return res.status(401).json({ ok: false, error: "API key required (X-API-Key header or Authorization Bearer)." });
    }

    // Resolve API key → Account
    const { API_KEYS_TABLE } = await import('../constants.js');
    const keyQuery = await queryAirtable(API_KEYS_TABLE, `{API Key} = '${escapeAirtableString(rawApiKey)}'`);
    const keyRecord = keyQuery.records?.[0];
    if (!keyRecord) {
      return res.status(401).json({ ok: false, error: "Invalid API key." });
    }

    const accountId = Array.isArray(keyRecord.fields.Account)
      ? keyRecord.fields.Account[0]
      : keyRecord.fields.Account;
    if (!accountId) {
      return res.status(404).json({ ok: false, error: "No account linked to this API key." });
    }

    // Fetch account
    const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountId)}'`);
    const accRec = accountQuery.records?.[0];
    if (!accRec) {
      return res.status(404).json({ ok: false, error: "Account not found." });
    }

    const accFields = accRec.fields;

    // Fetch plan details
    const planIdLink = accFields.Plan ? accFields.Plan[0] : null;
    let planName = "Free";
    let monthlyTokenLimit = 100;
    if (planIdLink) {
      const planQuery = await queryAirtable(PLANS_TABLE, `RECORD_ID() = '${escapeAirtableString(planIdLink)}'`);
      const planRec = planQuery.records?.[0];
      if (planRec) {
        planName = planRec.fields['Package Name'] || planRec.fields.Name || 'Free';
        monthlyTokenLimit = Number(planRec.fields['Monthly Query Limit'] || 100);
      }
    }

    // Calculate tokens
    const bonusTokens = Number(accFields.bonusTokens || 0);
    const tokensTotal = monthlyTokenLimit + bonusTokens;
    const tokensUsed = Number(accFields.monthlyQueries || 0);
    const tokensRemaining = Math.max(0, tokensTotal - tokensUsed);

    // Determine reset date
    const resetDate = accFields.nextRenewalDate || (() => {
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      return next.toISOString().split('T')[0];
    })();

    // Fetch account owner/users for profile info
    const usersQuery = await queryAirtable(USERS_TABLE, `AND({Account} = '${escapeAirtableString(accountId)}', {Role} = 'Owner')`);
    const ownerRec = usersQuery.records?.[0];
    const profile = ownerRec ? {
      name: (`${ownerRec.fields['First Name'] || ''} ${ownerRec.fields['Last Name'] || ''}`).trim() || undefined,
      email: ownerRec.fields.email || undefined,
      company: accFields['Account Name'] || undefined,
      job_title: ownerRec.fields['Job Title'] || undefined,
    } : { company: accFields['Account Name'] || undefined };

    // Determine graph access
    const accountVertical = (accFields.vertical || 'all').toLowerCase();
    const allGraphSet = accountVertical === 'all';

    // Build graphs_enabled / graphs_disabled from Graph List
    let graphsEnabled: string[] = [];
    let graphsDisabled: string[] = [];

    try {
      const { GRAPH_LIST_TABLE } = await import('../constants.js');
      const graphResult = await queryAirtable(
        GRAPH_LIST_TABLE,
        `OR({graphStatus} = 'live', {graphStatus} = 'beta')`
      );
      const allGraphIds = (graphResult.records || [])
        .map((r: any) => r.fields.graphId || '')
        .filter(Boolean);

      if (allGraphSet) {
        graphsEnabled = allGraphIds;
        graphsDisabled = [];
      } else {
        // Account has specific vertical(s)
        const enabledSet = new Set(accountVertical.split(',').map((v: string) => v.trim()));
        graphsEnabled = allGraphIds.filter((id: string) => enabledSet.has(id));
        graphsDisabled = allGraphIds.filter((id: string) => !enabledSet.has(id));
      }
    } catch (graphErr) {
      console.warn('[Account Status] Graph list fetch failed:', graphErr);
    }

    res.json({
      ok: true,
      plan: planName,
      // New field names (preferred by updated clients)
      api_calls_remaining: tokensRemaining,
      api_calls_total: tokensTotal,
      api_calls_used: tokensUsed,
      bonus_api_calls: bonusTokens,
      // Legacy field names (backward compatibility)
      tokens_remaining: tokensRemaining,
      tokens_total: tokensTotal,
      tokens_used: tokensUsed,
      bonus_tokens: bonusTokens,
      graphs_enabled: graphsEnabled,
      graphs_disabled: graphsDisabled,
      profile,
      reset_date: resetDate,
      account_id: accountId,
      limit_reached: !!accFields.limitReached,
    });
  } catch (err: any) {
    console.error("[Account Status] Error:", err);
    if (err instanceof DatabaseUnavailableError) {
      return res.status(503).json({ ok: false, error: err.message });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Delete Account ---
// Confirms ownership, anonymizes user data, revokes API key, sends confirmation email.
// This is a destructive action requiring email-based ownership verification.

router.post("/delete", async (req, res) => {
  try {
    const { email, confirmPhrase } = req.body;
    if (!email) {
      return res.status(400).json({ ok: false, error: "Email is required." });
    }

    // Require the user to type "DELETE" as a safety check
    if (confirmPhrase !== 'DELETE') {
      return res.status(400).json({ ok: false, error: "Please type 'DELETE' to confirm account deletion." });
    }

    const user = await authenticateSession(req);
    if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    if (email.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    // Verify the user exists and is the Owner
    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(email)}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) {
      return res.status(404).json({ ok: false, error: "User not found." });
    }

    const userRole = String(userRecord.fields.Role || '').toLowerCase();
    if (userRole !== 'owner') {
      return res.status(403).json({ ok: false, error: "Only account Owners can delete their account. Contact your account admin." });
    }

    const accountId = userRecord.fields.Account?.[0];
    if (!accountId) {
      return res.status(404).json({ ok: false, error: "No account linked to this user." });
    }

    // 1. Revoke all API keys for this account
    const { API_KEYS_TABLE } = await import('../constants.js');
    const keysQuery = await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${escapeAirtableString(accountId)}', {API Key Status} = 'Active')`);
    for (const keyRec of (keysQuery.records || [])) {
      await updateAirtableRecord(API_KEYS_TABLE, keyRec.id, {
        "API Key Status": "Revoked",
        "API Key": `DELETED_${keyRec.id}`
      });
    }

    // 2. Anonymize all users in this account
    const allUsersQuery = await queryAirtable(USERS_TABLE, `{Account} = '${escapeAirtableString(accountId)}'`);
    for (const u of (allUsersQuery.records || [])) {
      await updateAirtableRecord(USERS_TABLE, u.id, {
        "email": `deleted_${u.id}@fodda.ai`,
        "First Name": "Deleted",
        "Last Name": "User",
        "User Full Name": "Deleted User",
        "userContext": "",
        "loginToken": "",
        "sessionToken": "",
        "sessionExpiresAt": "",
      });
    }

    // 3. Mark account as deleted
    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
      "accountStatus": "deleted",
      "accountContext": "",
      "Account Name": `Deleted Account (${accountId.slice(0, 6)})`,
    });

    // 4. Send confirmation email (fire-and-forget, use original email before it was anonymized)
    sendSystemEmail('ACCOUNT_DELETED', email, {
      name: userRecord.fields['First Name'] || 'there',
    }).catch(e => console.error("[Delete Account] Confirmation email failed:", e));

    console.log(`[Delete Account] Account ${accountId} deleted by ${email}`);
    res.json({ ok: true, message: "Account successfully deleted. A confirmation email has been sent." });
  } catch (err: any) {
    console.error("[Delete Account] Error:", err);
    if (err instanceof DatabaseUnavailableError) {
      return res.status(503).json({ ok: false, error: err.message });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Partner Invite (Studio Beta) ---
// Creates a Base account with vertical='all', generates an API key,
// and sends a customizable welcome email that includes the Stripe activation link.
// Called from the Admin Portal's Partners tab.

router.post("/partner-invite", async (req, res) => {
  try {
    const { email, firstName, companyName, emailBody, adminSecret } = req.body;

    // Simple auth — accept admin password or env var secrets
    const envSecret = process.env.CRON_SECRET || process.env.FODDA_MCP_SECRET;
    const validSecrets = [envSecret, 'psfk'].filter(Boolean);
    if (!adminSecret || !validSecrets.includes(adminSecret)) {
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

    if (!email) {
      return res.status(400).json({ ok: false, error: "Partner email is required." });
    }

    // Check if user already exists
    const existingUser = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(email)}'`);
    if (existingUser.records && existingUser.records.length > 0) {
      return res.status(409).json({
        ok: false,
        error: `A user with email ${email} already exists.`,
        alreadyExists: true
      });
    }

    // Look up the Base plan (planCode 2) — partner starts on Base, upgrades to Studio Beta via Stripe
    const basePlanQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 2`);
    const basePlanRecord = basePlanQuery.records?.[0];
    const basePlanId = basePlanRecord?.id;

    // Create the account
    const displayName = firstName || email.split('@')[0];
    const accountName = companyName || `${displayName}'s Account`;
    const todayISO = new Date().toISOString().split('T')[0];

    const accountFields: any = {
      "Account Name": accountName,
      "legalName": accountName,
      "signupCode": randomBytes(4).toString('hex').toUpperCase(),
      "vertical": "all",  // Studio Beta = all graphs
      "lastPaidDate": todayISO,
      "lastAmountPaid": 0,
      "accountStatus": "active",
    };
    if (basePlanId) accountFields["Plan"] = [basePlanId];

    const accountRecord = await createAirtableRecord(ACCOUNTS_TABLE, accountFields);
    const accountId = accountRecord.records[0].id;

    // Create API key
    const { API_KEYS_TABLE } = await import('../constants.js');
    const apiKeyString = `sk_live_${randomBytes(24).toString('hex')}`;
    await createAirtableRecord(API_KEYS_TABLE, {
      "API Key": apiKeyString,
      "API Key Status": "Active",
      "Account": [accountId]
    });

    // Create the user
    const baseHandle = displayName.toLowerCase().replace(/[^a-z0-9]/g, "") || 'partner';
    let uniqueHandle = baseHandle;
    let counter = 1;
    let isUnique = false;
    while (!isUnique && counter < 20) {
      const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${escapeAirtableString(uniqueHandle)}'`);
      if (!handleCk.records || handleCk.records.length === 0) isUnique = true;
      else { uniqueHandle = `${baseHandle}${counter}`; counter++; }
    }
    if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;

    const userFields = {
      "User Name": uniqueHandle,
      "First Name": displayName,
      "User Full Name": displayName,
      "email": email,
      "Role": "Owner",
      "Account": [accountId],
      "emailConfirmed": false,
      "apiUse": "Mainly Claude",
      "onboardingIntent": "account",
    };
    const userRecord = await createAirtableRecord(USERS_TABLE, userFields);
    const userId = userRecord.records[0].id;

    // Set account owner
    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, { "Account Owner": [userId] });

    // Send the welcome email — use custom body if provided, otherwise use the template
    if (emailBody) {
      // Inject the real API key and MCP URL into the custom email body
      let finalBody = emailBody
        .replace(/\[will be generated and included below after account creation\]/g, apiKeyString)
        .replace(/will be sent separately with your API key/g, `Standard (Claude Web): https://mcp.fodda.ai/mcp?api_key=${apiKeyString}\nSSE (Cursor/Desktop): https://mcp.fodda.ai/sse?api_key=${apiKeyString}`);

      // Send via Resend (formal) — falls back to Gmail if Resend isn't configured
      sendDirectEmail(email, "Your Fodda Studio Beta access is ready", finalBody, 'formal')
        .then(ok => console.log(`[Partner-Invite] Email ${ok ? 'sent' : 'failed'} to ${email}`))
        .catch(e => console.error('[Partner-Invite] Email send failed:', e));
    } else {
      // Fallback to template
      sendSystemEmail('PARTNER_WELCOME', email, {
        name: displayName,
        email,
        apiKey: apiKeyString,
        stripeLink: 'https://buy.stripe.com/cNi28qbhT2l7gmY9c76g80b',
        companyName: accountName,
      }).catch(e => console.error("[Partner-Invite] Template email failed:", e));
    }

    // Fire-and-forget: enrich the user
    enrichUserBuyerType(email, displayName, '', '', updateAirtableRecord, USERS_TABLE, userId).catch(() => {});

    console.log(`[Partner-Invite] Created partner account for ${email} (company: ${accountName})`);

    res.json({
      ok: true,
      accountId,
      apiKey: apiKeyString,
      message: `Partner account created for ${email}. Welcome email sent.`,
    });
  } catch (err: any) {
    console.error("[Partner-Invite] Error:", err);
    if (err instanceof DatabaseUnavailableError) {
      return res.status(503).json({ ok: false, error: err.message });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Admin: User Lookup ---
// Looks up a user by email and returns their full profile: user fields, account, plan, API key, usage.
// Gated by adminSecret.

router.post("/admin/lookup", async (req, res) => {
  try {
    const { email, adminSecret } = req.body;

    const envSecret = process.env.CRON_SECRET || process.env.FODDA_MCP_SECRET;
    const validSecrets = [envSecret, 'psfk'].filter(Boolean);
    if (!adminSecret || !validSecrets.includes(adminSecret)) {
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

    if (!email) {
      return res.status(400).json({ ok: false, error: "Email or handle is required." });
    }

    // 1. Look up user — support both email and handle (User Name)
    const isEmail = email.includes('@');
    const userQuery = isEmail
      ? await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(email)}'`)
      : await queryAirtable(USERS_TABLE, `{User Name} = '${escapeAirtableString(email)}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) {
      return res.status(404).json({ ok: false, error: `No user found with ${isEmail ? 'email' : 'handle'}: ${email}` });
    }

    const uf = userRecord.fields;
    const accountId = uf.Account?.[0] || null;

    // 2. Look up account
    let account: any = null;
    let plan: any = null;
    let apiKey: string | null = null;

    if (accountId) {
      const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountId)}'`);
      const accRec = accountQuery.records?.[0];
      if (accRec) {
        const af = accRec.fields;

        // 3. Look up plan
        const planIdLink = af.Plan ? af.Plan[0] : null;
        if (planIdLink) {
          const planQuery = await queryAirtable(PLANS_TABLE, `RECORD_ID() = '${escapeAirtableString(planIdLink)}'`);
          const planRec = planQuery.records?.[0];
          if (planRec) {
            plan = {
              id: planRec.id,
              name: planRec.fields['Package Name'] || 'Unknown',
              planCode: Number(planRec.fields['planCode'] || 0),
              monthlyQueryLimit: Number(planRec.fields['Monthly Query Limit'] || 0),
              price: planRec.fields['monthlyPriceUSD'] != null ? `$${planRec.fields['monthlyPriceUSD']}` : '$0',
              graphsIncluded: planRec.fields['Graphs Included'] || '',
            };
          }
        }

        // 4. Look up API key
        const { API_KEYS_TABLE } = await import('../constants.js');
        const keysQuery = await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${escapeAirtableString(accountId)}', {API Key Status} = 'Active')`);
        const keyRec = keysQuery.records?.[0];
        if (keyRec) {
          apiKey = keyRec.fields['API Key'] || null;
        }

        const monthlyLimit = plan?.monthlyQueryLimit || 100;
        const bonusTokens = Number(af.bonusTokens || 0);
        const tokensUsed = Number(af.monthlyQueries || 0);

        account = {
          id: accRec.id,
          name: af['Account Name'] || '',
          vertical: af.vertical || 'all',
          status: af.accountStatus || 'active',
          signupCode: af.signupCode || '',
          tokensUsed,
          monthlyLimit,
          bonusTokens,
          tokensRemaining: Math.max(0, monthlyLimit + bonusTokens - tokensUsed),
          limitReached: !!af.limitReached,
          nextRenewalDate: af.nextRenewalDate || '',
          lastPaidDate: af.lastPaidDate || '',
          sourceGraphId: af.sourceGraphId || '',
        };
      }
    }

    res.json({
      ok: true,
      user: {
        id: userRecord.id,
        email: uf.email || email,
        firstName: uf['First Name'] || '',
        lastName: uf['Last Name'] || '',
        fullName: uf['User Full Name'] || '',
        role: uf.Role || 'User',
        handle: uf['User Name'] || '',
        emailConfirmed: !!uf.emailConfirmed,
        apiUse: uf.apiUse || '',
        buyerType: uf.buyer_type || '',
        buyerIndustry: uf.buyer_industry || '',
        createdAt: userRecord.createdTime || '',
      },
      account,
      plan,
      apiKey,
    });
  } catch (err: any) {
    console.error("[Admin Lookup] Error:", err);
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Admin: Change Plan ---
// Changes a user's account plan by planCode.
// Gated by adminSecret.

router.post("/admin/change-plan", async (req, res) => {
  try {
    const { email, planCode, adminSecret } = req.body;

    const envSecret = process.env.CRON_SECRET || process.env.FODDA_MCP_SECRET;
    const validSecrets = [envSecret, 'psfk'].filter(Boolean);
    if (!adminSecret || !validSecrets.includes(adminSecret)) {
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

    if (!email || planCode === undefined) {
      return res.status(400).json({ ok: false, error: "Email and planCode are required." });
    }

    // Look up user → account
    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(email)}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) return res.status(404).json({ ok: false, error: `No user found with email: ${email}` });

    const accountId = userRecord.fields.Account?.[0];
    if (!accountId) return res.status(404).json({ ok: false, error: "User has no linked account." });

    // Look up the target plan
    const planQuery = await queryAirtable(PLANS_TABLE, `{planCode} = ${Number(planCode)}`);
    const planRecord = planQuery.records?.[0];
    if (!planRecord) return res.status(404).json({ ok: false, error: `No plan found with planCode: ${planCode}` });

    const todayISO = new Date().toISOString().split('T')[0];
    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    const nextRenewalDate = nextRenewal.toISOString().split('T')[0];

    const accountUpdate: any = {
      "Plan": [planRecord.id],
      "queriesUsedThisCycle": 0,
      "limitReached": false,
      "lastPaidDate": todayISO,
      "nextRenewalDate": nextRenewalDate,
      "accountStatus": "active",
    };

    // If the new plan includes 'all' graphs, set vertical to 'all'
    if (String(planRecord.fields['Graphs Included'] || '').toLowerCase().includes('all')) {
      accountUpdate["vertical"] = "all";
    }

    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, accountUpdate);

    const newPlanName = planRecord.fields['Package Name'] || 'Unknown';
    const newLimit = Number(planRecord.fields['Monthly Query Limit'] || 0);

    console.log(`[Admin] Plan changed for ${email}: → ${newPlanName} (planCode: ${planCode}) by admin`);

    res.json({
      ok: true,
      message: `Plan updated to "${newPlanName}" for ${email}.`,
      plan: {
        name: newPlanName,
        planCode: Number(planCode),
        monthlyQueryLimit: newLimit,
        graphsIncluded: planRecord.fields['Graphs Included'] || '',
      },
    });
  } catch (err: any) {
    console.error("[Admin Change Plan] Error:", err);
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Agent Checkout Session ---
// Called by MCP server or Core API when credits are exhausted.
// Creates a Stripe Checkout Session for token top-up (planCode 7).
// Handles no-email gracefully: if email is provided, pre-fills it;
// otherwise Stripe collects the email at checkout.
// This is a PUBLIC endpoint (no auth required) — it's called when
// the user has already been rejected by the credit gate.

router.post("/checkout/agent-session", async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(503).json({ ok: false, error: "Stripe not configured" });
  }

  try {
    const { email, return_url, source } = req.body || {};

    // Look up the Top-Up plan (planCode 7) to get the Stripe Price ID
    const topUpQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 7`);
    const topUpPlan = topUpQuery.records?.[0];
    if (!topUpPlan) {
      return res.status(500).json({ ok: false, error: "Top-Up plan not found in system" });
    }

    const stripePriceId = topUpPlan.fields.stripePriceId;
    if (!stripePriceId) {
      // Fallback: return the Stripe Link directly if Price ID isn't configured
      const stripeLink = topUpPlan.fields.stripeLink || topUpPlan.fields['Stripe Link'] || 'https://app.fodda.ai';
      return res.json({
        ok: true,
        checkout_url: stripeLink,
        mode: 'redirect',
        note: 'Direct Stripe link (no dynamic session). Stripe Price ID not configured for Top-Up plan.'
      });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);

    // Build Checkout Session params
    const sessionParams: any = {
      mode: 'payment',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: return_url || 'https://app.fodda.ai?checkout=success',
      cancel_url: return_url || 'https://app.fodda.ai?checkout=cancelled',
      metadata: {
        source: source || 'mcp_checkout',
        agent_initiated: 'true',
      },
    };

    // Handle email: if provided, pre-fill it; otherwise let Stripe collect it
    if (email && email.includes('@')) {
      sessionParams.customer_email = email;
    }
    // If no email, Stripe will collect it — the webhook handler already
    // extracts customer_email from session.customer_details.email

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[Agent Checkout] Session created: ${session.id} (email: ${email || 'not provided'}, source: ${source || 'mcp_checkout'})`);

    res.json({
      ok: true,
      checkout_url: session.url,
      session_id: session.id,
      mode: 'stripe_checkout',
      tokens: Number(topUpPlan.fields['Monthly API Limit'] || topUpPlan.fields['Monthly Query Limit'] || 200),
      price_usd: Number(topUpPlan.fields.monthlyPriceUSD || topUpPlan.fields['Price (USD)'] || 50),
    });
  } catch (err: any) {
    console.error("[Agent Checkout] Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/account/confirm-persona
 * 
 * Owner/Admin confirms or edits the account-level persona text.
 * Sets confirmed_account_persona_text and account_persona_confirmed = true.
 */
router.post('/confirm-persona', async (req, res) => {
  try {
    const { accountId, confirmedText } = req.body;
    if (!accountId || !confirmedText) {
      return res.status(400).json({ ok: false, error: 'accountId and confirmedText are required' });
    }

    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (accountId !== user.accountId) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    if (user.role !== 'Owner' && user.role !== 'Admin') {
      return res.status(403).json({ ok: false, error: 'Only Owner or Admin can confirm account personas' });
    }

    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
      confirmed_account_persona_text: confirmedText.substring(0, 5000),
      account_persona_confirmed: true,
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/account/toggle-share
 * Toggle whether account context is shared during AI sessions.
 * Only Owner/Admin should call this (enforced by frontend).
 */
router.post('/toggle-share', async (req, res) => {
  try {
    const { accountId, enabled } = req.body;
    if (!accountId || typeof enabled !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'accountId and enabled (boolean) are required' });
    }

    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (accountId !== user.accountId) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    if (user.role !== 'Owner' && user.role !== 'Admin') {
      return res.status(403).json({ ok: false, error: 'Only Owner or Admin can toggle account context sharing' });
    }

    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
      share_account_context_disabled: !enabled,
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Rate limiting variables for trial provisioning
const trialRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const TRIAL_RATE_WINDOW = 10 * 60 * 1000; // 10 minutes
const TRIAL_RATE_LIMIT = 5; // 5 attempts per window

function isTrialRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = trialRateLimitMap.get(ip);
  if (!entry) {
    trialRateLimitMap.set(ip, { count: 1, resetAt: now + TRIAL_RATE_WINDOW });
    return false;
  }
  if (now > entry.resetAt) {
    trialRateLimitMap.set(ip, { count: 1, resetAt: now + TRIAL_RATE_WINDOW });
    return false;
  }
  entry.count++;
  if (entry.count > TRIAL_RATE_LIMIT) {
    return true;
  }
  // cleanup expired entries
  for (const [ipKey, entryVal] of trialRateLimitMap) {
    if (now > entryVal.resetAt) trialRateLimitMap.delete(ipKey);
  }
  return false;
}

/**
 * POST /api/account/trial-provision
 * 
 * Public trial provisioning endpoint. Used by website and Slack bot.
 */
router.post('/trial-provision', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const { email, firstName, lastName, company, jobTitle, vertical, adminSecret } = req.body;

  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Rate limiting check (internal bypass supported via body or header)
    const internalKey = process.env.FODDA_INTERNAL_API_KEY;
    const isInternal = (adminSecret && adminSecret === internalKey) ||
                       (req.headers['x-fodda-internal-key'] && req.headers['x-fodda-internal-key'] === internalKey);
    if (!isInternal && isTrialRateLimited(clientIp)) {
      return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });
    }

    // 2. Check if user already exists
    const existingUser = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(normalizedEmail)}'`);
    if (existingUser.records && existingUser.records.length > 0) {
      const userRec = existingUser.records[0];
      const accountId = userRec.fields.Account?.[0];
      if (accountId) {
        // Fetch active key for this account
        const { API_KEYS_TABLE } = await import('../constants.js');
        const keysQuery = await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${escapeAirtableString(accountId)}', {API Key Status} = 'Active')`);
        const apiKey = keysQuery.records?.[0]?.fields?.['API Key'];
        if (apiKey) {
          const mcpUrl = `https://mcp.fodda.ai/mcp?api_key=${apiKey}`;
          const claudeUrl = `https://claude.ai/settings/connectors?modal=add-custom-connector`;
          return res.json({ ok: true, apiKey, mcpUrl, claudeUrl, alreadyExists: true });
        }
      }
    }

    // 3. Find Trial plan (planCode 13) in Airtable
    const planQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 13`);
    const trialPlan = planQuery.records?.[0];
    if (!trialPlan) {
      return res.status(500).json({ ok: false, error: 'Trial plan config (planCode 13) not found.' });
    }

    // 4. Create Account
    const displayName = firstName || normalizedEmail.split('@')[0];
    const accountName = company ? `${company} (Trial)` : `${displayName}'s Trial Account`;
    const todayISO = new Date().toISOString().split('T')[0];
    const signupVertical = vertical || 'retail';

    const accountFields: any = {
      "Account Name": accountName,
      "legalName": accountName,
      "signupCode": randomBytes(4).toString('hex').toUpperCase(),
      "vertical": signupVertical,
      "lastPaidDate": todayISO,
      "lastAmountPaid": 0,
      "sourceGraphId": signupVertical,
      "Plan": [trialPlan.id],
      "accountStatus": "active"
    };

    const corpDomain = extractCorporateDomain(normalizedEmail);
    if (corpDomain) {
      accountFields["autoProvisionDomain"] = corpDomain;
      accountFields["autoProvisionToggle"] = true;
    }

    const accountRecord = await createAirtableRecord(ACCOUNTS_TABLE, accountFields);
    const accountId = accountRecord.records[0].id;

    // 5. Create API key
    const { API_KEYS_TABLE } = await import('../constants.js');
    const apiKeyString = `sk_live_${randomBytes(24).toString('hex')}`;
    await createAirtableRecord(API_KEYS_TABLE, {
      "API Key": apiKeyString,
      "API Key Status": "Active",
      "Account": [accountId]
    });

    // 6. Create User (Owner role, emailConfirmed: false so verification link is sent immediately)
    const baseHandle = displayName.toLowerCase().replace(/[^a-z0-9]/g, "") || 'user';
    let uniqueHandle = baseHandle;
    let counter = 1;
    let isUnique = false;
    while (!isUnique && counter < 20) {
      const handleCk = await queryAirtable(USERS_TABLE, `{User Name} = '${escapeAirtableString(uniqueHandle)}'`);
      if (!handleCk.records || handleCk.records.length === 0) isUnique = true;
      else { uniqueHandle = `${baseHandle}${counter}`; counter++; }
    }
    if (!isUnique) uniqueHandle = `${baseHandle}${Date.now()}`;

    const userFields = {
      "User Name": uniqueHandle,
      "First Name": displayName,
      "Last Name": lastName || "",
      "User Full Name": (firstName && lastName) ? `${firstName} ${lastName}` : displayName,
      "email": normalizedEmail,
      "Role": "Owner",
      "Account": [accountId],
      "emailConfirmed": false,
      "Company": company || "",
      "Job Title": jobTitle || "",
      "apiUse": "Mainly Claude",
      "onboardingIntent": "trial"
    };

    const userRecord = await createAirtableRecord(USERS_TABLE, userFields);
    const userId = userRecord.records[0].id;

    // Link Owner to Account
    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, { "Account Owner": [userId] });

    // 7. Send Welcome email (SIGNUP_CONFIRMATION with intent: 'trial')
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const confirmationLink = `${baseUrl}/api/auth/confirm?email=${encodeURIComponent(normalizedEmail)}`;
    sendSystemEmail('SIGNUP_CONFIRMATION', normalizedEmail, {
      name: displayName,
      confirmationLink,
      intent: 'trial',
      apiKey: apiKeyString
    }).catch(e => console.error('[Trial-Provision] Welcome email failed:', e));

    // Fire-and-forget: enrich user profile
    enrichUserBuyerType(normalizedEmail, displayName, lastName || '', company || '', updateAirtableRecord, USERS_TABLE, userId).catch(() => {});

    // Return unique urls & key
    const mcpUrl = `https://mcp.fodda.ai/mcp?api_key=${apiKeyString}`;
    const claudeUrl = `https://claude.ai/settings/connectors?modal=add-custom-connector`;
    res.json({ ok: true, apiKey: apiKeyString, mcpUrl, claudeUrl });

  } catch (err: any) {
    console.error('[Trial-Provision] Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/account/convert-to-base
 * 
 * Converts a Trial account (planCode 13) to the Base - Free plan (planCode 2).
 * Triggers email verification.
 */
router.post('/convert-to-base', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Find user & account
    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(normalizedEmail)}'`);
    const userRec = userQuery.records?.[0];
    if (!userRec) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const accountId = userRec.fields.Account?.[0];
    if (!accountId) {
      return res.status(400).json({ ok: false, error: 'No account linked to this user' });
    }

    // 2. Fetch account & verify it is on Trial (planCode 13)
    const accountQuery = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountId)}'`);
    const accountRec = accountQuery.records?.[0];
    if (!accountRec) {
      return res.status(404).json({ ok: false, error: 'Account not found' });
    }

    const planCode = Number(accountRec.fields.planCode || 0);
    if (planCode !== 13) {
      return res.status(400).json({ ok: false, error: `Account is not on Trial (planCode is ${planCode})` });
    }

    // 3. Find Base plan (planCode 2)
    const planQuery = await queryAirtable(PLANS_TABLE, `{planCode} = 2`);
    const basePlan = planQuery.records?.[0];
    if (!basePlan) {
      return res.status(500).json({ ok: false, error: 'Base plan config (planCode 2) not found.' });
    }

    // 4. Update Account
    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    const nextRenewalDate = nextRenewal.toISOString().split('T')[0];

    await updateAirtableRecord(ACCOUNTS_TABLE, accountId, {
      "Plan": [basePlan.id],
      "queriesUsedThisCycle": 0,
      "monthlyQueries": 0,
      "limitReached": false,
      "nextRenewalDate": nextRenewalDate
    });

    const isAlreadyConfirmed = !!userRec.fields?.emailConfirmed;

    if (isAlreadyConfirmed) {
      // If already confirmed (e.g. they clicked confirm link during trial), they don't need to confirm again!
      res.json({ ok: true, alreadyConfirmed: true });
    } else {
      // 5. Update User (emailConfirmed: false)
      await updateAirtableRecord(USERS_TABLE, userRec.id, {
        "emailConfirmed": false
      });

      // 6. Send verification email
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const confirmationLink = `${baseUrl}/api/auth/confirm?email=${encodeURIComponent(normalizedEmail)}`;
      
      // Get API Key to include in confirmation email
      const { API_KEYS_TABLE } = await import('../constants.js');
      const keysQuery = await queryAirtable(API_KEYS_TABLE, `AND({Account} = '${escapeAirtableString(accountId)}', {API Key Status} = 'Active')`);
      const apiKey = keysQuery.records?.[0]?.fields?.['API Key'] || '';

      sendSystemEmail('SIGNUP_CONFIRMATION', normalizedEmail, {
        name: userRec.fields['First Name'] || normalizedEmail.split('@')[0],
        confirmationLink,
        intent: 'account',
        apiKey
      }).catch(e => console.error('[Convert-to-Base] Email failed:', e));

      res.json({ ok: true, alreadyConfirmed: false });
    }
  } catch (err: any) {
    console.error('[Convert-to-Base] Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
