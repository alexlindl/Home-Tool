import { createServer, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { initializeWebSocket } from './socketServer';

describe('WebSocket Server', () => {
  let httpServer: HttpServer;
  let ioServer: Server;
  let clientA: ClientSocket;
  let clientB: ClientSocket;
  const TEST_PORT = 4567;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = initializeWebSocket(httpServer);
    httpServer.listen(TEST_PORT, () => done());
  });

  afterAll((done) => {
    if (clientA?.connected) clientA.disconnect();
    if (clientB?.connected) clientB.disconnect();
    ioServer.close();
    httpServer.close(() => done());
  });

  beforeEach((done) => {
    clientA = ClientIO(`http://localhost:${TEST_PORT}`, {
      query: { userName: 'Alex' },
      transports: ['websocket'],
    });
    clientB = ClientIO(`http://localhost:${TEST_PORT}`, {
      query: { userName: 'Becky' },
      transports: ['websocket'],
    });

    let connected = 0;
    const onConnect = () => {
      connected++;
      if (connected === 2) done();
    };
    clientA.on('connect', onConnect);
    clientB.on('connect', onConnect);
  });

  afterEach(() => {
    if (clientA?.connected) clientA.disconnect();
    if (clientB?.connected) clientB.disconnect();
  });

  describe('Connection handling', () => {
    it('should accept client connections with userName query', () => {
      expect(clientA.connected).toBe(true);
      expect(clientB.connected).toBe(true);
    });
  });

  describe('Task synchronization events', () => {
    it('should broadcast task:sync with action "created" when a client emits task:created', (done) => {
      const taskData = { id: '1', title: 'Vacuum', assignedTo: 'Alex' };

      clientB.on('task:sync', (payload: { action: string; data: unknown }) => {
        expect(payload.action).toBe('created');
        expect(payload.data).toEqual(taskData);
        done();
      });

      clientA.emit('task:created', taskData);
    });

    it('should broadcast task:sync with action "updated" when a client emits task:updated', (done) => {
      const taskData = { id: '1', title: 'Vacuum (updated)', assignedTo: 'Becky' };

      clientB.on('task:sync', (payload: { action: string; data: unknown }) => {
        expect(payload.action).toBe('updated');
        expect(payload.data).toEqual(taskData);
        done();
      });

      clientA.emit('task:updated', taskData);
    });

    it('should broadcast task:sync with action "completed" when a client emits task:completed', (done) => {
      const taskData = { id: '1', completedBy: 'Alex' };

      clientB.on('task:sync', (payload: { action: string; data: unknown }) => {
        expect(payload.action).toBe('completed');
        expect(payload.data).toEqual(taskData);
        done();
      });

      clientA.emit('task:completed', taskData);
    });

    it('should NOT send task:sync back to the emitting client', (done) => {
      const taskData = { id: '2', title: 'Dishes' };

      clientA.on('task:sync', () => {
        done.fail('Emitting client should not receive its own broadcast');
      });

      clientB.on('task:sync', () => {
        // Give clientA some time to potentially receive the event
        setTimeout(() => done(), 100);
      });

      clientA.emit('task:created', taskData);
    });
  });

  describe('Shopping list synchronization events', () => {
    it('should broadcast shopping:sync with action "added" when a client emits shopping:added', (done) => {
      const itemData = { id: '10', name: 'Milk', category: 'dairy' };

      clientB.on('shopping:sync', (payload: { action: string; data: unknown }) => {
        expect(payload.action).toBe('added');
        expect(payload.data).toEqual(itemData);
        done();
      });

      clientA.emit('shopping:added', itemData);
    });

    it('should broadcast shopping:sync with action "purchased" when a client emits shopping:purchased', (done) => {
      const itemData = { id: '10', purchasedBy: 'Alex' };

      clientB.on('shopping:sync', (payload: { action: string; data: unknown }) => {
        expect(payload.action).toBe('purchased');
        expect(payload.data).toEqual(itemData);
        done();
      });

      clientA.emit('shopping:purchased', itemData);
    });

    it('should NOT send shopping:sync back to the emitting client', (done) => {
      const itemData = { id: '11', name: 'Bread', category: 'bakery' };

      clientA.on('shopping:sync', () => {
        done.fail('Emitting client should not receive its own broadcast');
      });

      clientB.on('shopping:sync', () => {
        setTimeout(() => done(), 100);
      });

      clientA.emit('shopping:added', itemData);
    });
  });
});
