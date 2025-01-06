# @nestjs-kitchen/connextion

[![NPM Version](https://img.shields.io/npm/v/%40nestjs-kitchen%2Fconnextion)
](https://www.npmjs.com/package/@nestjs-kitchen/connextion)
![NPM License](https://img.shields.io/npm/l/%40nestjs-kitchen%2Fconnextion)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS&flag=@nestjs-kitchen/connextion)](https://codecov.io/gh/yikenman/nestjs-kitchen)

A module builder of generic instance management in NextJS.

---

## Install

```bash
$ npm install --save @nestjs-kitchen/connextion
```

## Usage

```typescript
import { defineConnextionBuilder, ConnextionInstance } from '@nestjs-kitchen/connextion';

class CustomInstance extends ConnextionInstance<{}> {
    // ...
}

const defineCustomInstanceManager = defineConnextionBuilder({
  connextionName: 'CustomInstanceManager',
  InstanceClass: CustomInstance,
});

const { 
  // Services for injection to manage CustomInstances.
  CustomInstanceManager, 
  // Module for registering instances .
  CustomInstanceManagerModule 
} = defineCustomInstanceManager();
```

## License

MIT License