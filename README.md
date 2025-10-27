# AI Sales Agent - User Registration & Dashboard

This is the initial implementation of the AI Sales Agent platform, focusing on user registration and basic dashboard setup.

## Prerequisites

- Node.js ~20.x
- PostgreSQL database (Vercel Postgres recommended)
- npm or yarn or pnpm

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set:
- `DATABASE_URL`: Your PostgreSQL connection string
- `NEXTAUTH_SECRET`: Generate a random secret (e.g., `openssl rand -base64 32`)

### 3. Set Up Database

Run Prisma migrations to create the database schema:

```bash
npx prisma migrate dev --name init
```

Generate Prisma Client:

```bash
npx prisma generate
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests with Vitest
- `npm test -- --ui` - Run tests with UI
- `npm test -- --coverage` - Run tests with coverage report

## Features Implemented

✅ User registration with email and password
✅ Automatic subdomain generation
✅ NextAuth.js authentication
✅ Protected dashboard routes
✅ Basic navigation (Products, Chatbot Integration tabs)
✅ User info display (email, subdomain)
✅ Logout functionality
✅ Welcome screen for new users
✅ Responsive design with Tailwind CSS
✅ Unit tests for registration API
✅ Product management (add, view, search)
✅ Cloudinary image upload
✅ Facebook Page connection via OAuth
✅ Facebook Messenger webhook for receiving messages

## Webhook URL

For Facebook Messenger integration, the webhook endpoint is available at:
- **Development**: `http://localhost:3000/api/webhook/messenger` (Note: Facebook requires HTTPS in production)
- **Production**: `https://your-domain.com/api/webhook/messenger`

See `docs/FACEBOOK_WEBHOOK_SETUP.md` for detailed setup instructions.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript 5
- **UI**: Tailwind CSS 3, shadcn/ui components
- **Authentication**: NextAuth.js v5
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: Zod
- **Testing**: Vitest, React Testing Library

## Project Structure

```
ai-sales-agent/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── register/      # Registration page
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   │   ├── products/
│   │   │   └── chatbot/
│   │   ├── api/
│   │   │   └── auth/          # Auth API routes
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   └── providers.tsx
│   ├── lib/
│   │   ├── auth.ts            # NextAuth config
│   │   ├── db.ts              # Prisma client
│   │   ├── types.ts           # Shared types
│   │   └── utils.ts
│   ├── middleware.ts          # Route protection
│   └── test/
│       └── setup.ts
├── .env.local                 # Environment variables (not in git)
├── .env.example               # Environment variables template
└── package.json
```

## Next Steps

- Story 1.2 will implement the product addition functionality
- Story 1.3 will implement the product management features

## Database Schema

### Users Table
- `id` (UUID) - Primary key
- `email` (VARCHAR 255) - Unique, required
- `password_hash` (VARCHAR 255) - Required
- `subdomain` (VARCHAR 63) - Unique, required
- `created_at` (TIMESTAMPTZ) - Auto-generated

## Security Notes

- Passwords are hashed using bcrypt (10 rounds)
- Sessions are stored as JWT in secure cookies
- All dashboard routes are protected by middleware
- Input validation on both client and server side
- Never exposes password_hash to frontend

## Testing

Run tests:

```bash
npm test
```

Current test coverage focuses on:
- Registration API endpoint
- Input validation
- Duplicate email handling
- Error responses

## License

Proprietary - All rights reserved
# Last updated: Tue Oct 28 00:05:30 +06 2025
