import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'juan@universidad.edu.co' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;
}
