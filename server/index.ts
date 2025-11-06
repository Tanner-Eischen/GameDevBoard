import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { Request, Response, NextFunction } from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerRoutes } from './routes';
import { log, setupVite, serveStatic } from './vite';
import { validateEnvironment, isDevelopment, getEnvironment } from './config/env';
import { performanceMiddleware } from './middleware/performanceMonitoring';
import { 
  errorHandler, 
  notFoundHandler, 
  logError 
} from './utils/errorHandler';

// Validate environment variables before starting the server
console.log('🔍 Validating environment variables...');
let env: ReturnType<typeof validateEnvironment>;
try {
  env = validateEnvironment();
  console.log('✅ Environment validation passed');
  console.log(`🌍 Running in ${env.NODE_ENV} mode`);
  console.log(`🚀 Server will start on port ${env.PORT}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Environment validation failed');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Performance monitoring middleware (before routes)
app.use(performanceMiddleware);

// Static file serving
app.use('/attached_assets', express.static(join(__dirname, '../attached_assets')));
app.use('/sprites', express.static(join(__dirname, '../public/sprites')));

// Routes will be registered later in the async function

// API request logging (before routes)
app.use('/api', (req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});



app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (env.NODE_ENV === "development") {
    console.log('Setting up Vite dev server...');
    await setupVite(app, server);
  } else {
    console.log('Setting up static file serving...');
    serveStatic(app);
  }

  // 404 handler for unmatched routes (must be after Vite/static setup)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  // Use validated port from environment configuration
  server.listen(env.PORT, () => {
    log(`serving on port ${env.PORT}`);
  });
})();
