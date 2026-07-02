import { escapeAirtableString } from '../server/db.js';
import { authenticateSession } from '../server/helpers.js';
import assert from 'assert';

console.log("Starting security verification tests...");

// Test 1: escapeAirtableString
try {
  const input1 = "hello ' world";
  const output1 = escapeAirtableString(input1);
  assert.strictEqual(output1, "hello \\' world");

  const input2 = "hello \\' world";
  const output2 = escapeAirtableString(input2);
  assert.strictEqual(output2, "hello \\\\\\' world");

  const input3 = 'test " double quotes';
  const output3 = escapeAirtableString(input3);
  assert.strictEqual(output3, 'test " double quotes');

  console.log("✓ Test 1: escapeAirtableString passed!");
} catch (e) {
  console.error("✗ Test 1: escapeAirtableString failed:", e);
}

// Test 2: authenticateSession with missing token
(async () => {
  try {
    const mockReqMissing: any = {
      headers: {},
      query: {},
      cookies: {}
    };
    const userMissing = await authenticateSession(mockReqMissing);
    assert.strictEqual(userMissing, null);
    console.log("✓ Test 2: authenticateSession with missing token passed (returned null)!");
  } catch (e) {
    console.error("✗ Test 2: authenticateSession with missing token failed:", e);
  }
})();
