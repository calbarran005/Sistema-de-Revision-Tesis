import { IsString, IsNotEmpty, MaxLength, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  content: string;
}

export class AskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  // Historial reciente de la conversación (opcional) para dar continuidad
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}

export class TtsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;
}
