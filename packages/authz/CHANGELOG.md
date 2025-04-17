# @nestjs-kitchen/authz

## 2.0.6

### Patch Changes

- 4f5c35b: fix: can create global module together with normal module

## 2.0.5

### Patch Changes

- 545fba8: feat: support accessing request object in authenticate.

## 2.0.4

### Patch Changes

- cad23b8: chore: use tsc & remove tsup

## 2.0.3

### Patch Changes

- 671632a: chore: enable isolatedModules
- 671632a: chore: bump deps version & fix babel cve

## 2.0.2

### Patch Changes

- e7005df: chore: bump deps version

## 2.0.1

### Patch Changes

- a8572ee: chore: Compatible with NestJS v10,v11

## 2.0.0

### Major Changes

- d4b9303: bump NestJS to v11

## 1.1.3

### Patch Changes

- c6fa893: bump esbuild version

## 1.1.2

### Patch Changes

- 6f1e250: fix CVE-2024-45296
- 6f1e250: correct peer deps

## 1.1.1

### Patch Changes

- fc050c3: fix: ts2742

## 1.1.0

### Minor Changes

- 6d7a6dc: fix: correct default behaviour of UseGuard(AuthzGuard)

### Patch Changes

- 60d98e3: test: export AuthzAnonymousError
- cd50b67: docs: readme & examples
- 469180c: docs: add jsdoc
- e863e18: test: fix test mock
- b2bf06d: test: update AuthzGuard usage
- 51aff7f: feat: export AuthzAnonymousError

## 1.0.0

### Major Changes

- c49daf9: Release first authz module.

        - Support JWT authentication & authorization
        - Support Session authentication & authorization
        - Allow registering multiple/duplicate modules
        - Support anonymous visit
