# StartupForge Server

StartupForge Server is the backend application powering the co-founder matching and team-building platform. It is built using Node.js, Express, MongoDB, Better Auth, and Stripe for payments.

## 🚀 Features

- **JWT Cookie-Based Authentication**: Secure authentication via Better Auth and custom JWT generation stored in HTTPOnly cookies.
- **Role-Based Access Control (RBAC)**: Route protection and middleware for Founders, Collaborators, and Admins.
- **Stripe Payments**: Integration with Stripe Checkout for premium subscriptions allowing founders to post more than 3 opportunities.
- **Database Seeding**: Seeding script with dummy users, startups, opportunities, and applications for local testing.
- **Opportunity Management**: Complete CRUD for startup profiles and job listings with search ($regex), filter ($in), and pagination support.
- **Admin panel controls**: Block/unblock users, approve/reject startup profiles, and view payment history.

## 🛠️ Technology Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: MongoDB Driver (Native)
- **Authentication**: Better Auth + custom JWT (`jsonwebtoken`)
- **Payments**: Stripe Node SDK
- **Environment Management**: `dotenv`
- **JSON Parser & Cookie Parser**: Built-in Express middleware and `cookie-parser`

## 📦 Setup & Installation

1. Navigate to the server directory:
   ```bash
   cd startupforge-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file and populate the variables:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   BETTER_AUTH_SECRET=your_better_auth_secret
   BETTER_AUTH_URL=http://localhost:5000
   STRIPE_SECRET_KEY=your_stripe_secret_key
   CLIENT_URL=http://localhost:5173
   ```

4. Run the database seeding script (optional):
   ```bash
   node seed.js
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## 🛣️ API Reference

- `ALL /api/auth-better/*`: Better Auth handlers.
- `POST /api/auth/register`: Create user.
- `POST /api/auth/login`: Authenticate user and issue JWT cookie.
- `POST /api/auth/logout`: Clear JWT cookie.
- `GET /api/auth/me`: Get current authenticated user profile.
- `GET /api/startups`: Browse approved startups.
- `POST /api/startups`: Create startup profile (Founder).
- `GET /api/opportunities`: Browse opportunities (paginated).
- `POST /api/opportunities`: Post a role requirement.
- `POST /api/applications`: Apply to an opportunity.
- `GET /api/admin/stats`: Get dashboard insights (Admin).
