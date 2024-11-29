import type { DynamicModule } from '@nestjs/common';

export const mergeDynamicModuleConfigs = (...configs: Partial<DynamicModule>[]) => {
  const merged = configs.reduce<Partial<DynamicModule>>(
    (acc, curr) => ({
      global: acc?.global || curr?.global,
      module: acc?.module || curr?.module,
      imports: [...(acc?.imports || []), ...(curr?.imports || [])],
      controllers: [...(acc?.controllers || []), ...(curr?.controllers || [])],
      providers: [...(acc?.providers || []), ...(curr?.providers || [])],
      exports: [...(acc?.exports || []), ...(curr?.exports || [])]
    }),
    {}
  );

  return merged as DynamicModule;
};
