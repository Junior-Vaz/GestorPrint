/**
 * Result<T> — evita throw/catch no domínio.
 * Camada de domínio retorna sucesso ou falha de forma explícita.
 */
export class Result<T> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: string,
  ) {}

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  get value(): T {
    if (!this._isSuccess) {
      throw new Error('Não é possível obter valor de um Result de falha.');
    }
    return this._value as T;
  }

  get error(): string {
    if (this._isSuccess) {
      throw new Error('Não é possível obter erro de um Result de sucesso.');
    }
    return this._error as string;
  }

  static ok<T>(value?: T): Result<T> {
    return new Result<T>(true, value);
  }

  static fail<T>(error: string): Result<T> {
    return new Result<T>(false, undefined, error);
  }
}
