# LLM-Driven Task Verification & Decision Making

**Status:** Planning
**Priority:** High
**Estimated Effort:** 8-12 hours

## Problem

Currently, the orchestrator is **deterministic** - it just follows priorities. But we need **intelligent decision making**:

- ❌ When a new task appears, should it be planned first or just executed?
- ❌ When a task is marked "Completed", is it actually done?
- ❌ How do we verify work before human review?
- ❌ Should we run tests? What tests? How to verify E2E?
- ❌ Can we detect when Claude got stuck or produced bad output?

**Goal:** Add LLM-powered decision layer that analyzes tasks, verifies completion, and suggests next actions.

## Use Cases

### 1. Task Planning Decision

**Scenario:** New task appears in priority list

**LLM Prompt:**
```
You are a senior development manager reviewing a new task.

Task: "{next_action}"
Project: "{project_name}"

Based on this task description, determine:
1. Does this need a detailed plan before starting? (yes/no)
2. Why or why not?
3. What complexity level? (trivial/simple/moderate/complex/very-complex)
4. Estimated lines of code to change?
5. Should we create a plan file first?

Respond in JSON:
{
  "needs_planning": true/false,
  "complexity": "simple",
  "reasoning": "...",
  "estimated_loc": 50,
  "suggested_approach": "..."
}
```

**Decision Flow:**
```
New task → LLM analyzes →
  ├─ needs_planning=true → Create plan, wait for approval
  └─ needs_planning=false → Start work directly
```

### 2. Completion Verification

**Scenario:** Claude marks task as complete

**LLM Prompt:**
```
You are reviewing completed development work.

Task: "{task_description}"
Project: "{project_name}"

Claude reports: "Task completed"

Git diff:
```
{git_diff}
```

Test results:
```
{test_output}
```

Determine:
1. Is the task actually complete? (yes/no/partially)
2. Are there obvious bugs or issues?
3. What verification steps should we run?
4. Should this be marked as "Completed" or "Needs Review"?
5. What should human reviewer check?

Respond in JSON:
{
  "actually_complete": true/false,
  "confidence": 0.85,
  "issues_found": ["...", "..."],
  "suggested_tests": ["...", "..."],
  "recommended_status": "Completed" | "Needs Review" | "Incomplete",
  "review_checklist": ["...", "..."]
}
```

### 3. Test Strategy Generation

**Scenario:** Task completed, need to verify

**LLM Prompt:**
```
Generate a test verification plan for completed work.

Task: "{task_description}"
Files changed: {files_changed}
Git diff summary: {diff_summary}

What tests should we run to verify this is correct?
Consider:
- Unit tests needed
- Integration tests needed
- E2E tests needed
- Manual verification steps
- Edge cases to check

Respond in JSON:
{
  "automated_tests": {
    "unit": ["test command 1", "test command 2"],
    "integration": ["..."],
    "e2e": ["..."]
  },
  "manual_checks": ["...", "..."],
  "edge_cases": ["...", "..."],
  "verification_script": "#!/bin/bash\n..."
}
```

### 4. Stuck Detection

**Scenario:** Claude has been working for >1 hour with no commits

**LLM Prompt:**
```
Analyze whether Claude might be stuck.

Task: "{task_description}"
Time elapsed: {elapsed_minutes} minutes
Last git activity: {last_commit_time}
Recent tmux output:
```
{last_100_lines_of_output}
```

Is Claude:
1. Making progress? (yes/no/unclear)
2. Stuck in a loop?
3. Waiting for input?
4. Working on something wrong?

Recommend action:
- Continue (still making progress)
- Interrupt (provide guidance)
- Restart (completely stuck)

Respond in JSON:
{
  "status": "progressing" | "stuck" | "unclear",
  "confidence": 0.9,
  "evidence": "...",
  "recommendation": "continue" | "interrupt" | "restart",
  "suggested_prompt": "..." (if interrupt)
}
```

## Architecture

### New Module: `src/llm_decision.py`

```python
"""LLM-powered decision making for orchestrator."""

import json
import logging
from typing import Optional, Literal
from dataclasses import dataclass
from pathlib import Path

from src.models import Project, ProjectStatus
from src.llm_providers import LLMProvider, ClaudeProvider, QwenProvider

logger = logging.getLogger(__name__)


@dataclass
class PlanningDecision:
    """Result of task planning analysis."""
    needs_planning: bool
    complexity: Literal["trivial", "simple", "moderate", "complex", "very-complex"]
    reasoning: str
    estimated_loc: int
    suggested_approach: str


@dataclass
class CompletionVerification:
    """Result of completion verification."""
    actually_complete: bool
    confidence: float
    issues_found: list[str]
    suggested_tests: list[str]
    recommended_status: ProjectStatus
    review_checklist: list[str]


@dataclass
class StuckDetection:
    """Result of stuck detection analysis."""
    status: Literal["progressing", "stuck", "unclear"]
    confidence: float
    evidence: str
    recommendation: Literal["continue", "interrupt", "restart"]
    suggested_prompt: Optional[str]


class LLMDecisionMaker:
    """Makes intelligent decisions about task management."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    def analyze_task_for_planning(self, project: Project) -> PlanningDecision:
        """Determine if task needs planning before execution.

        Args:
            project: Project with next_action to analyze

        Returns:
            PlanningDecision with recommendation
        """
        prompt = f"""You are a senior development manager reviewing a new task.

Task: "{project.next_action}"
Project: "{project.name}"

Based on this task description, determine:
1. Does this need a detailed plan before starting? (yes/no)
2. Why or why not?
3. What complexity level? (trivial/simple/moderate/complex/very-complex)
4. Estimated lines of code to change?
5. Should we create a plan file first?

Respond in JSON:
{{
  "needs_planning": true/false,
  "complexity": "simple",
  "reasoning": "...",
  "estimated_loc": 50,
  "suggested_approach": "..."
}}"""

        response = self.provider.complete(prompt, temperature=0.3)
        result = json.loads(response)

        return PlanningDecision(
            needs_planning=result["needs_planning"],
            complexity=result["complexity"],
            reasoning=result["reasoning"],
            estimated_loc=result["estimated_loc"],
            suggested_approach=result["suggested_approach"]
        )

    def verify_completion(
        self,
        project: Project,
        git_diff: str,
        test_output: str
    ) -> CompletionVerification:
        """Verify if a task is actually complete.

        Args:
            project: Completed project
            git_diff: Git diff of changes
            test_output: Test execution output

        Returns:
            CompletionVerification with recommendation
        """
        prompt = f"""You are reviewing completed development work.

Task: "{project.next_action}"
Project: "{project.name}"

Claude reports: "Task completed"

Git diff:
```
{git_diff[:5000]}  # Limit size
```

Test results:
```
{test_output[:2000]}
```

Determine:
1. Is the task actually complete? (yes/no/partially)
2. Are there obvious bugs or issues?
3. What verification steps should we run?
4. Should this be marked as "Completed" or "Needs Review"?
5. What should human reviewer check?

Respond in JSON:
{{
  "actually_complete": true/false,
  "confidence": 0.85,
  "issues_found": ["...", "..."],
  "suggested_tests": ["...", "..."],
  "recommended_status": "Completed" | "Needs Review" | "Incomplete",
  "review_checklist": ["...", "..."]
}}"""

        response = self.provider.complete(prompt, temperature=0.2)
        result = json.loads(response)

        return CompletionVerification(
            actually_complete=result["actually_complete"],
            confidence=result["confidence"],
            issues_found=result["issues_found"],
            suggested_tests=result["suggested_tests"],
            recommended_status=ProjectStatus(result["recommended_status"]),
            review_checklist=result["review_checklist"]
        )

    def detect_stuck(
        self,
        project: Project,
        elapsed_minutes: int,
        last_commit_time: str,
        recent_output: str
    ) -> StuckDetection:
        """Detect if agent is stuck and recommend action.

        Args:
            project: Current project
            elapsed_minutes: Time since task started
            last_commit_time: Time of last git activity
            recent_output: Recent tmux output

        Returns:
            StuckDetection with recommendation
        """
        prompt = f"""Analyze whether Claude might be stuck.

Task: "{project.next_action}"
Time elapsed: {elapsed_minutes} minutes
Last git activity: {last_commit_time}
Recent tmux output:
```
{recent_output[-2000:]}  # Last 2000 chars
```

Is Claude:
1. Making progress? (yes/no/unclear)
2. Stuck in a loop?
3. Waiting for input?
4. Working on something wrong?

Recommend action:
- Continue (still making progress)
- Interrupt (provide guidance)
- Restart (completely stuck)

Respond in JSON:
{{
  "status": "progressing" | "stuck" | "unclear",
  "confidence": 0.9,
  "evidence": "...",
  "recommendation": "continue" | "interrupt" | "restart",
  "suggested_prompt": "..." (if interrupt)
}}"""

        response = self.provider.complete(prompt, temperature=0.3)
        result = json.loads(response)

        return StuckDetection(
            status=result["status"],
            confidence=result["confidence"],
            evidence=result["evidence"],
            recommendation=result["recommendation"],
            suggested_prompt=result.get("suggested_prompt")
        )

    def generate_test_plan(
        self,
        project: Project,
        files_changed: list[str],
        diff_summary: str
    ) -> dict:
        """Generate test verification plan.

        Args:
            project: Completed project
            files_changed: List of modified files
            diff_summary: Summary of changes

        Returns:
            Test plan dict
        """
        prompt = f"""Generate a test verification plan for completed work.

Task: "{project.next_action}"
Files changed: {', '.join(files_changed)}
Git diff summary: {diff_summary}

What tests should we run to verify this is correct?
Consider:
- Unit tests needed
- Integration tests needed
- E2E tests needed
- Manual verification steps
- Edge cases to check

Respond in JSON:
{{
  "automated_tests": {{
    "unit": ["test command 1", "test command 2"],
    "integration": ["..."],
    "e2e": ["..."]
  }},
  "manual_checks": ["...", "..."],
  "edge_cases": ["...", "..."],
  "verification_script": "#!/bin/bash\\n..."
}}"""

        response = self.provider.complete(prompt, temperature=0.4)
        return json.loads(response)
```

### LLM Provider Interface

```python
# src/llm_providers.py

from abc import ABC, abstractmethod
from typing import Optional


class LLMProvider(ABC):
    """Abstract interface for LLM providers."""

    @abstractmethod
    def complete(self, prompt: str, temperature: float = 0.5) -> str:
        """Get completion from LLM."""
        pass


class ClaudeProvider(LLMProvider):
    """Claude API provider for decision making."""

    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key
        self.model = model

    def complete(self, prompt: str, temperature: float = 0.5) -> str:
        import anthropic

        client = anthropic.Anthropic(api_key=self.api_key)
        response = client.messages.create(
            model=self.model,
            max_tokens=2000,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text


class QwenProvider(LLMProvider):
    """Local Qwen provider for decision making."""

    def __init__(self, endpoint: str = "http://localhost:11434"):
        self.endpoint = endpoint

    def complete(self, prompt: str, temperature: float = 0.5) -> str:
        import requests

        response = requests.post(
            f"{self.endpoint}/api/generate",
            json={
                "model": "qwen2.5-coder:32b",
                "prompt": prompt,
                "temperature": temperature,
                "stream": False
            }
        )
        return response.json()["response"]
```

## Integration with Orchestrator

### Updated Daemon with LLM Decisions

```python
# src/daemon.py additions

from src.llm_decision import LLMDecisionMaker
from src.llm_providers import QwenProvider, ClaudeProvider


class CTOSidekick:
    def __init__(self, config: Config):
        # ... existing ...

        # LLM decision maker
        if config.get('llm_decisions.enabled'):
            provider_type = config.get('llm_decisions.provider')
            if provider_type == 'claude':
                provider = ClaudeProvider(api_key=config.get('llm_decisions.claude.api_key'))
            else:
                provider = QwenProvider(endpoint=config.get('llm_decisions.qwen.endpoint'))

            self.llm = LLMDecisionMaker(provider)
        else:
            self.llm = None

    def _iteration(self):
        """Main loop iteration with LLM decisions."""

        # ... existing project fetching ...

        # Before starting work, check if needs planning
        if self.llm and next_project:
            decision = self.llm.analyze_task_for_planning(next_project)

            if decision.needs_planning:
                logger.info(f"LLM recommends planning for {next_project.name}")
                logger.info(f"Complexity: {decision.complexity}")
                logger.info(f"Reasoning: {decision.reasoning}")

                # Create plan file
                self._create_plan_file(next_project, decision)

                # Update status to "Planning"
                self.sheets.update_project_status(
                    next_project.name,
                    ProjectStatus.PENDING,  # or new PLANNING status
                    agent="Awaiting Plan Approval"
                )

                # Don't start work yet
                return

        # ... existing start work logic ...

    def _verify_completion(self, project: Project):
        """Verify task completion with LLM."""
        if not self.llm:
            return True  # No verification

        # Get git diff
        git_diff = subprocess.run(
            ["git", "diff", "HEAD~1", "HEAD"],
            cwd=project.directory,
            capture_output=True,
            text=True
        ).stdout

        # Run tests
        test_output = subprocess.run(
            ["./run_tests.sh"],
            cwd=project.directory,
            capture_output=True,
            text=True
        ).stdout

        # Verify with LLM
        verification = self.llm.verify_completion(project, git_diff, test_output)

        logger.info(f"LLM verification for {project.name}:")
        logger.info(f"  Actually complete: {verification.actually_complete}")
        logger.info(f"  Confidence: {verification.confidence}")
        logger.info(f"  Issues: {verification.issues_found}")

        if not verification.actually_complete:
            logger.warning(f"LLM says task not complete. Issues: {verification.issues_found}")
            return False

        if verification.confidence < 0.7:
            logger.warning(f"Low confidence ({verification.confidence}) in completion")

        # Create review file for human
        self._create_review_file(project, verification)

        return verification.actually_complete
```

## Workflow Examples

### Example 1: New Complex Task

```
1. New task appears: "Add OAuth2 authentication to API"
2. LLM analyzes:
   - needs_planning: true
   - complexity: "complex"
   - reasoning: "OAuth2 requires security considerations, token management, multiple endpoints"

3. Orchestrator creates plan file:
   .claude/planning/{project}/oauth2-implementation-plan.md

4. Updates status: "Awaiting Plan Approval"
5. Human reviews plan, approves
6. Orchestrator starts work
```

### Example 2: Simple Task

```
1. New task: "Fix typo in README.md"
2. LLM analyzes:
   - needs_planning: false
   - complexity: "trivial"
   - reasoning: "Simple text change, no logic involved"

3. Orchestrator starts work immediately
4. Claude completes in 30 seconds
5. LLM verifies: actually_complete=true, confidence=0.95
6. Status → Completed
```

### Example 3: False Completion

```
1. Task: "Add input validation to user registration"
2. Claude marks as complete
3. LLM verification:
   - actually_complete: false
   - issues_found: [
       "No tests added",
       "Email validation regex is incorrect",
       "Missing validation for password strength"
     ]
   - recommended_status: "Incomplete"

4. Orchestrator:
   - Marks as "Incomplete"
   - Adds issues to next_action
   - Resumes work
```

### Example 4: Stuck Detection

```
1. Task running for 2 hours
2. No git commits in 90 minutes
3. LLM analyzes tmux output:
   - status: "stuck"
   - evidence: "Repeatedly running same failing test"
   - recommendation: "interrupt"
   - suggested_prompt: "The test is failing because... Try this approach instead..."

4. Orchestrator sends interrupt prompt to Claude
5. Claude adjusts approach
6. Work continues
```

## Configuration

```yaml
# config.yaml

# LLM Decision Making
llm_decisions:
  enabled: true
  provider: qwen  # or 'claude'

  # Qwen (local, free)
  qwen:
    endpoint: http://localhost:11434
    model: qwen2.5-coder:32b

  # Claude (API, costs money)
  claude:
    api_key: ${ANTHROPIC_API_KEY}
    model: claude-3-5-sonnet-20241022

  # When to use LLM decisions
  decisions:
    task_planning: true        # Analyze if task needs planning
    completion_verification: true  # Verify task completion
    stuck_detection: true      # Detect if agent is stuck
    test_generation: true      # Generate test plans

  # Thresholds
  thresholds:
    planning_complexity: moderate  # Plan if >= this complexity
    verification_confidence: 0.7   # Mark complete if >= this confidence
    stuck_timeout_minutes: 60      # Check for stuck after this time
```

## Implementation Plan

### Phase 1: LLM Infrastructure (3 hours)
**Tasks:**
1. [ ] Create `src/llm_providers.py`
2. [ ] Implement `ClaudeProvider`
3. [ ] Implement `QwenProvider`
4. [ ] Add config for LLM decisions
5. [ ] Write provider tests

### Phase 2: Decision Making Module (3 hours)
**Tasks:**
1. [ ] Create `src/llm_decision.py`
2. [ ] Implement `analyze_task_for_planning()`
3. [ ] Implement `verify_completion()`
4. [ ] Implement `detect_stuck()`
5. [ ] Implement `generate_test_plan()`
6. [ ] Write decision tests

### Phase 3: Orchestrator Integration (3 hours)
**Tasks:**
1. [ ] Integrate LLM into daemon loop
2. [ ] Add planning decision point
3. [ ] Add completion verification
4. [ ] Add stuck detection timer
5. [ ] Create plan/review file generators
6. [ ] Update status flow

### Phase 4: Testing & Polish (3 hours)
**Tasks:**
1. [ ] Integration tests with mocked LLM
2. [ ] End-to-end workflow tests
3. [ ] Error handling
4. [ ] Documentation
5. [ ] Example prompts
6. [ ] Tuning thresholds

## Testing Strategy

### Mock LLM for Tests

```python
# src/mocks.py additions

class MockLLMProvider(LLMProvider):
    """Mock LLM for testing."""

    def __init__(self):
        self.responses = {}

    def set_response(self, prompt_key: str, response: dict):
        """Set canned response for testing."""
        self.responses[prompt_key] = json.dumps(response)

    def complete(self, prompt: str, temperature: float = 0.5) -> str:
        # Match prompt to canned response
        if "needs_planning" in prompt:
            return self.responses.get("planning", "{}")
        elif "actually_complete" in prompt:
            return self.responses.get("verification", "{}")
        # ... etc
```

### Test Cases

```python
def test_complex_task_requires_planning():
    """Test that complex tasks trigger planning."""
    llm = MockLLMProvider()
    llm.set_response("planning", {
        "needs_planning": True,
        "complexity": "complex",
        "reasoning": "..."
    })

    decision_maker = LLMDecisionMaker(llm)
    project = MockProject.create(next_action="Add OAuth2 authentication")

    result = decision_maker.analyze_task_for_planning(project)

    assert result.needs_planning == True
    assert result.complexity == "complex"


def test_incomplete_work_detected():
    """Test that incomplete work is caught."""
    llm = MockLLMProvider()
    llm.set_response("verification", {
        "actually_complete": False,
        "issues_found": ["No tests", "Missing validation"],
        "recommended_status": "Incomplete"
    })

    decision_maker = LLMDecisionMaker(llm)
    verification = decision_maker.verify_completion(project, diff, tests)

    assert verification.actually_complete == False
    assert len(verification.issues_found) == 2
```

## Benefits

### For Development
- ✅ Catches incomplete work before human review
- ✅ Suggests appropriate approaches
- ✅ Prevents wasted effort on stuck tasks
- ✅ Generates test strategies

### For Quality
- ✅ Automated verification layer
- ✅ Detects obvious bugs
- ✅ Ensures proper testing
- ✅ Review checklists for humans

### For Efficiency
- ✅ Skip planning for simple tasks
- ✅ Require planning for complex tasks
- ✅ Catch stuck agents early
- ✅ Reduce human review time

## Cost Considerations

**Using Local Qwen (Free):**
- ~500 tokens per decision
- 0 cost
- Faster (no API latency)
- Good enough for most decisions

**Using Claude API:**
- ~$0.003 per decision (Haiku)
- ~$0.015 per decision (Sonnet)
- Higher quality
- Use for critical decisions only

**Recommendation:** Qwen for routine decisions, Claude API for critical verification

## Open Questions

### 1. When to Use LLM vs Rules?
**Question:** Should some decisions be rule-based instead of LLM?

**Examples:**
- "Fix typo" → Always trivial (rule)
- "Refactor auth system" → Always complex (rule)
- Most tasks → LLM decides

**Recommendation:** Hybrid - rules for obvious cases, LLM for ambiguous

### 2. Human Override?
**Question:** Should humans be able to override LLM decisions?

**Implementation:**
- Add `override: true` field in CSV/Sheet
- Skip LLM analysis if override set

**Recommendation:** Yes, always allow override

### 3. LLM Model Selection?
**Question:** Which model for which decision?

**Options:**
- Planning: Sonnet (complex reasoning)
- Verification: Haiku (simple yes/no)
- Stuck detection: Qwen (cheap, frequent checks)

**Recommendation:** Configurable per decision type

## Success Criteria

- [ ] LLM correctly identifies complex tasks (>80% accuracy)
- [ ] Catches incomplete work before human review (>70%)
- [ ] Detects stuck agents within 10 minutes
- [ ] Generates useful test plans (human-judged)
- [ ] Low false positives (<20%)
- [ ] Works with both Qwen and Claude API
- [ ] Configurable and optional
- [ ] Well-tested with mocks

## References

- Claude API: https://docs.anthropic.com/claude/reference/
- Ollama API: https://github.com/ollama/ollama/blob/main/docs/api.md
- Structured output: https://docs.anthropic.com/claude/docs/tool-use
- JSON mode: Most LLMs support JSON output now

---

**Next Steps:**
1. Implement LLM provider interface
2. Create decision making module
3. Write comprehensive tests
4. Integrate with daemon
5. Tune prompts and thresholds
