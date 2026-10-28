# AGENTS INSTRUCTIONS

All AI agents working in this repository must strictly adhere to [ai_context_guide.md](file:///Users/a69/Desktop/goro-s2jb/ai_context_guide.md).

## Mandatory Context Locations
1. **`docs/`**: Project requirements, PRD ([docs/PRD.md](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md)), reference spreadsheets ([docs/GORO S2JB 2026 (Jawaban).xlsx](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx)), business logic, and technical architecture.
2. **`.agents/skills/`**: Agent behavior, engineering standards, and specific operational workflows (OCR, spreadsheet parsing, UI design, TDD, bug diagnosis).

Before designing solutions or generating code, always read the relevant files in these two directories first.

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read `.agents/skills/antislop/SKILL.md` (core) and then the skill for the task:
- UI / visual: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `.agents/skills/antislop-copywriting/SKILL.md`
- People: `.agents/skills/antislop-human/SKILL.md`
- Mobile / responsive: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `.agents/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: download `antislop.md` again, or run `npx antislop-ai --update` if it was installed as skill folders.
<!-- antislop:end -->
