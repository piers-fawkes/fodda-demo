import { Router } from 'express';
import { randomBytes } from 'crypto';
import { 
  queryAirtable, 
  updateAirtableRecord, 
  createAirtableRecord,
  DatabaseUnavailableError,
  escapeAirtableString
} from '../db.js';
import { USERS_TABLE, API_KEYS_TABLE } from '../constants.js';
import { authenticateSession, rewriteContext } from '../helpers.js';
import { getActiveKeysForAccount, buildMcpConnection } from '../services/mcpConnectionService.js';

const router = Router();

// --- User Preference Endpoints ---

/**
 * POST /api/user/disabled-graphs
 * 
 * Persists the user's disabled graph preferences to Airtable.
 * The frontend calls this with a debounced save whenever the user
 * toggles graphs on/off in the My Graphs page.
 * 
 * Body: { email: string, disabledGraphs: string }
 *   - email: The user's email address
 *   - disabledGraphs: Comma-separated graph IDs (e.g. "fashion,waldo,havas-media-trends")
 *                     Empty string means all graphs are enabled.
 */
router.post("/disabled-graphs", async (req, res) => {
  try {
    const { email, disabledGraphs } = req.body;
    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    // disabledGraphs can be empty string (all enabled) — that's valid
    if (typeof disabledGraphs !== 'string') {
      return res.status(400).json({ ok: false, error: "disabledGraphs must be a string" });
    }

    // Update the disabledGraphs field in Airtable using authenticated user ID
    await updateAirtableRecord(USERS_TABLE, user.id, {
      "disabledGraphs": disabledGraphs
    });

    console.log(`[UserRouter] Updated disabledGraphs for ${user.email}: "${disabledGraphs || '(none)'}"`);
    res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) {
      return res.status(503).json({ ok: false, error: err.message });
    }
    console.error("[UserRouter] Failed to update disabled graphs:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/user/update
 * 
 * Updates user profile fields (firstName, lastName, jobTitle, company).
 * Body: { email: string, updates: { firstName?, lastName?, jobTitle?, company? } }
 */
router.post("/update", async (req, res) => {
  try {
    const { email, updates } = req.body;
    if (!email || !updates) return res.status(400).json({ ok: false, error: "Email and updates are required" });
    
    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (email.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    // Fetch user details for fallback Full Name calculation
    const userQuery = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${escapeAirtableString(user.id)}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) return res.status(404).json({ ok: false, error: "User not found" });

    const fields: any = {};
    if (updates.firstName) fields["First Name"] = updates.firstName;
    if (updates.lastName) fields["Last Name"] = updates.lastName;
    if (updates.jobTitle !== undefined) fields["Job Title"] = updates.jobTitle;
    if (updates.company !== undefined) fields["Company"] = updates.company;
    if (updates.firstName || updates.lastName) {
      fields["User Full Name"] = `${updates.firstName || userRecord.fields['First Name'] || ''} ${updates.lastName || userRecord.fields['Last Name'] || ''}`.trim();
    }

    await updateAirtableRecord(USERS_TABLE, user.id, fields);
    res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/user/context
 * 
 * Updates the user's personal context string.
 * Body: { email: string, context: string }
 */
router.post("/context", async (req, res) => {
  try {
    const { email, context } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: "Email is required" });
    
    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (email.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const refinedContext = context ? await rewriteContext(context, 'user') : "";
    await updateAirtableRecord(USERS_TABLE, user.id, { "userContext": refinedContext });
    res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});


/**
 * POST /api/user/update-role
 * 
 * Updates a user's role and syncs the Account-level linked fields.
 * Only Owner or Admin can change roles.
 * Body: { targetUserId: string, newRole: 'Owner' | 'Admin' | 'Employee', requesterEmail: string }
 */
router.post("/update-role", async (req, res) => {
  try {
    const { targetUserId, newRole, requesterEmail } = req.body;
    if (!targetUserId || !newRole || !requesterEmail) {
      return res.status(400).json({ ok: false, error: "targetUserId, newRole, and requesterEmail are required" });
    }

    const validRoles = ['Owner', 'Admin', 'Employee'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ ok: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (requesterEmail.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    
    if (user.role !== 'Owner' && user.role !== 'Admin') {
      return res.status(403).json({ ok: false, error: "Only Owner or Admin can change roles" });
    }

    // Get the target user
    const targetQuery = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${escapeAirtableString(targetUserId)}'`);
    const targetUser = targetQuery.records?.[0];
    if (!targetUser) return res.status(404).json({ ok: false, error: "Target user not found" });

    // Verify same account
    const targetAccountIds: string[] = targetUser.fields.Account || [];
    if (!user.accountId || user.accountId !== targetAccountIds[0]) {
      return res.status(403).json({ ok: false, error: "Unauthorized. Users must belong to the same account." });
    }

    // Can't demote yourself as owner
    if (targetUser.fields.email === user.email && user.role === 'Owner' && newRole !== 'Owner') {
      return res.status(400).json({ ok: false, error: "Account owner cannot demote themselves" });
    }

    // Update the user's Role field
    await updateAirtableRecord(USERS_TABLE, targetUserId, { "Role": newRole });

    // Sync the Account-level linked fields (Account Owner / Account Admin)
    const accountIds: string[] = targetUser.fields.Account || [];
    if (accountIds[0]) {
      const { ACCOUNTS_TABLE } = await import('../constants.js');
      
      if (newRole === 'Owner') {
        await updateAirtableRecord(ACCOUNTS_TABLE, accountIds[0], { "Account Owner": [targetUserId] });
      } else if (newRole === 'Admin') {
        // Get current admins and add this user
        const { queryAirtable: qa } = await import('../db.js');
        const acctQuery = await qa(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountIds[0])}'`);
        const acctRecord = acctQuery.records?.[0];
        const currentAdmins: string[] = acctRecord?.fields?.['Account Admin'] || [];
        if (!currentAdmins.includes(targetUserId)) {
          await updateAirtableRecord(ACCOUNTS_TABLE, accountIds[0], {
            "Account Admin": [...currentAdmins, targetUserId]
          });
        }
      } else if (newRole === 'Employee') {
        // Remove from Account Admin if they were admin
        const { queryAirtable: qa } = await import('../db.js');
        const acctQuery = await qa(ACCOUNTS_TABLE, `RECORD_ID() = '${escapeAirtableString(accountIds[0])}'`);
        const acctRecord = acctQuery.records?.[0];
        const currentAdmins: string[] = acctRecord?.fields?.['Account Admin'] || [];
        const filtered = currentAdmins.filter(id => id !== targetUserId);
        if (filtered.length !== currentAdmins.length) {
          await updateAirtableRecord(ACCOUNTS_TABLE, accountIds[0], {
            "Account Admin": filtered.length > 0 ? filtered : []
          });
        }
      }
    }

    console.log(`[UserRouter] Role updated: ${targetUser.fields.email} → ${newRole} (by ${user.email})`);
    res.json({ ok: true, newRole });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    console.error("[UserRouter] Failed to update role:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /api/user/:userId
 * 
 * Removes a user from an account.
 * Only Owner or Admin can delete users.
 * Body: { requesterEmail: string }
 */
router.delete("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { requesterEmail } = req.body;

    if (!userId || !requesterEmail) {
      return res.status(400).json({ ok: false, error: "userId and requesterEmail are required" });
    }

    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (requesterEmail.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    
    if (user.role !== 'Owner' && user.role !== 'Admin') {
      return res.status(403).json({ ok: false, error: "Only Owner or Admin can remove users" });
    }

    // Get the target user
    const targetQuery = await queryAirtable(USERS_TABLE, `RECORD_ID() = '${escapeAirtableString(userId)}'`);
    const targetUser = targetQuery.records?.[0];
    if (!targetUser) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Verify same account
    const targetAccountIds: string[] = targetUser.fields.Account || [];
    if (!user.accountId || user.accountId !== targetAccountIds[0]) {
      return res.status(403).json({ ok: false, error: "Unauthorized. Users must belong to the same account." });
    }

    // Cannot delete the owner
    if (targetUser.fields.Role === 'Owner') {
      return res.status(400).json({ ok: false, error: "Cannot remove the account Owner." });
    }

    // Import deleteAirtableRecord helper
    const { deleteAirtableRecord } = await import('../db.js');
    await deleteAirtableRecord(USERS_TABLE, userId);

    console.log(`[UserRouter] User deleted: ${targetUser.fields.email} (by ${user.email})`);
    res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) return res.status(503).json({ ok: false, error: err.message });
    console.error("[UserRouter] Failed to delete user:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/user/confirm-persona
 * 
 * User confirms or edits their proposed persona text.
 * Sets confirmed_persona_text and persona_confirmed = true.
 */
router.post('/confirm-persona', async (req, res) => {
  try {
    const { email, confirmedText } = req.body;
    if (!email || !confirmedText) {
      return res.status(400).json({ ok: false, error: 'email and confirmedText are required' });
    }

    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (email.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    // Find user record by email
    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(email)}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    await updateAirtableRecord(USERS_TABLE, userRecord.id, {
      confirmed_persona_text: confirmedText.substring(0, 5000),
      persona_confirmed: true,
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/user/toggle-share
 * Toggle whether user context is shared during AI sessions.
 */
router.post('/toggle-share', async (req, res) => {
  try {
    const { email, enabled } = req.body;
    if (!email || typeof enabled !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'email and enabled (boolean) are required' });
    }

    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    if (email.toLowerCase().trim() !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const userQuery = await queryAirtable(USERS_TABLE, `{email} = '${escapeAirtableString(email)}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    await updateAirtableRecord(USERS_TABLE, userRecord.id, {
      share_context_disabled: !enabled,
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/user/api-key/rotate & POST /api/user/v1/user/api-key/rotate
 * Self-service API Key Rotation for an account.
 * Revokes existing active API keys for the account, creates a new sk_live_... key,
 * refreshes connection token details, and returns updated key & mcpConn.
 */
const handleApiKeyRotation = async (req: any, res: any) => {
  try {
    const user = await authenticateSession(req);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { email } = req.body || {};
    const targetEmail = (email && typeof email === 'string' ? email.toLowerCase().trim() : user.email);

    if (user.role !== 'Owner' && user.role !== 'Admin' && targetEmail !== user.email) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Cannot rotate API key for another user' });
    }

    // Resolve user record to get accountId
    const userQuery = await queryAirtable(USERS_TABLE, `LOWER({email}) = '${escapeAirtableString(targetEmail)}'`);
    const userRecord = userQuery.records?.[0];
    if (!userRecord) {
      return res.status(404).json({ ok: false, error: 'User record not found' });
    }

    const accountId = userRecord.fields.Account?.[0];
    if (!accountId) {
      return res.status(400).json({ ok: false, error: 'No account linked to user' });
    }

    // 1. Find existing active keys for account and revoke them
    const activeKeysQuery = await getActiveKeysForAccount(accountId);
    if (activeKeysQuery.records && activeKeysQuery.records.length > 0) {
      for (const keyRec of activeKeysQuery.records) {
        try {
          await updateAirtableRecord(API_KEYS_TABLE, keyRec.id, {
            'API Key Status': 'Revoked'
          });
        } catch (err) {
          console.error(`[ApiKeyRotate] Error revoking key record ${keyRec.id}:`, err);
        }
      }
    }

    // 2. Generate new active API key
    const newApiKey = `sk_live_${randomBytes(24).toString('hex')}`;
    await createAirtableRecord(API_KEYS_TABLE, {
      'API Key': newApiKey,
      'API Key Status': 'Active',
      'Account': [accountId]
    });

    // 3. Re-build MCP connection to update active connection data
    const mcpConn = await buildMcpConnection(targetEmail);

    console.log(`[ApiKeyRotate] Successfully rotated API key for account ${accountId} (user: ${targetEmail})`);

    return res.json({
      ok: true,
      apiKey: newApiKey,
      token: mcpConn.token,
      mcpConn
    });
  } catch (err: any) {
    console.error('[ApiKeyRotate] Failed to rotate API key:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
  }
};

router.post('/api-key/rotate', handleApiKeyRotation);
router.post('/v1/user/api-key/rotate', handleApiKeyRotation);

export default router;
