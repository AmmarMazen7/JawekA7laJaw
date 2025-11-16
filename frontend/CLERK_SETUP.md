# Clerk Authentication Setup Guide

## 🔐 Clerk Authentication has been added to your Queue Analytics app!

### What's Installed:
- ✅ Clerk Next.js SDK (`@clerk/nextjs`)
- ✅ Sign In page at `/sign-in`
- ✅ Sign Up page at `/sign-up`
- ✅ Protected routes (requires authentication)
- ✅ User button in header with profile management

---

## 📋 Setup Steps:

### 1. Create a Clerk Account
1. Go to https://dashboard.clerk.com
2. Sign up for a free account
3. Create a new application

### 2. Get Your API Keys
1. In your Clerk dashboard, go to **API Keys**
2. Copy your **Publishable Key** (starts with `pk_test_...`)
3. Copy your **Secret Key** (starts with `sk_test_...`)

### 3. Update Environment Variables
Edit `/home/ubuntu/inference/JawekA7laJaw/frontend/.env.local`:

```bash
# Replace these with your actual keys from Clerk dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
CLERK_SECRET_KEY=sk_test_your_actual_secret_key_here
```

### 4. Restart Your Development Server
```bash
cd /home/ubuntu/inference/JawekA7laJaw/frontend
pnpm dev
```

---

## 🎯 Features:

### Authentication Flow:
- **Public Routes**: `/sign-in`, `/sign-up`
- **Protected Routes**: All other pages (dashboard, video upload, employees)
- **Redirect**: Unauthenticated users are automatically redirected to sign-in

### User Management:
- **Sign In/Sign Up**: Beautiful, customizable auth pages
- **User Button**: In the header - shows user avatar and profile menu
- **Profile Management**: Users can update their profile, change password, etc.
- **Sign Out**: Redirects to sign-in page after logout

### Security:
- Middleware protects all routes except auth pages
- Server-side authentication checks
- Secure session management
- JWT tokens

---

## 🎨 Customization:

### Change Appearance:
Edit the `appearance` prop in:
- `/app/sign-in/[[...sign-in]]/page.tsx`
- `/app/sign-up/[[...sign-up]]/page.tsx`
- `/components/layout/header.tsx` (UserButton)

### Configure Routes:
Edit `.env.local` to change redirect URLs:
```bash
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

### Public Routes:
Add more public routes in `middleware.ts`:
```typescript
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',  // Add more routes
])
```

---

## 🧪 Testing:

### Test Authentication:
1. Navigate to `http://localhost:3000`
2. You should be redirected to `/sign-in`
3. Click "Sign up" to create a test account
4. After signing up, you'll be redirected to the dashboard
5. Click the user button in the header to see profile options

### Test Protected Routes:
- Try accessing any page without signing in - you'll be redirected
- Sign in and navigate freely between pages
- Sign out and verify redirect to sign-in

---

## 📚 Additional Resources:

- [Clerk Documentation](https://clerk.com/docs)
- [Next.js Integration](https://clerk.com/docs/quickstarts/nextjs)
- [Customization Guide](https://clerk.com/docs/components/customization/overview)
- [User Management](https://clerk.com/docs/users/overview)

---

## 🔒 Security Best Practices:

1. **Never commit** `.env.local` to git
2. Use **different keys** for development and production
3. Rotate keys if they're accidentally exposed
4. Enable **Multi-Factor Authentication** in Clerk dashboard
5. Set up **Webhooks** for user events (optional)

---

## 🆘 Troubleshooting:

### Issue: "Invalid publishable key"
- Double-check your keys in `.env.local`
- Make sure keys start with `pk_test_` or `pk_live_`
- Restart the dev server after updating env vars

### Issue: Redirect loop
- Check middleware.ts for correct route matchers
- Verify NEXT_PUBLIC_CLERK_SIGN_IN_URL is set correctly

### Issue: User button not showing
- Verify ClerkProvider wraps your app in layout.tsx
- Check that UserButton is imported correctly
- Clear browser cache and cookies

---

## 🚀 Next Steps:

1. **Get your Clerk keys** from https://dashboard.clerk.com
2. **Update `.env.local`** with your actual keys
3. **Restart the server**: `pnpm dev`
4. **Test authentication** by visiting http://localhost:3000
5. **Customize** the appearance to match your brand

Your Queue Analytics app is now secured with Clerk! 🎉
