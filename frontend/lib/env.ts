// Environment variable helpers
export const env = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  FASTAPI_URL: process.env.FASTAPI_URL || 'http://localhost:8000',
  WS_URL:
    process.env.NEXT_PUBLIC_WS_URL ||
    `${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://localhost:8000'}/api/ws`,
  NODE_ENV: process.env.NODE_ENV,
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
}

// Example .env.local configuration:
// NEXT_PUBLIC_API_URL=http://localhost:8000
// FASTAPI_URL=http://localhost:8000
// NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/ws
