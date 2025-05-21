# nestjs-kitchen

[![CodeQL](https://github.com/yikenman/nestjs-kitchen/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/yikenman/nestjs-kitchen/actions/workflows/github-code-scanning/codeql)
[![Dependabot Updates](https://github.com/yikenman/nestjs-kitchen/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/yikenman/nestjs-kitchen/actions/workflows/dependabot/dependabot-updates)
[![reviewdog](https://github.com/yikenman/nestjs-kitchen/actions/workflows/lint.yml/badge.svg)](https://github.com/yikenman/nestjs-kitchen/actions/workflows/lint.yml)
[![Test](https://github.com/yikenman/nestjs-kitchen/actions/workflows/test.yml/badge.svg)](https://github.com/yikenman/nestjs-kitchen/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS)](https://codecov.io/gh/yikenman/nestjs-kitchen)
[![Release](https://github.com/yikenman/nestjs-kitchen/actions/workflows/release.yml/badge.svg)](https://github.com/yikenman/nestjs-kitchen/actions/workflows/release.yml)

Convenient tools to serve your NextJS application.

---

## Description

`nestjs-kitchen` is a collection of packages offering convenient features to accelerate your NestJS application development.

## Packages

| Status | Package                                | Description                                                   |
|--------|----------------------------------------|---------------------------------------------------------------|
| ✅     | [`@nestjs-kitchen/authz`](./packages/authz/README.md) | Simplest authentication & authorization module in NextJS.     |
| ✅     | [`@nestjs-kitchen/connextion`](./packages/connextion/README.md) | A module builder of generic instance management in NextJS.   |
| ✅     | [`@nestjs-kitchen/connextion-postgres`](./packages/connextion-postgres/README.md) | A flexible module to provide [node-postgres](https://node-postgres.com/) interface in NextJS.   |
| ✅     | [`@nestjs-kitchen/connextion-presto`](./packages/connextion-presto/README.md) | A flexible module to provide [presto-client](https://www.npmjs.com/package/presto-client) interface in NextJS.   |
| ✅     | [`@nestjs-kitchen/connextion-duckdb`](./packages/connextion-duckdb/README.md) | A flexible module to provide [@duckdb/node-api](https://www.npmjs.com/package/@duckdb/node-api) interface in NextJS.   |
| ✅     | [`@nestjs-kitchen/cache-manager`](./packages/cache-manager/README.md)                | A better caching module for NestJS, fully compatible with [@nestjs/cache-manager](https://www.npmjs.com/package/@nestjs/cache-manager) v3.                    |
| ✅     | [`@nestjs-kitchen/csrf`](./packages/csrf/README.md) | A CSRF module in NextJS.   |