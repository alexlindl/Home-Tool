import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

/**
 * Initialize the WebSocket server and attach it to the HTTP server.
 * Sets up connection handling and event listeners for task and shopping sync.
 */
export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    const userName = socket.handshake.query.userName as string | undefined;
    console.log(`WebSocket client connected: ${socket.id} (user: ${userName || 'unknown'})`);

    // --- Task synchronization events ---
    socket.on('task:created', (data: unknown) => {
      socket.broadcast.emit('task:sync', { action: 'created', data });
    });

    socket.on('task:updated', (data: unknown) => {
      socket.broadcast.emit('task:sync', { action: 'updated', data });
    });

    socket.on('task:completed', (data: unknown) => {
      socket.broadcast.emit('task:sync', { action: 'completed', data });
    });

    // --- Shopping list synchronization events ---
    socket.on('shopping:added', (data: unknown) => {
      socket.broadcast.emit('shopping:sync', { action: 'added', data });
    });

    socket.on('shopping:purchased', (data: unknown) => {
      socket.broadcast.emit('shopping:sync', { action: 'purchased', data });
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`WebSocket client disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  console.log('WebSocket server initialized');
  return io;
}

/**
 * Get the Socket.io server instance.
 * Can be used by services to emit events server-side.
 */
export function getIO(): Server | null {
  return io;
}
