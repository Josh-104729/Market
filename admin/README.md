# OmniMart Admin

OmniMart Admin Panel built with React, Vite, TypeScript, and Tailwind CSS. Manage the universal marketplace where anyone can sell anything and buy anything.

## Environment variables (.env)

Create a file named `.env` inside the `admin/` folder (same level as `package.json`) and set your backend URLs.

You can copy the template from `admin/env.example`.

- **`VITE_API_URL`**: Backend API base URL (include `/api`), e.g. `http://localhost:3000/api`
- **`VITE_BACKEND_URL`**: Backend base URL (no `/api`) used for images/uploads, e.g. `http://localhost:3000`
- **`VITE_SOCKET_URL`**: Socket.IO base URL (no `/chat`), e.g. `http://localhost:3000`
- **`VITE_PROXY_TARGET`**: (Optional) Dev proxy target used by Vite, e.g. `http://localhost:3000`

## Installation

```bash
npm install
```

## Running the app

```bash
# development
npm run dev

# build for production
npm run build

# preview production build
npm run preview
```

