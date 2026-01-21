import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { join } from 'path';
import { AppModule } from './app.module';

// Helper function to get allowed CORS origins
function getAllowedOrigins(): string[] {
  return process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim().replace(/\/$/, '')) // Remove trailing slashes
    : ['http://localhost:5173', 'http://localhost:5174'];
}

class SocketIOAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: getAllowedOrigins(),
        credentials: true,
      },
      // Increase ping/pong timeouts to handle network interruptions better
      // pingInterval: How often server sends ping (default: 25000ms)
      // pingTimeout: How long to wait for pong response (default: 20000ms)
      // Increasing these reduces false disconnections from temporary network issues
      pingInterval: 30000, // 30 seconds (increased from 25s)
      pingTimeout: 60000, // 60 seconds (increased from 20s) - more tolerant of slow networks
      // Allow more time for connection attempts
      connectTimeout: 45000, // 45 seconds (default: 45000ms)
      // Enable per-message deflate compression for better performance
      perMessageDeflate: true,
    });
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Use Socket.IO adapter for WebSocket support (must be before setGlobalPrefix)
  app.useWebSocketAdapter(new SocketIOAdapter(app));
  
  // Set global prefix for all routes (Socket.IO is excluded automatically)
  app.setGlobalPrefix('api');
  
  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads',
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();

