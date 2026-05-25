import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../../common/enums/roles.enum';

export class RegisterDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'García' })
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'juan@universidad.edu.co' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener mínimo 8 caracteres' })
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.STUDENT })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
