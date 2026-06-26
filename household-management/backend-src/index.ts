import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './db/connection';
import userRoutes from './routes/userRoutes';
import taskRoutes from './routes/taskRoutes';
import shoppingRoutes from './routes/shoppingRoutes';
import adminRoutes from './routes/adminRoutes';
import categoryRoutes from './routes/categoryRoutes';
import taskListRoutes from './routes/taskListRoutes';
import shoppingListRoutes from './routes/shoppingListRoutes';
import { sanitizeStrings } from './middleware/validation';
import { initializeWebSocket } from './websocket';
import { reminderService } from './services';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize string inputs
app.use(sanitizeStrings);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/health/db', async (_req: Request, res: Response) => {
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      res.status(200).json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Basic route
app.get('/', (_req: Request, res: Response) => {
  res.json({ 
    message: 'Household Management API',
    version: '0.5.4-alpha',
    endpoints: {
      health: '/health',
      healthDb: '/health/db',
      users: '/api/users',
    },
  });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/task-lists', taskListRoutes);
app.use('/api/shopping-lists', shoppingListRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Create HTTP server and attach Socket.io
const httpServer = createServer(app);
initializeWebSocket(httpServer);

// Start server
const server = httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log(`Database health: http://${HOST}:${PORT}/health/db`);

  // Start the reminder scheduler
  reminderService.startScheduler();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  reminderService.stopScheduler();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  reminderService.stopScheduler();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
