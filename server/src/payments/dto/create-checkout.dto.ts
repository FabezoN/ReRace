import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({ example: 'uuid-du-ticket' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  ticketId: string;

  @ApiProperty({ example: 'acheteur@email.com' })
  @IsEmail({}, { message: 'Email invalide' })
  @IsNotEmpty({ message: 'Email requis' })
  email: string;
}
