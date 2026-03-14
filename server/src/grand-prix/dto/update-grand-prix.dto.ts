import { PartialType } from '@nestjs/mapped-types';
import { CreateGrandPrixDto } from './create-grand-prix.dto';

export class UpdateGrandPrixDto extends PartialType(CreateGrandPrixDto) {}
