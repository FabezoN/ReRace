import { IsNotEmpty, IsString, IsNumber, Min, IsUUID, IsOptional, IsNumberString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({ example: 'b566a345-1234-4567-...' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  grandPrixId: string;

  @ApiProperty({ example: 'Tribune K' })
  @IsString()
  @IsNotEmpty()
  section: string;

  @ApiProperty({ example: '4', description: 'Rang (chiffres uniquement)' })
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true }, { message: 'Le rang doit contenir uniquement des chiffres' })
  row: string;

  @ApiProperty({ example: '12', description: 'Place / Siège (chiffres uniquement)' })
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true }, { message: 'La place doit contenir uniquement des chiffres' })
  seat: string;

  @ApiProperty({ example: 150.50 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  price: number;

  @ApiProperty({ example: 'https://xyz.supabase.co/storage/v1/object/public/tickets/image.png' })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
