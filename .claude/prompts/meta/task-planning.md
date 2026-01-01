# Task Planning Analysis Prompt

**Purpose:** Determine if a task needs detailed planning before execution
**When to Use:** Before starting work on any new task
**Model:** Claude Sonnet (or Qwen for cost savings)
**Temperature:** 0.3

## Variables

- `{task_description}`: The "Next Action" from priority list
- `{project_name}`: Name of the project
- `{project_context}`: Optional context about project (tech stack, etc.)

## Prompt

```
You are a senior development manager reviewing a new task for a development project.

Task: "{task_description}"
Project: "{project_name}"
Context: {project_context}

Based on this task description, analyze and determine:

1. **Planning Requirement**: Does this task need a detailed implementation plan before starting?
   - Consider: architectural impact, security implications, multi-file changes, complexity
   - YES if: affects multiple systems, requires design decisions, has security/performance implications
   - NO if: simple fix, clear implementation, single file change, trivial update

2. **Complexity Level**: Rate the task complexity
   - trivial: Typo fix, simple config change
   - simple: Single function/file, clear approach
   - moderate: Multiple files, some design needed
   - complex: Architectural changes, multiple systems
   - very-complex: Major refactoring, new subsystems

3. **Implementation Estimate**:
   - Estimated lines of code to add/change
   - Estimated time (minutes/hours)
   - Risk level (low/medium/high)

4. **Recommended Approach**: High-level strategy for implementation

Respond in JSON format:
{
  "needs_planning": true | false,
  "complexity": "trivial" | "simple" | "moderate" | "complex" | "very-complex",
  "reasoning": "1-2 sentence explanation of your decision",
  "estimated_loc": 50,
  "estimated_time": "2 hours",
  "risk_level": "low" | "medium" | "high",
  "suggested_approach": "Brief description of recommended implementation strategy",
  "key_considerations": ["consideration 1", "consideration 2", ...]
}
```

## Example

Task: "Add OAuth2 authentication to the API"

```
You are a senior development manager reviewing a new task for a development project.

Task: "Add OAuth2 authentication to the API"
Project: "REST API Server"
Context: Node.js/Express API, currently using basic auth, 50K active users

[Full prompt...]
```

## Expected Output

```json
{
  "needs_planning": true,
  "complexity": "complex",
  "reasoning": "OAuth2 requires security-critical implementation, token management, multiple endpoints, and proper state handling. High risk if done incorrectly.",
  "estimated_loc": 500,
  "estimated_time": "8-12 hours",
  "risk_level": "high",
  "suggested_approach": "Use proven OAuth2 library (passport.js), implement authorization code flow, add token storage, update auth middleware, add comprehensive tests",
  "key_considerations": [
    "Security: Token storage, CSRF protection, secure redirect URIs",
    "Testing: Auth flow, token refresh, error scenarios",
    "Migration: Existing users need smooth transition from basic auth",
    "Documentation: Update API docs with OAuth2 flow"
  ]
}
```

## Notes

- Err on the side of planning for anything security-related
- Consider if task affects multiple teams/systems
- Account for testing requirements in complexity
- "Estimated time" should assume experienced developer
- Use "very-complex" sparingly (major architectural changes only)

## Decision Logic

**Needs Planning = TRUE if:**
- Security-critical changes
- Affects multiple systems/services
- Requires design decisions
- Risk level = high
- Complexity >= complex
- No clear implementation path
- Potential for multiple valid approaches

**Needs Planning = FALSE if:**
- Single file, clear change
- Low risk
- Trivial or simple complexity
- Well-defined approach
- Similar to previous work
