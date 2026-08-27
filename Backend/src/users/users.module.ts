import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { RbacPermissionsController } from './roles-permissions.controller';

@Module({
  controllers: [UsersController, AdminUsersController, RbacPermissionsController],
})
export class UsersModule {}


