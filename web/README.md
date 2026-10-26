# MCC Fees · Firebase + Vercel

This is the current deployment target. The earlier Django prototype remains at the repository root; it is not used by this frontend. Real student data has not been imported or published.

## Local development

Use the existing checkout; cloud tasks are isolated, so do not create a worktree unless requested.

```sh
cd /workspace/college-account/web
npm ci --cache /tmp/mcc-npm-cache
cp .env.example .env.local
# Fill the public Firebase web configuration and secure server credentials locally.
npm run dev
```

Without configuration, the application offers a clearly labelled, read-only fictional sample workspace. It does not simulate a successful Firebase connection.

Validation: `npm test`, `npm run build`, `npm run typecheck` (after build generates Next types).

## Firebase project setup

1. Open the Firebase project, Add app → Web (`</>`) → nickname `MCC Fees` → Register app. Firebase Hosting is not required for Vercel.
2. Copy the public web config fields into `.env.local` or Vercel Environment Variables:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`
3. Authentication → Get started → Sign-in method → Email/Password → Enable. In Users, create the intended administrator account with your own secure password. Do not share its password in chat.
4. Create a Cloud Firestore database. Select the appropriate permanent region and **production mode**. Set its Rules to the deny-all rules in `firestore.rules`. Application access goes exclusively through the authorized server API; public browser database access is not needed.
5. Project settings → Service accounts → Firebase Admin SDK → Generate new private key. Keep the JSON private. In Vercel, set server-only `FIREBASE_SERVICE_ACCOUNT_JSON` to the full JSON. Never name it `NEXT_PUBLIC_*`, commit it, upload it in chat, or put it in a screenshot. Alternatively use supported Google Application Default Credentials on a trusted local machine. Grant only the IAM access required for Firestore data and Firebase Authentication user lookup / token revocation checks.
6. On a trusted machine with the admin credentials available securely, assign an initial user role:

```sh
# Node 24 supports --env-file. .env.local must remain untracked.
node --env-file=.env.local scripts/set-role.mjs admin@example.com admin
```

Allowed roles: `admin`, `accountant`, `viewer`. Both admin and accountant can create students, fees and payments and import reviewed rows; viewer is read-only. Only a trusted operator can change claims. Sign out and sign in after changing a role. No public sign-up or initial-admin endpoint exists.

## Vercel deployment

1. Put the reviewed code in your GitHub repository. The source must exist on the remote before Vercel can import it; no commit or push is performed automatically here.
2. Vercel → Add New → Project → import `jaison3853-del/college-account`.
3. Framework: Next.js. **Root Directory: `web`**. Build: `npm run build`. Use Node.js 24.x (or a compatible supported version >=20.9).
4. Set the four public Firebase variables and the server-only service-account JSON. Configure only trusted environments. Do not give an untrusted preview deployment production database credentials.
5. Deploy. Add the final Vercel hostname under Firebase Authentication → Settings → Authorized domains. If using a custom domain, add that too.
6. Verify login with the role-assigned user; create a temporary test student/fee; record payments to both accounts; check ledger totals, receipts and collection filters. Use a separate test Firebase project for smoke data before production.
7. Import the real workbook only after reviewing selected rows. Main tables are authoritative. Pending summaries are excluded. Historical collections have no invented dates. Exact workbook rows are idempotent; altered workbooks need manual matching. Imports accept at most 20 selected students per confirmation and can safely be retried.

Do not put emulator variables in Vercel. No Firebase project, user role, Firestore rule, GitHub push or Vercel deployment has been changed by merely writing these files.

## Accounting and integrity

Money is stored as integer paise. Each payment belongs to a single receiving account. Fee balances subtract both accounts after concession. Firestore transactions keep each account's fee total and the immutable payment record consistent under concurrency. Client-provided idempotency tokens prevent duplicate payment retries; changed payloads with a reused token are rejected. Imported rows, students, fees and historical payments are written atomically per student. Admission-number uniqueness is enforced transactionally. Direct browser Firestore access is denied; all API routes verify Firebase ID tokens, revocation and roles.

The app supports student/semester ledgers, account and date reports, pending filters, CSV exports, and browser Print / Save PDF. Fees must be assigned per student for exceptions. It does not implement refunds, payment reversals, automatic credit transfers, billing integrations, a complete financial audit workflow, backup automation or course-level bulk fee assignment. Plan database backups and retention before storing live financial data.

Initial implementation loads the complete ledger into the authorized browser. Before scaling to large multi-year databases, add server pagination and indexed report queries. Verify Firebase/Vercel quotas and billing in your own accounts; no paid plan change is performed automatically.

## Current validation

Nine unit/parser tests pass, the production build and TypeScript checks pass, and the current production dependency audit reports no known vulnerabilities. Desktop and mobile sample-workspace browser checks passed with no JavaScript errors and no mobile document overflow. The actual source workbook parses into 156 student rows (87 with assigned fees), without importing real data.

An emulator integration script is included at `scripts/emulator-smoke.mjs`, but its execution is currently blocked by the cloud network policy when downloading the official Firestore emulator from `storage.googleapis.com`. No emulator integration pass or live Firebase database validation is claimed. To run on a configured machine with Java 21+ and Firebase CLI:

```sh
firebase emulators:exec --only auth,firestore --project demo-mcc-fees 'node scripts/emulator-smoke.mjs'
```

The script uses only synthetic data in a demo emulator project, checks role access, concurrent payment retries, split totals, reviewed import and browser rules, and never connects to the live Firebase project.
