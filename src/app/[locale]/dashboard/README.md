# Dashboard Google OAuth

The internal dashboard at `/dashboard` signs in with Google through Better Auth. Only `support@simverse.sh` can access it (enforced in app code). Use an **Internal** OAuth consent screen so Google also limits the client to your Workspace.

## 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project (for example `simverse-dashboard`).
3. Confirm you are signed in with a **Google Workspace** admin on the `simverse.sh` org. Internal apps are not available on personal Gmail Cloud projects.

## 2. OAuth consent screen (Internal)

1. Go to **APIs & Services → OAuth consent screen** (or **Google Auth platform → Branding**).
2. User type: **Internal**. Only accounts in the Workspace can complete OAuth.
3. App name: `Simverse Dashboard` (or similar).
4. User support email and developer contact: `support@simverse.sh`.
5. App domain / authorized domain: `simverse.sh` (and your ngrok host is **not** an authorized domain; that is fine — origins and redirect URIs are set on the client, not here).
6. Scopes: keep the defaults Better Auth uses (`openid`, `email`, `profile`). Do not add sensitive scopes.
7. Save.

Internal means “anyone in this Workspace could theoretically click through Google,” not “anyone can use the dashboard.” The app still rejects every email except `support@simverse.sh`.

## 3. OAuth client (Web application)

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name: `Simverse Dashboard Web`.
4. **Authorized JavaScript origins** — the public site origin only, no path:

   - Production: `https://simverse.sh` (or whatever `BETTER_AUTH_URL` is, without a trailing slash)
   - Local Mini App / ngrok: the same host as `BETTER_AUTH_URL`, e.g. `https://<subdomain>.ngrok-free.app`

5. **Authorized redirect URIs** — Better Auth’s Google callback:

   ```
   {BETTER_AUTH_URL}/api/auth/callback/google
   ```

   Examples:

   - `https://simverse.sh/api/auth/callback/google`
   - `https://<subdomain>.ngrok-free.app/api/auth/callback/google`

   Add **every** origin you actually use. Google will not accept `http://localhost:3000` unless that origin is listed; this app’s `BETTER_AUTH_URL` is HTTPS.

6. Create the client. Copy **Client ID** and **Client secret**.

## 4. App environment

Set in `.env` (and Compose, which passes these through to the app):

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=....
BETTER_AUTH_URL=https://<public-host>
```

`BETTER_AUTH_URL` must match the origin used in the Google client. Restart the app after changing env.

Required in production; optional in development (the Google button is hidden if either value is missing).

## 5. Verify

1. Open `/dashboard` while signed out of the Mini App (or use a browser that has no Telegram session cookie).
2. Sign in with Google as `support@simverse.sh`.
3. You should land on the dashboard with Home / Orders / Users.
4. Any other Google account in the Workspace should fail at user create (`FORBIDDEN`) and must not get a `user` row.

If Google shows `redirect_uri_mismatch`, the URI in the client must match `{BETTER_AUTH_URL}/api/auth/callback/google` exactly (scheme, host, no trailing slash on the path).

Open `/dashboard` on the **same host** as `BETTER_AUTH_URL` (the ngrok or production URL, not a mismatched `localhost` origin unless that origin is listed as a Google redirect URI).

`state_mismatch` after Google returns means the OAuth state cookie did not round-trip. This app stores state in the `verification` table and does not require that cookie on callback; restart the app after pulling that change and try again.
