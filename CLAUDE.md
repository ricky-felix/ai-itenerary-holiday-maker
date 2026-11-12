@AGENTS.md

# AI Itinerary Holiday Maker

A web app where a user enters a destination, travel dates, budget and interests, and Claude produces a day-by-day holiday itinerary that can be exported as a PDF or shared via a link.

## Stack

- Next.js 16 (App Router, `src/` dir, Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (components in `src/components/ui/`, `cn()` helper from the `cn` package via `src/lib/utils.ts`)
- Claude via `@anthropic-ai/sdk` — client and model ID live in `src/lib/anthropic.ts`
- `zod` for validating form input and the model's structured output
- `@react-pdf/renderer` for PDF export, `nanoid` for share-link IDs

## Commands

- `npm run dev` — dev server at http://localhost:3000
- `npm run build` — production build (run before calling work done)
- `npm run lint` — ESLint

## Scope (v1)

In: itinerary generator, PDF export, share links.
Out for now: user accounts, database, maps. Ask before adding any of these. Share links will need some storage, so raise the storage choice with the user before building them.

## Conventions

- **Claude calls are server-only.** Only import `src/lib/anthropic.ts` from route handlers or server code (it imports `server-only`). Never expose `ANTHROPIC_API_KEY` to the client or prefix it with `NEXT_PUBLIC_`.
- Use the `ITINERARY_MODEL` constant rather than hard-coding model IDs.
- Get itineraries back as structured output validated with a zod schema, not free text that gets parsed afterwards. Check `stop_reason` before reading content.
- Stream long generations so the UI can show progress instead of a long blank wait.
- Add UI building blocks with `npx shadcn@latest add <component>` instead of hand-writing them.
- Secrets go in `.env.local` (gitignored); keep `.env.example` updated when adding new variables.

## Project skills

- `/tutor` — explain-only teaching mode (`.claude/skills/tutor/`). When active, explain concepts and do not write or edit code.
