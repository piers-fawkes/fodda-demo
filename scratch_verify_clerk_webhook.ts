import dotenv from 'dotenv';
dotenv.config();

// Use dynamic imports to ensure dotenv.config() runs before modules initialize process.env constants
const { queryAirtable, deleteAirtableRecord } = await import('./server/db.js');
const { USERS_TABLE, ACCOUNTS_TABLE, API_KEYS_TABLE } = await import('./server/constants.js');
const { default: webhookRouter } = await import('./server/routers/webhookRouter.js');

// Simple request / response mock framework
function mockResponse() {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  return res;
}

async function runVerification() {
  console.log("==================================================");
  console.log("CLERK WEBHOOK SYNC VERIFICATION SYSTEM");
  console.log("==================================================");

  const testEmail = `clerk.verified.trial.${Math.floor(Math.random() * 100000)}@example.com`;
  const testClerkId = `user_clerk_test_${Math.floor(Math.random() * 1000000)}`;
  const testFirstName = "ClerkTest";
  const testLastName = "Verified";
  const testCompany = "Clerk Webhook Inc";

  console.log(`Generating mock event for user: ${testEmail} (${testClerkId})`);

  const mockReq: any = {
    headers: {
      'svix-id': 'msg_dummy',
      'svix-timestamp': '12345678',
      'svix-signature': 'sig_dummy', // We bypass verification if no CLERK_WEBHOOK_SECRET is set or mock it
    },
    body: {
      type: 'user.created',
      data: {
        id: testClerkId,
        first_name: testFirstName,
        last_name: testLastName,
        email_addresses: [
          { email_address: testEmail }
        ],
        unsafe_metadata: {
          company: testCompany,
          jobTitle: "Integration Tester",
          apiUse: "Mainly Claude",
          signupIntent: "demo",
          isProfessionalServices: true,
          referralGraph: "retail",
          promoTag: "CLERKTEST"
        }
      }
    }
  };

  const mockRes = mockResponse();

  // Temporarily unset secret for signature bypass in local dry-run
  const originalSecret = process.env.CLERK_WEBHOOK_SECRET;
  process.env.CLERK_WEBHOOK_SECRET = "";

  try {
    // Invoke the router handler directly
    const routeHandler = (webhookRouter as any).stack.find((layer: any) => layer.route && layer.route.path === '/clerk')?.route?.stack?.[0]?.handle;
    
    if (!routeHandler) {
      throw new Error("Could not find '/clerk' route handler in webhookRouter");
    }

    console.log("Invoking Clerk webhook handler...");
    await routeHandler(mockReq, mockRes, () => {});

    console.log("Webhook Response Status:", mockRes.statusCode || 200);
    console.log("Webhook Response Data:", mockRes.jsonData);

    if (mockRes.jsonData?.ok) {
      console.log("\n[SUCCESS] Webhook handled successfully. Verifying Airtable writes...");
      
      // 1. Verify User Record exists
      const userRes = await queryAirtable(USERS_TABLE, `{clerkUserId} = '${testClerkId}'`);
      const userRecord = userRes.records?.[0];
      if (userRecord) {
        console.log(`✔ User record created successfully! ID: ${userRecord.id}`);
        console.log(`  email: ${userRecord.fields.email}`);
        console.log(`  clerkUserId: ${userRecord.fields.clerkUserId}`);
        console.log(`  Job Title: ${userRecord.fields['Job Title']}`);
        console.log(`  Role: ${userRecord.fields.Role}`);
        
        // 2. Verify Account Record exists and is linked
        const accountLinks = userRecord.fields.Account as string[];
        if (accountLinks && accountLinks.length > 0) {
          const accountRes = await queryAirtable(ACCOUNTS_TABLE, `RECORD_ID() = '${accountLinks[0]}'`);
          const accountRecord = accountRes.records?.[0];
          if (accountRecord) {
            console.log(`✔ Linked Account record verified! ID: ${accountRecord.id}`);
            console.log(`  Account Name: ${accountRecord.fields['Account Name']}`);
            console.log(`  Plan ID: ${accountRecord.fields.Plan}`);
            console.log(`  vertical: ${accountRecord.fields.vertical}`);
            console.log(`  Is Professional Services: ${accountRecord.fields['Is Professional Services']}`);
            
            // Clean up test records
            console.log("\nCleaning up test records from Airtable...");
            await deleteAirtableRecord(USERS_TABLE, userRecord.id);
            console.log(`✔ Deleted test user record: ${userRecord.id}`);
            
            // Find active key linked to clean up
            const keysRes = await queryAirtable(API_KEYS_TABLE, `{Account} = '${accountRecord.fields['Account Name']}'`);
            const keyRecord = keysRes.records?.[0];
            if (keyRecord) {
              await deleteAirtableRecord(API_KEYS_TABLE, keyRecord.id);
              console.log(`✔ Deleted test key record: ${keyRecord.id}`);
            }
            
            await deleteAirtableRecord(ACCOUNTS_TABLE, accountRecord.id);
            console.log(`✔ Deleted test account record: ${accountRecord.id}`);
          } else {
            console.error("❌ Linked Account record not found in Airtable.");
          }
        } else {
          console.error("❌ User record is not linked to any Account.");
        }
      } else {
        console.error("❌ User record not found by clerkUserId.");
      }
    } else {
      console.error("❌ Webhook failed with error:", mockRes.jsonData?.error);
    }
  } catch (err: any) {
    console.error("❌ Verification exception:", err);
  } finally {
    process.env.CLERK_WEBHOOK_SECRET = originalSecret;
  }
}

runVerification();
