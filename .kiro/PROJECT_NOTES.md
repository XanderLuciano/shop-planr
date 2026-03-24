# Shop Planr (shop-erp)

**Created**: 2026-03-14  
**Last Updated**: 2026-03-14

## Project Overview

Shop Planr — a workshop planning and ERP application for managing shop operations.

## Tech Stack

- **Framework**: Nuxt 4 / Vue
- **UI Library**: Nuxt UI 4
- **Language**: TypeScript
- **Testing**: Vitest
- **Linting**: ESLint

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run linter
npm run typecheck  # Type checking
npm run test       # Run tests
```

## Deployment

```bash
npm run build
docker build -t shop-erp .
docker-compose up -d
```

Or use the deploy script: `./deploy.sh` (configure server details first).

## Kiro Powers

### nuxtui-components
Complete reference guide for NuxtUI 4.3.0 components.

## Resources

- [Nuxt Documentation](https://nuxt.com/)
- [Nuxt UI Documentation](https://ui.nuxt.com/)

---

**Project Status**: Active Development
