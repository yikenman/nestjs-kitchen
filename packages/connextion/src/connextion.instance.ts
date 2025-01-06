import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export abstract class ConnextionInstance<O> implements OnModuleInit, OnModuleDestroy {
  name: string;
  private options: O | undefined;

  constructor(name: string, options?: O) {
    this.name = name;
    this.options = options;
  }

  onModuleInit() {
    if (this.options) {
      const options = this.options;
      this.options = undefined;
      this.create(options);
    }
  }

  onModuleDestroy() {
    return this.dispose();
  }

  abstract dispose(): any;

  abstract create(options: O): any;
}
