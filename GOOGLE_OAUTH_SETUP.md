# URJASAATHI – Google OAuth & Supabase Authentication Setup Guide

This guide documents the manual configuration steps required in **Google Cloud Console**, **Supabase Dashboard**, and **Vercel** to activate live Google Sign-In for **URJASAATHI**.

> **Important Status Notice:**
> Code support for Google OAuth (PKCE flow, callback code exchange, session restoration, JWT verification, and per-user data isolation) is implemented in the repository. Live Google Sign-In will become active once you complete the manual configuration steps below using your own Google Cloud OAuth credentials.

---

## 1. Google Cloud Console: Create OAuth 2.0 Web Client

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project (or create a dedicated project for **UrjaSaathi**).
3. Navigate to **APIs & Services → OAuth consent screen**:
   - Choose **External** user type and click **Create**.
   - **App name:** `UrjaSaathi - Mission LiFE`
   - **User support email:** `arpitb496@gmail.com`
   - **Authorized domains:** Add `supabase.co`, `vercel.app`, and `run.app`.
   - **Developer contact information:** `arpitb496@gmail.com`
   - Request standard scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
4. Navigate to **APIs & Services → Credentials**:
   - Click **+ Create Credentials → OAuth client ID**.
   - **Application type:** `Web application`
   - **Name:** `UrjaSaathi Supabase Web Client`

---

## 2. Authorized JavaScript Origins

In the Google Cloud OAuth Web Client settings, add the following **Authorized JavaScript origins**:

- Your production Vercel domain (e.g., `https://urjasaathi-mission-life.vercel.app`)
- AI Studio preview/shared URLs:
  - `https://ais-dev-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app`
  - `https://ais-pre-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app`
- Local development origin:
  - `http://localhost:3000`
- Your Supabase project origin:
  - `https://wzkpbofwajdbaqqrviqw.supabase.co`

---

## 3. Supabase Callback URL

Your Supabase project (`wzkpbofwajdbaqqrviqw`) handles the OAuth 2.0 authorization code callback at this exact URL:

```text
https://wzkpbofwajdbaqqrviqw.supabase.co/auth/v1/callback
```

---

## 4. Authorized Redirect URIs

In the Google Cloud Console OAuth Web Client under **Authorized redirect URIs**, add the exact Supabase callback URL:

```text
https://wzkpbofwajdbaqqrviqw.supabase.co/auth/v1/callback
```

Click **Create** (or **Save**) and copy the generated **Client ID** and **Client Secret**.

---

## 5. Supabase Auth → Providers → Google Configuration

1. Open your [Supabase Dashboard](https://supabase.com/dashboard/project/wzkpbofwajdbaqqrviqw).
2. Navigate to **Authentication → Providers → Google**.
3. Toggle **Enable Sign in with Google** to **ON**.
4. Paste the **Client ID (for OAuth)** and **Client Secret (for OAuth)** obtained in Step 4.
5. Ensure **Skip nonce checks** is left off for standard web OAuth.
6. Click **Save**.

---

## 6. Supabase Auth → URL Configuration (Site URL & Redirect URLs)

1. In your Supabase Dashboard, navigate to **Authentication → URL Configuration**.
2. Set **Site URL** to your primary production URL (for example, your Vercel production domain or `https://ais-pre-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app`).
3. Under **Redirect URLs**, add all allowed callback destinations used by the app's PKCE flow (`/auth/callback`):
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/**`
   - `https://ais-dev-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app/auth/callback`
   - `https://ais-pre-4gsfmyj4bafc2ernbnoski-759736537769.asia-northeast1.run.app/auth/callback`
   - `https://<your-vercel-production-domain>.vercel.app/auth/callback`
   - `https://<your-vercel-production-domain>.vercel.app/**`
4. Click **Save**.

---

## 7. Vercel Environment Variables

In **Vercel Dashboard → Project Settings → Environment Variables**, configure both the server-only variables and the browser public variables:

### Server-Only Variables (Never expose to browser)
| Variable | Purpose |
| :--- | :--- |
| `SUPABASE_URL` | `https://wzkpbofwajdbaqqrviqw.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side privileged key used strictly by Node.js backend routes (`/api/missions/*`, `/api/passport/*`, `/api/user/*`). |
| `URJASAATHI_SESSION_SECRET` | 32+ byte random secret for HMAC-SHA256 credential hashes and fallback session signing. |
| `GEMINI_API_KEY` | Platform-managed Gemini API key so all signed-in users access UrjaGuru AI automatically without entering personal API keys. |

### Frontend / Browser Variables (Public Only)
| Variable | Purpose |
| :--- | :--- |
| `VITE_SUPABASE_URL` | `https://wzkpbofwajdbaqqrviqw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase anonymous key (`role: "anon"`). Only the public anon key may be used in frontend code. |

---

## 8. Redeploying After Adding Environment Variables

Because Vite embeds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` during the frontend build step (`npm run build`), you must trigger a fresh deployment after adding or updating environment variables in Vercel:

1. Go to **Vercel Dashboard → Deployments**.
2. Click the **`⋯`** menu on the latest deployment and select **Redeploy** (leave **Use existing Build Cache** unchecked).
3. Once deployed, open `/login` (or click **Sign in with Google** in the top navigation bar) and test the full Google OAuth PKCE sign-in flow.
