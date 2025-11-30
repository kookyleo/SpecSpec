// src/context.ts
// 验证上下文 - 收集问题，跟踪路径

export interface Issue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  path: string[];
}

export interface Context {
  /** 当前验证路径 */
  readonly path: string[];

  /** 收集的问题列表 */
  readonly issues: Issue[];

  /** 当前验证的值 */
  readonly value: unknown;

  /** 报告错误 */
  addIssue(code: string, message: string): void;

  /** 报告警告 */
  addWarning(code: string, message: string): void;

  /** 创建子上下文 */
  child(segment: string, value: unknown): Context;
}

export class ValidationContext implements Context {
  readonly issues: Issue[] = [];

  constructor(
    readonly path: string[],
    readonly value: unknown,
    private readonly root?: ValidationContext
  ) {}

  addIssue(code: string, message: string): void {
    const target = this.root ?? this;
    target.issues.push({
      level: 'error',
      code,
      message,
      path: [...this.path],
    });
  }

  addWarning(code: string, message: string): void {
    const target = this.root ?? this;
    target.issues.push({
      level: 'warning',
      code,
      message,
      path: [...this.path],
    });
  }

  child(segment: string, value: unknown): Context {
    return new ValidationContext(
      [...this.path, segment],
      value,
      this.root ?? this
    );
  }
}
