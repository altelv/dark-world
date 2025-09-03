# TypeScript Scope Patch

This tsconfig narrows the compile scope to your current Vite app and excludes legacy Next/server/game code that causes TS errors.

**Included:**
- `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- `src/components/**`, `src/store/**`, `src/lib/**`, `src/types/**`
- `api/**` (for Vercel serverless)

**Excluded:**
- `src/pages`, `src/server`, `src/game`, `src/store/devBattle.ts`

## Extra manual step (if needed)
If you still import types via an alias in `src/store/game.ts`, replace:
```ts
import type { ChatMessage, PendingPhase, ToUICommand } from '@types/index'
```
with
```ts
import type { ChatMessage, PendingPhase, ToUICommand } from '../types'
```
