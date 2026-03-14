import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard, PrismaService],
  exports: [PassportModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
