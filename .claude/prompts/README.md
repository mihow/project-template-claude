# Claude Prompts Library

Reusable prompts for the CTO Sidekick orchestrator and general development.

## Categories

### Meta Prompts (`meta/`)
Prompts for orchestration and decision-making:
- **task-planning.md**: Analyze if task needs planning
- **completion-verification.md**: Verify task completion
- **stuck-detection.md**: Detect if agent is stuck
- **test-plan-generation.md**: Generate test verification plans

### Task Prompts (`tasks/`)
Common development task patterns:
- **feature-implementation.md**: Implement new feature
- **bug-fix.md**: Fix reported bug
- **refactoring.md**: Refactor code
- **optimization.md**: Performance optimization
- **documentation.md**: Write documentation

### Verification Prompts (`verification/`)
Code review and quality checks:
- **pr-review.md**: Pull request review
- **security-audit.md**: Security vulnerability scan
- **performance-review.md**: Performance analysis
- **test-coverage.md**: Test coverage analysis

## Prompt Format

Each prompt file should follow this structure:

```markdown
# Prompt Title

**Purpose:** What this prompt does
**When to Use:** Scenarios where this prompt applies
**Model:** Recommended model (Sonnet, Haiku, Qwen, etc.)
**Temperature:** Recommended temperature setting

## Variables

- `{variable_name}`: Description of what to fill in

## Prompt

\```
Your actual prompt here with {variables}
\```

## Example

\```
Example of filled-in prompt
\```

## Expected Output

\```json
{
  "field": "expected format"
}
\```

## Notes

Any additional context, tips, or gotchas.
```

## Usage in Code

```python
from pathlib import Path
import re

def load_prompt(prompt_name: str, **variables) -> str:
    """Load and fill prompt template.

    Args:
        prompt_name: Name of prompt file (without .md)
        **variables: Variables to substitute

    Returns:
        Filled prompt string
    """
    prompt_file = Path(".claude/prompts") / f"{prompt_name}.md"

    if not prompt_file.exists():
        raise FileNotFoundError(f"Prompt not found: {prompt_name}")

    content = prompt_file.read_text()

    # Extract prompt section
    prompt_match = re.search(r'## Prompt\s+```\s+(.+?)\s+```', content, re.DOTALL)
    if not prompt_match:
        raise ValueError(f"No prompt section in {prompt_name}")

    prompt = prompt_match.group(1)

    # Fill variables
    for key, value in variables.items():
        prompt = prompt.replace(f"{{{key}}}", str(value))

    return prompt


# Example usage
from src.llm_providers import QwenProvider

provider = QwenProvider()
prompt = load_prompt(
    "meta/task-planning",
    task_description="Add OAuth2 authentication",
    project_name="API Server"
)
response = provider.complete(prompt)
```

## Guidelines

### Writing Good Prompts

1. **Be Specific**: Clear instructions and expectations
2. **Use Examples**: Show desired output format
3. **Set Context**: Provide relevant background
4. **Request Structure**: Ask for JSON/markdown for parsing
5. **Set Tone**: "You are a senior developer..." sets expertise level

### Prompt Engineering Tips

- **Chain of Thought**: Ask for reasoning before conclusion
- **Few-Shot**: Include 1-3 examples
- **Temperature**: 0.2 for deterministic, 0.7 for creative
- **Length**: Shorter prompts for simple tasks, detailed for complex
- **Testing**: Test with multiple scenarios before saving

### Variable Naming

Use clear, descriptive variable names:
- `{task_description}` not `{task}`
- `{git_diff}` not `{diff}`
- `{project_name}` not `{proj}`

## Prompt Versioning

When updating prompts:
1. Test new version thoroughly
2. Keep old version as `prompt-name-v1.md` if major change
3. Document changes in prompt file
4. Update references in code

## Quick Reference

| Prompt | Purpose | Model | Temp |
|--------|---------|-------|------|
| meta/task-planning | Decide if planning needed | Sonnet | 0.3 |
| meta/completion-verification | Verify work complete | Haiku | 0.2 |
| meta/stuck-detection | Detect stuck agent | Qwen | 0.3 |
| tasks/bug-fix | Fix bug workflow | Sonnet | 0.4 |
| verification/pr-review | Review PR | Sonnet | 0.3 |

---

**See Also:**
- [LLM Task Verification Plan](../planning/meta-agent/features/llm-task-verification.md)
- [Prompt Templates](../templates/)
