import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import type { WebSocket } from 'ws';
import { LiveEventsService } from '../common/live-events.service';

/**
 * Staff-only live feed at /admin/live — pushes new orders / inquiries.
 * Clients authenticate by sending their JWT as the first message.
 */
@WebSocketGateway({ path: '/admin/live', ws: true })
export class LiveGateway {
  private logger = new Logger('LiveGateway');

  constructor(
    private jwt: JwtService,
    private events: LiveEventsService,
  ) {}

  handleConnection(client: WebSocket) {
    let authed = false;
    client.once('message', (raw) => {
      try {
        const token = raw.toString().replace(/^Bearer\s+/i, '');
        const payload = this.jwt.verify<{ sub: string; role: Role }>(token, {
          secret: process.env.JWT_ACCESS_SECRET,
        });
        const isStaff = ([Role.STAFF_SUPPORT, Role.STAFF_MANAGER, Role.STAFF_ADMIN] as Role[]).includes(
          payload.role,
        );
        if (!isStaff) {
          client.close(4003, 'Forbidden');
          return;
        }
        authed = true;
        client.send(JSON.stringify({ event: 'connected' }));
      } catch {
        client.close(4001, 'Unauthorized');
      }
    });

    // Drop connections that never authenticated within 5s
    setTimeout(() => {
      if (!authed) client.terminate();
    }, 5000);

    const unsub = this.events.subscribe((event, payload) => {
      if (authed && client.readyState === 1) {
        client.send(JSON.stringify({ event, payload }));
      }
    });
    client.on('close', () => unsub());
  }
}
