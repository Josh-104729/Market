# Black Market Application

A full-stack Black Market web application with separate frontend, admin panel, and backend API.

## Project Structure

```
Market/
├── backend/          # NestJS Backend API
├── frontend/         # React Frontend (Port 5173)
└── admin/            # React Admin Panel (Port 5174)
```

## Tech Stack

### Backend
- Node.js
- NestJS
- TypeScript
- TypeORM
- MySQL

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS

### Admin
- React
- Vite
- TypeScript
- Tailwind CSS

## Database Configuration

- Database: `market`
- User: `root`
- Password: `Csh104729!`
- Host: `localhost`
- Port: `3306`

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MySQL Server
- npm or yarn

### Setup

1. **Create MySQL Database**
   ```sql
   CREATE DATABASE market;
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

4. **Install Admin Dependencies**
   ```bash
   cd admin
   npm install
   ```

### Running the Application

1. **Start Backend** (Port 3000)
   ```bash
   cd backend
   npm run start:dev
   ```

2. **Start Frontend** (Port 5173)
   ```bash
   cd frontend
   npm run dev
   ```

3. **Start Admin Panel** (Port 5174)
   ```bash
   cd admin
   npm run dev
   ```

## Development

- Backend API: http://localhost:3000
- Frontend: http://localhost:5173
- Admin Panel: http://localhost:5174

## Notes

- The backend uses TypeORM with `synchronize: true` for development. Set this to `false` in production.
- CORS is enabled for frontend (5173) and admin (5174) ports.

