# StartupForge Server

Express.js backend for the StartupForge platform — REST API with dual auth (Better Auth + JWT).

## Features

- **Dual authentication**: Better Auth (primary) + custom JWT (fallback)
- **Role-based access control**: Admin, Founder, Collaborator
- **Startups CRUD**: Create, read, update, delete startup profiles
- **Opportunities CRUD**: Post team openings with pagination, search ($regex), filter ($in)
- **Applications**: Apply, accept/reject with status tracking
- **Payments**: Stripe Checkout integration for premium founder access
- **Admin panel**: Manage users (block/unblock), startups (approve/remove), view transactions

## Tech Stack

- Node.js + Express
- MongoDB (native driver)
- Better Auth + JSON Web Tokens
- bcryptjs
- Stripe SDK
- CORS with credentials

## Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret
BETTER_AUTH_SECRET=your_better_auth_secret
BETTER_AUTH_URL=http://localhost:5000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
STRIPE_SECRET_KEY=sk_test_...
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

## Getting Started

```bash
npm install
npm start
```
