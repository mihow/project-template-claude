# Claude Configuration & Resources

This directory contains Claude Code configuration, prompts, templates, and tooling for the CTO Sidekick project.

## Directory Structure

```
.claude/
├── README.md                  # This file
├── instructions.md            # Project-specific Claude instructions
├── planning/                  # Planning documents
│   └── meta-agent/           # Meta agent planning
├── prompts/                   # Reusable prompts
│   ├── meta/                 # Meta prompts (orchestration, planning)
│   ├── tasks/                # Task-specific prompts
│   └── verification/         # Verification & review prompts
├── templates/                 # Templates for common files
│   ├── CLAUDE.md            # Latest CLAUDE.md template
│   ├── instructions.md      # Latest instructions.md template
│   └── project-setup/       # Project initialization templates
└── configs/                   # Tool configurations
    ├── mcp/                  # MCP server configs
    ├── skills/               # Claude skills
    └── plugins/              # IDE plugins & extensions
```

## Prompts

### Meta Prompts (`prompts/meta/`)
System-level prompts for orchestration and decision-making:
- Task planning analysis
- Completion verification
- Stuck detection
- Test generation

### Task Prompts (`prompts/tasks/`)
Common task patterns:
- Feature implementation
- Bug fixing
- Refactoring
- Testing
- Documentation

### Verification Prompts (`prompts/verification/`)
Code review and verification:
- PR review
- Security audit
- Performance review
- Test coverage analysis

## Templates

### CLAUDE.md
Global Claude instructions template (lives in `~/.claude/CLAUDE.md`)
- Cost optimization practices
- Development workflows
- Style guidelines
- Tool preferences

### instructions.md
Project-specific instructions (lives in `.claude/instructions.md`)
- Project context
- Architecture decisions
- Coding standards
- Testing requirements

## Configs

### MCP Servers (`configs/mcp/`)
Model Context Protocol server configurations:
- Filesystem server
- GitHub integration
- Database connectors
- Custom APIs

### Skills (`configs/skills/`)
Reusable Claude skills:
- Code review skill
- Test generation skill
- Documentation skill
- Deployment skill

### Plugins (`configs/plugins/`)
IDE and tooling plugins:
- VS Code extensions
- Vim plugins
- Git hooks
- Linters & formatters

## Usage

### Using Prompts

```python
# In code
from pathlib import Path

def load_prompt(name: str) -> str:
    """Load a prompt template."""
    prompt_file = Path(__file__).parent / ".claude" / "prompts" / f"{name}.md"
    return prompt_file.read_text()

# Example
verification_prompt = load_prompt("verification/completion-check")
```

### Using Templates

```bash
# Copy template to new project
cp .claude/templates/CLAUDE.md ~/.claude/CLAUDE.md
cp .claude/templates/instructions.md .claude/instructions.md
```

### Managing Configs

```bash
# Link MCP config
ln -s $(pwd)/.claude/configs/mcp/config.json ~/.claude/mcp.json

# Link skills
ln -s $(pwd)/.claude/configs/skills/* ~/.claude/skills/
```

## Best Practices

1. **Version Control Prompts**: All prompts in git for evolution tracking
2. **Template Updates**: Keep templates up-to-date with latest practices
3. **Config Management**: Standard configs for consistent environments
4. **Documentation**: Document why prompts work and when to use them

## Contributing

When adding new prompts/templates:
1. Add clear description and use case
2. Include example usage
3. Document parameters/variables
4. Test before committing

---

**See Also:**
- [Planning Directory](planning/meta-agent/README.md)
- [Prompt Examples](prompts/README.md)
- [MCP Server Guide](configs/mcp/README.md)
