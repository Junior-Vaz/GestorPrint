import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class LogsGateway {
  @WebSocketServer()
  server: Server;

  emit(entry: { level: string; context: string; message: string; timestamp: string }) {
    if (this.server) {
      this.server.emit('system_log', entry);
    }
  }
}
