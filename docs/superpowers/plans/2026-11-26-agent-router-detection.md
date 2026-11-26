# Agent Router Detection Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate installation detection from configuration readiness for Codex and Claude Code.

**Architecture:** A main-process installation helper probes the CLI and macOS Codex bundle. IPC adds an installation flag to profile target snapshots and resolves defaults from the login shell environment. Existing configuration transactions remain responsible for preview, backup, conflict checks and writes.

**Tech Stack:** TypeScript, Electron, React, Vitest.

**Spec:** ../specs/2026-11-26-agent-router-detection.md

## Global Constraints

- Preserve existing unrelated edits and manual configuration selections.
- Reuse shell/process utilities; no new dependencies or Redux shape changes.
- Keep configuration creation available without an installed agent.
- All UI text uses i18next.

## Review Focus

- Residual configuration must not identify an uninstalled agent.
- Wrong CLI version output and timeouts must not identify a usable CLI.
- Binary Info.plist and applications in custom macOS locations must be supported.
- Shell-specific config directories must agree with defaults used for writing.
- Malformed configs and revision conflicts must remain visible and protected.

### Task 1: Installation detection and default paths

**Files:** agentRouter/TargetInstallation.ts and its tests; adapters/CodexDetector.ts, adapters/ClaudeCodeDetector.ts; TargetAdapter.ts; ipc.ts; shared agentRouter/types.ts.

**Interfaces:** `detectTargetInstallation(targetId: 'codex' | 'claude-code'): Promise<boolean>`; `defaultConfigPaths(env?: NodeJS.ProcessEnv): string[]`; `TargetSnapshot.installed?: boolean`.

- [x] Write failing tests for CLI output, lookup failure, Codex bundle identity and login-environment defaults.
- [x] Run focused main tests and confirm failure.
- [x] Implement helper and IPC wiring, retaining manual selection and configuration inspection behavior.
- [x] Run focused main tests and confirm pass.

### Task 2: UI states

**Files:** AgentRouterPage.tsx, TargetStatusCard.tsx, corresponding tests and locale files.

**Interfaces:** Installation chips consume `installed`; configuration bar consumes config detection fields and displays config path plus a preconfiguration notice when installation was not detected.

- [x] Write failing tests for residual config, installed agent without config, malformed config, path and notice.
- [x] Run focused renderer tests and confirm failure.
- [x] Implement independent installation chips and accurate config readiness.
- [x] Run focused renderer tests and confirm pass.

### Task 3: Verification

- [x] Run existing transaction/profile tests for config creation, preservation and conflict protection.
- [x] Run formatting, lint and test commands; report unrelated baseline failures without rewriting unrelated code.
- [x] Review final diff, preserve unrelated edits, report verified results.

## Execution ledger

- 2026-11-26: User approved execution; created branch codex/fix-agent-router-detection in the existing checkout.
- Ruling: Keep existing transaction behavior; installation absence is informational, so preconfiguration continues to work.
- Review: Resolved startup IPC delay by lazily resolving profile paths in router handlers. Explicit user refresh refreshes login environment; normal config watcher refreshes reuse it. Manual selections survive refresh.
- Review: Routine inspection does not reset both file watchers, preserving other targets' pending debounce notifications.
- Verification: Focused main tests 52/52 passed; focused page/status/hook tests 15/15 passed. Typecheck and scoped ESLint passed. pnpm format completed. Full lint is blocked by pre-existing zh-tw missing models.type.price.group_image_to_video (confirmed against HEAD). Full test run reported pre-existing adapter, CodeToolsService, VeryClaw, persistence, landing-page and i18next-mock failures. Full rerun hit a native Windows process exit; bounded rerun recorded separately under .tmp/agent-router-tests-bounded.log.
- Preservation: Original user edits were backed up and retained; an unrelated auto-fix in ModelPricePopover.tsx was reverted.
- Final verification: The renderer's default thread pool also crashed after passing page assertions. Switching only the verification command to `--pool=forks --maxWorkers=1` completed cleanly: 3 files, 15 tests passed, exit 0. No test-runner configuration was changed.
