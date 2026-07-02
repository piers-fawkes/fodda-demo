# Brief: Fodda API Role Casing & Provisioning Alignment

## Overview
This brief describes the required alignment for User roles and provisioning between the Fodda App Server (`/Fodda`) and the Fodda API Server (`/Fodda API`). 

Due to prior case-sensitivity issues in Airtable queries and role checks, the Fodda App codebase has been standardized on title-cased roles:
- **"Owner"**
- **"Admin"**
- **"Employee"**

We need to ensure that the Fodda API Server aligns with these title-cased roles and handles auto-provisioned users correctly.

## Requirements

### 1. Casing for Role Checkers
Ensure all role validation and logic inside the Fodda API Server use title-case strings:
- Standardize on `Employee` rather than lowercase `employee` or other variations when creating, editing, or validating user roles.
- Ensure that logic retrieving accounts checks `Role` or `role` fields using a case-insensitive match or converts them to title-case before validation.

### 2. Auto-Provisioning Alignment
When auto-provisioning users on the API side (e.g., when a user matches an account's email domain and the B2B auto-provision toggle is on):
- The newly created user's role MUST be set to exactly `"Employee"` (Title Case).
- Ensure the field name in Airtable updates matches `"Role"` (capital R).

### 3. Trial Key Checks
Verify the "fluffy trial" logic:
- Ensure the API server validates trial keys (`sk_trial_...`) correctly.
- Ensure it supports queries both with and without a `user_id` when using a valid trial key.
- Verify token consumption tracking is decremented properly on the corresponding `TRIALS_TABLE` record.

## Verification
- Run cross-repo checks to ensure role casing changes do not break any query authorization or middleware filters in the API server.
- Test endpoint requests with standard "Employee" headers to verify access.
