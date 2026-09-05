# Job Finder Server

Backend API for StartupForge platform. Handles authentication, RBAC, CRUD operations, payments, and admin panel.

## Tech Stack

- **Runtime:** Node.js + Express.js
- **Database:** MongoDB (native driver)
- **Authentication:** Better Auth + JWT
- **Password:** bcryptjs
- **Payments:** Stripe SDK
- **Cookies:** cookie-parser

## Features

- Dual authentication (Better Auth + JWT fallback)
- Role-based access control
- Startups/opportunities CRUD with pagination/search/filter
- Application system
- Stripe payment integration
- Admin panel

## API Endpoints

```
POST   /api/auth/register     - Register user
POST   /api/auth/login        - Login user
GET    /api/startups          - Get all startups
POST   /api/startups          - Create startup
PUT    /api/startups/:id      - Update startup
DELETE /api/startups/:id      - Delete startup
GET    /api/opportunities     - Get opportunities
POST   /api/applications      - Submit application
POST   /api/payments          - Process payment
```

## Getting Started

```bash
# Clone the repository
git clone https://github.com/sojibahmedshorif25-ai/Job-Finder.git

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Seed database
npm run seed

# Start development server
npm run dev
```

## Author

**Sojib Ahmed**
- GitHub: [@sojibahmedshorif25-ai](https://github.com/sojibahmedshorif25-ai)
