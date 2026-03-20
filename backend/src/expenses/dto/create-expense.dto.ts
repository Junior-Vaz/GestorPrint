import { IsString, IsNumber, IsOptional, IsISO8601, Length, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @Length(1, 255)
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @Length(1, 100)
  category: string;

  @IsISO8601()
  @IsOptional()
  date?: string;
}
