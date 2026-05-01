import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@gestorprint.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'admin123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  password: string;
}
