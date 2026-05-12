# Plan: Adopt Spec-Kit Methodology for Space Sentinel

## Goal
Adopt Spec-Kit's structured spec-driven development methodology without installing its CLI tool, by creating a repo-specific planning skill that bakes in Space Sentinel conventions.

## Decision Rationale
- Spec-Kit CLI requires Python/uv dependency + Hermes Agent not in its 30+ supported integrations
- Our existing Hermes skill system is better suited to our workflow
- Adopt the methodology (structured specs, acceptance criteria, edge cases) without the tooling overhead

## What Was Done
Created repo-specific planning skill at `.hermes/skills/space-sentinel-planning/SKILL.md`

The skill encodes:
- Full project architecture (engine layout, mission types, state flow)
- Implementation patterns (14-step mission checklist, system module pattern)
- Validation commands (`npm test -- --run`, `npm run build`)
- Conventions (no React in engine/, explicit params, delta time units)
- Common pitfalls (mutual reset, dev mode wiring, sound memory leaks)
- Verification checklist

## Future Workflow
When planning new features:
1. Load `space-sentinel-planning` skill (auto-loaded from repo)
2. Follow its implementation patterns for the feature type
3. Use its validation commands to verify
4. Check its verification checklist before committing

## No Further Action Needed
- No CLI installation required
- No Python dependency
- Skill is committed with the repo, available to all future AI sessions
