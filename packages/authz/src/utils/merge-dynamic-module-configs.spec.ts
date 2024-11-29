import type { DynamicModule } from '@nestjs/common';
import { mergeDynamicModuleConfigs } from './merge-dynamic-module-configs';

describe('Merge dynamic module configs', () => {
  const ModuleA: any = 'ModuleA';
  const ImportA: any = 'ImportA';
  const ControllerA: any = 'ControllerA';
  const ProviderA: any = 'ProviderA';
  const ExportA: any = 'ExportA';

  const ModuleB: any = 'ModuleB';
  const ImportB: any = 'ImportB';
  const ControllerB: any = 'ControllerB';
  const ProviderB: any = 'ProviderB';
  const ExportB: any = 'ExportB';

  it('should merge two DynamicModule configs, giving precedence to the first config', () => {
    const configA: Partial<DynamicModule> = {
      global: true,
      module: ModuleA,
      imports: [ImportA],
      controllers: [ControllerA],
      providers: [ProviderA],
      exports: [ExportA]
    };

    const configB: Partial<DynamicModule> = {
      global: false,
      module: ModuleB,
      imports: [ImportB],
      controllers: [ControllerB],
      providers: [ProviderB],
      exports: [ExportB]
    };

    const mergedConfig = mergeDynamicModuleConfigs(configA, configB);

    expect(mergedConfig).toEqual({
      global: true,
      module: ModuleA,
      imports: [ImportA, ImportB],
      controllers: [ControllerA, ControllerB],
      providers: [ProviderA, ProviderB],
      exports: [ExportA, ExportB]
    });
  });

  it('should handle undefined values gracefully', () => {
    const configA: Partial<DynamicModule> = {
      module: ModuleA,
      imports: [ImportA]
    };

    const mergedConfig = mergeDynamicModuleConfigs(configA, undefined as never);

    expect(mergedConfig).toEqual({
      module: ModuleA,
      imports: [ImportA],
      controllers: [],
      providers: [],
      exports: []
    });
  });

  it('should return an empty config when both inputs are undefined', () => {
    const mergedConfig = mergeDynamicModuleConfigs(undefined as never, undefined as never);

    expect(mergedConfig).toEqual({
      global: undefined,
      module: undefined,
      imports: [],
      controllers: [],
      providers: [],
      exports: []
    });
  });
});
