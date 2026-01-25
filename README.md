This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## Environment variables

This app uses email-only OTP (no SMS). To run password reset and OTP flows you must configure:

- `RESEND_API_KEY` - Resend API key
- `EMAIL_FROM` - from address, e.g. `Progrr <no-reply@yourdomain.com>`
- `OTP_SECRET` - secret used to hash OTPs (long random string)
- `AUTH_JWT_SECRET` - secret used to sign auth cookies (long random string)
- `MONGODB_URI` - Mongo connection string

Optional (recommended) for branded emails:

- `EMAIL_LOGO_URL` - public https URL to your logo image (e.g. `https://yourdomain.com/progrr-logo.png`)
- `EMAIL_PUBLIC_ORIGIN` - public origin used to build asset URLs if `EMAIL_LOGO_URL` is not set (falls back to `APP_URL`, `NEXT_PUBLIC_APP_URL`, or `VERCEL_URL`)

Local development: set these in `.env.local` and restart `npm run dev` after changing env vars.

Production (e.g. Vercel): `.env.local` is not used; set the same variables in your hosting provider's environment settings.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
