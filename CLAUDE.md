# Project: Quikwap

WhatsApp Business automation SaaS for Indian SMBs.
Real estate agents are the primary customer segment.
B2B subscription product using the official WhatsApp Business API.

## Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS — lives in apps/web
- Backend: Node.js + Express + TypeScript — lives in apps/api
- Database: Supabase (Postgres + Auth + Row-Level Security)
- WhatsApp API: Twilio in Phase 1, accessed only through packages/bsp-adapter
- Tests: vitest
- Package manager: pnpm with workspaces

## Hard rules — never break these
- All WhatsApp API calls must go through packages/bsp-adapter. Never import the Twilio SDK directly anywhere in apps/api.
- All database writes must go through files inside apps/api/src/db/queries/. No direct supabase.from() calls outside that folder.
- Never edit .env, .env.local, or any file inside supabase/migrations/applied/.
- Never use console.log in committed code. Use src/lib/logger.ts instead.
- All money values stored as integer paise (100 paise = 1 rupee). Never floats.
- All phone numbers stored in E.164 format. Example: +919876543210.

## Workflow
- For any non-trivial work: enter plan mode first (press Shift+Tab twice).
  Write the plan to tasks/plan-FEATURENAME.md. Wait for approval before editing any code.
- After building anything, run: pnpm test && pnpm lint && pnpm typecheck.
  All three must pass before you say the task is done.
- Test WhatsApp flows using the MockBspAdapter, not real Twilio.

## Code conventions
- Named exports only. No default exports anywhere.
- Test files go in __tests__/ folder next to the source file.
- TypeScript: always use unknown and narrow with type guards. Never use any.
- React: function components only. No class components.
- File names: kebab-case. Exception: React component files use PascalCase.

## Failure log
Add one line every time I correct a mistake you made.
Format: YYYY-MM-DD: description of what went wrong.