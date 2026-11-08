# JPNK Sports Arena — full website project

This project rebuilds the supplied Claude HTML as a public Vercel website. It retains the original visual styling, embedded arena logo, 14-day calendar, 24 hourly slots per day, ₹400 daytime rate, ₹600 floodlit rate, and the owner bookings view. Claude runtime/database calls are replaced with Vercel API routes and Supabase.

## Before you launch
This is a deployable implementation, but it is **not verified for live payments** until you configure accounts and complete end-to-end tests. Never accept real payments until you have tested slot locking, QR expiry, webhook delivery, duplicate webhook events, payment reconciliation and cancellation/refund handling.

## Setup
1. Create a Supabase project. Run `supabase/schema.sql` in SQL Editor.
2. Create a Razorpay merchant account and request activation of the UPI QR Code API. Start with test credentials.
3. Create a GitHub repository and upload all files in this folder.
4. Import that repository into Vercel. Framework preset: Other; build command: none; output directory: `.`.
5. Add every variable in `.env.example` to Vercel Project Settings → Environment Variables. Generate a long random `SESSION_SECRET` and a unique `ADMIN_PASSWORD`. Do not expose service-role or Razorpay secret keys in frontend code.
6. Deploy. In Razorpay webhooks, add `https://YOUR-DOMAIN/api/razorpay-webhook`, subscribe to `qr_code.credited`, and set the webhook secret to `RAZORPAY_WEBHOOK_SECRET`.
7. Open `https://YOUR-DOMAIN/#owner` to access the owner dashboard.
8. For WhatsApp notifications, configure Meta WhatsApp Cloud API and an approved template with four body variables: customer name, booking code, amount, slots.

## Important source-derived settings
- Arena name: JPNK Sports Arena
- Day price: ₹400/hour
- Night/floodlit price: ₹600/hour (18:00–05:59)
- Booking window: 14 days including today
- Payment beneficiary shown in original file: P H UMESH
- Original UPI ID: 9390559386-3@ibl (retained as source data; the live flow uses Razorpay dynamic QR instead)
- Original owner WhatsApp number in source: 919390559386

## Payment and booking safeguards
- The booking code is generated server-side. A separate random access token protects customer status lookup.
- The customer cannot mark their own payment as paid. Razorpay webhook signature and captured amount/QR ID are verified before confirmation.
- The QR/slot hold expires after 10 minutes. A payment arriving after expiry requires manual reconciliation; do not assume it has booked the slot.
- The owner page is protected by a password-backed, HTTP-only session cookie.
- The app currently supports owner cancellation, but refunds are not automated. Cancel in the app only after handling the refund with the payment provider.
- The WhatsApp API only sends if the credentials and approved template are configured.

## Known operational work before production
Implement a scheduled cleanup/reconciliation process for expired unpaid holds and late payments; test refund workflow; add rate limiting and monitoring; verify Razorpay UPI QR activation and webhook retries; confirm the exact WhatsApp template accepted by Meta. The source HTML's former manual approval flow is intentionally replaced by payment-provider verification, because a user click is not proof of payment.
