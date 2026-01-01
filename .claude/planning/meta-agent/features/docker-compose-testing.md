# Docker Compose Primary Implementation

**Status:** Planning → **NOW PRIMARY APPROACH** ⭐
**Priority:** **HIGHEST**
**Estimated Effort:** 8-12 hours (full implementation)

**IMPORTANT:** This is now the MAIN implementation, not just testing.
See: [ADR 002](../decisions/002-docker-compose-primary.md)

## Problem

Currently:
- ❌ Tests run locally or in CI, not in realistic container environment
- ❌ No simulation of full system service deployment
- ❌ CSV priority management not implemented (only Google Sheets)
- ❌ No isolated container for development/testing

**Goal:** Create Docker Compose environment that simulates production deployment for testing and development.

## Requirements

### Must Have

1. **Docker Compose Setup**
   - Service container running orchestrator daemon
   - Test container for running test suite
   - Network isolation between containers
   - Volume mounts for state/logs

2. **CSV Priority File Support**
   - Alternative to Google Sheets for simpler deployments
   - Watch CSV file for changes
   - Same schema as Google Sheets
   - Backward compatible (Sheets still works)

3. **System Service Simulation**
   - Orchestrator runs as systemd-like service in container
   - Automatic restart on failure
   - Health checks
   - Graceful shutdown

4. **Isolated Dev Container**
   - All dependencies pre-installed
   - tmux available
   - Claude Code installed (or mocked)
   - Quick iteration without polluting host

### Nice to Have

- Multi-container setup (separate containers per project)
- Mock Claude API server for testing
- Web dashboard container
- Volume snapshots for state rollback
- Performance profiling tools

## Architecture

### Docker Compose Structure

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Main orchestrator service
  orchestrator:
    build: .
    container_name: cto-sidekick
    restart: unless-stopped
    volumes:
      - ./config.yaml:/app/config.yaml:ro
      - ./priorities.csv:/app/priorities.csv:rw
      - ./state:/app/state
      - ./logs:/app/logs
      - /var/run/docker.sock:/var/run/docker.sock  # For spawning containers
    environment:
      - PRIORITY_SOURCE=csv  # or 'sheets'
      - LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "python", "/app/src/status.py"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - cto-network

  # Test runner
  test:
    build:
      context: .
      target: test
    container_name: cto-sidekick-test
    volumes:
      - .:/app
    command: ./run_tests.sh
    networks:
      - cto-network

  # Mock Claude API (for testing)
  mock-claude:
    build: ./docker/mock-claude
    container_name: mock-claude-api
    ports:
      - "8080:8080"
    networks:
      - cto-network

  # Development environment
  dev:
    build:
      context: .
      target: dev
    container_name: cto-sidekick-dev
    volumes:
      - .:/app
      - dev-home:/home/dev
    stdin_open: true
    tty: true
    networks:
      - cto-network

networks:
  cto-network:
    driver: bridge

volumes:
  dev-home:
```

### Dockerfile Structure

```dockerfile
# Dockerfile
FROM python:3.11-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tmux \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

# Copy project files
COPY pyproject.toml .
COPY src/ src/
COPY requirements.txt .

# Install Python dependencies
RUN uv pip install --system -e .

# Production target
FROM base AS production
COPY config.yaml.example /app/config.yaml.example
COPY run.sh /app/run.sh
RUN chmod +x /app/run.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python src/status.py || exit 1

CMD ["python", "src/daemon.py"]

# Test target
FROM base AS test
COPY tests/ tests/
COPY run_tests.sh /app/run_tests.sh
RUN chmod +x /app/run_tests.sh
CMD ["./run_tests.sh"]

# Development target
FROM base AS dev
RUN apt-get update && apt-get install -y \
    vim \
    less \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Create dev user
RUN useradd -m -s /bin/bash dev
USER dev
WORKDIR /home/dev/app

CMD ["/bin/bash"]
```

## CSV Priority File Format

### priorities.csv

```csv
Project,Priority,Status,Agent,Last Update,Next Action,Deadline,GPU,Model
Antenna ML Pipeline,1,Pending,,,"Implement batch processing for image classification",2026-01-15,Yes,Sonnet 4
APRS Audio Tools,2,Pending,,,"Create CLI wrapper for audio decoder",2026-01-10,No,Qwen
eButterfly Export,3,Blocked,,,"Waiting for API access",2026-02-01,No,
Pipecat Voice,4,Pending,,,"Research VAD frameworks",2026-01-20,Yes,Gemini 2.0
```

**Format:**
- Same columns as Google Sheets
- UTF-8 encoding
- Header row required
- Empty fields allowed
- ISO 8601 dates

### Implementation: `src/priority_sources/csv_source.py`

```python
"""CSV priority file source."""

import csv
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional

from src.models import Project, ProjectStatus

logger = logging.getLogger(__name__)


class CSVPrioritySource:
    """Read priorities from CSV file instead of Google Sheets."""

    def __init__(self, csv_path: Path):
        self.csv_path = Path(csv_path)
        self.last_modified = None

    def has_changed(self) -> bool:
        """Check if CSV file has been modified."""
        if not self.csv_path.exists():
            return False

        current_mtime = self.csv_path.stat().st_mtime
        if self.last_modified is None or current_mtime > self.last_modified:
            self.last_modified = current_mtime
            return True

        return False

    def get_projects(self, project_dirs: dict[str, str]) -> list[Project]:
        """Read projects from CSV file."""
        if not self.csv_path.exists():
            logger.error(f"CSV file not found: {self.csv_path}")
            return []

        projects = []

        try:
            with open(self.csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)

                for row in reader:
                    try:
                        project = self._parse_row(row, project_dirs)
                        if project.name:
                            projects.append(project)
                    except Exception as e:
                        logger.warning(f"Failed to parse CSV row {row}: {e}")

            logger.info(f"Loaded {len(projects)} projects from CSV")
            return projects

        except Exception as e:
            logger.error(f"Error reading CSV: {e}")
            return []

    def _parse_row(self, row: dict, project_dirs: dict[str, str]) -> Project:
        """Parse CSV row into Project."""
        name = row.get('Project', '').strip()

        # Parse status
        status_str = row.get('Status', 'Pending').strip()
        try:
            status = ProjectStatus(status_str)
        except ValueError:
            status = ProjectStatus.PENDING

        # Parse priority
        try:
            priority = int(row.get('Priority', 999))
        except (ValueError, TypeError):
            priority = 999

        # Parse last update
        last_update_str = row.get('Last Update', '').strip()
        last_update = None
        if last_update_str:
            try:
                last_update = datetime.fromisoformat(last_update_str)
            except ValueError:
                pass

        return Project(
            name=name,
            priority=priority,
            status=status,
            next_action=row.get('Next Action', '').strip(),
            deadline=row.get('Deadline', '').strip() or None,
            agent=row.get('Agent', '').strip() or None,
            last_update=last_update,
            directory=project_dirs.get(name)
        )

    def update_project_status(self, project_name: str, status: ProjectStatus, agent: Optional[str] = None):
        """Update project status in CSV."""
        if not self.csv_path.exists():
            logger.error("CSV file not found for update")
            return

        try:
            # Read all rows
            rows = []
            with open(self.csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                rows = list(reader)

            # Update matching row
            updated = False
            for row in rows:
                if row['Project'] == project_name:
                    row['Status'] = status.value
                    if agent:
                        row['Agent'] = agent
                    row['Last Update'] = datetime.now().isoformat(timespec='seconds')
                    updated = True
                    break

            if not updated:
                logger.warning(f"Project '{project_name}' not found in CSV")
                return

            # Write back
            with open(self.csv_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

            logger.info(f"Updated CSV: {project_name} → {status.value}")

        except Exception as e:
            logger.error(f"Error updating CSV: {e}")
```

## Docker Workflow Examples

### 1. Run Tests in Container

```bash
# Build and run tests
docker-compose run --rm test

# Or watch tests
docker-compose run --rm test bash -c "while true; do ./run_tests.sh; sleep 5; done"
```

### 2. Start Orchestrator Service

```bash
# Start service
docker-compose up -d orchestrator

# View logs
docker-compose logs -f orchestrator

# Check status
docker-compose exec orchestrator python src/status.py

# Restart
docker-compose restart orchestrator
```

### 3. Development Environment

```bash
# Enter dev container
docker-compose run --rm dev

# Inside container:
dev@container:~/app$ ./run_tests.sh
dev@container:~/app$ python src/daemon.py
dev@container:~/app$ tmux  # tmux available!
```

### 4. Edit Priorities and Watch Changes

```bash
# On host, edit CSV
echo "New Project,1,Pending,,,Do something,2026-02-01,No," >> priorities.csv

# Orchestrator detects change and picks up new project
docker-compose logs -f orchestrator
```

### 5. Simulate System Service

```bash
# Deploy as service
docker-compose up -d

# Service auto-restarts on failure
docker-compose kill orchestrator
# ...waits a moment...
# Service automatically restarted!

# Check health
docker-compose ps
```

## Configuration Updates

### config.yaml additions

```yaml
# Priority source configuration
priority_source:
  type: csv  # or 'sheets'

  # CSV configuration
  csv:
    file: ./priorities.csv
    watch_interval: 10  # Check for changes every 10 seconds
    encoding: utf-8

  # Sheets configuration (existing)
  sheets:
    credentials_file: ./credentials/sheets-api.json
    spreadsheet_name: "CTO Sidekick - Projects"
    worksheet_name: "Projects"
```

### Updated daemon to support both sources

```python
# src/daemon.py

class CTOSidekick:
    def __init__(self, config: Config):
        # ... existing ...

        # Priority source (CSV or Sheets)
        if config.get('priority_source.type') == 'csv':
            from src.priority_sources.csv_source import CSVPrioritySource
            csv_path = config.get('priority_source.csv.file')
            self.priority_source = CSVPrioritySource(csv_path)
        else:
            from src.sheets import SheetsClient
            self.priority_source = SheetsClient(...)
```

## Implementation Plan

### Phase 1: CSV Support (3 hours)
**Tasks:**
1. [ ] Create `src/priority_sources/` module
2. [ ] Implement `CSVPrioritySource` class
3. [ ] Add CSV watch/update logic
4. [ ] Update config for priority source selection
5. [ ] Update daemon to support both sources
6. [ ] Write tests for CSV parsing
7. [ ] Create example `priorities.csv`

### Phase 2: Docker Setup (2 hours)
**Tasks:**
1. [ ] Create `Dockerfile` with multi-stage builds
2. [ ] Create `docker-compose.yml`
3. [ ] Add `.dockerignore`
4. [ ] Test build process
5. [ ] Document Docker usage

### Phase 3: Docker Testing (2 hours)
**Tasks:**
1. [ ] Update CI to test Docker builds
2. [ ] Add Docker-specific tests
3. [ ] Mock Claude API server
4. [ ] Integration tests in containers
5. [ ] Document testing workflow

### Phase 4: Dev Environment (1 hour)
**Tasks:**
1. [ ] Dev container configuration
2. [ ] Volume management
3. [ ] Quick start script
4. [ ] Documentation

## Testing Strategy

### Unit Tests: `tests/test_csv_source.py`

```python
def test_csv_parsing():
    """Test CSV file parsing."""
    # Create temp CSV
    # Parse into projects
    # Verify all fields

def test_csv_update():
    """Test updating CSV file."""
    # Load CSV
    # Update status
    # Verify file changed

def test_csv_watch():
    """Test file change detection."""
    # Initial load
    # Modify file
    # Verify has_changed() returns True
```

### Integration Tests: `tests/test_docker_integration.py`

```python
def test_orchestrator_in_container():
    """Test orchestrator running in Docker."""
    # Start container
    # Check health
    # Verify logs
    # Stop container

def test_csv_priority_workflow():
    """Test full workflow with CSV."""
    # Start orchestrator with CSV
    # Add project to CSV
    # Verify orchestrator picks it up
    # Mark complete
    # Verify CSV updated
```

### Docker Compose Tests

```bash
# tests/docker/test-compose.sh
#!/bin/bash

set -e

echo "Testing Docker Compose setup..."

# Start services
docker-compose up -d

# Wait for health check
sleep 10

# Check orchestrator is running
docker-compose ps orchestrator | grep "Up"

# Check health endpoint
docker-compose exec orchestrator python src/status.py

# Add project via CSV
echo "Test Project,1,Pending,,,Do test,2026-02-01,No," >> priorities.csv

# Wait for detection
sleep 15

# Check logs for pickup
docker-compose logs orchestrator | grep "Test Project"

# Cleanup
docker-compose down -v

echo "✅ Docker Compose tests passed"
```

## Benefits

### For Development
- ✅ Isolated environment (no host pollution)
- ✅ Reproducible builds
- ✅ Quick iteration (volume mounts)
- ✅ Same environment as production

### For Testing
- ✅ Realistic deployment testing
- ✅ Network isolation verification
- ✅ System service simulation
- ✅ CI/CD integration

### For Deployment
- ✅ Easy to deploy anywhere (Docker everywhere)
- ✅ No system dependencies
- ✅ Health checks built-in
- ✅ Graceful shutdown

### For CSV Mode
- ✅ No Google Cloud setup required
- ✅ Simple file-based priorities
- ✅ Easy automation (scripts can modify CSV)
- ✅ Version control friendly (git diff on CSV)

## Open Questions

### 1. CSV vs Sheets Default?
**Question:** Which should be default for new users?

**Options:**
- A) CSV (simpler, no API setup)
- B) Sheets (better UI, mobile access)
- C) Auto-detect (if sheets creds exist, use Sheets; else CSV)

**Recommendation:** C (auto-detect)

### 2. Container Nesting?
**Question:** Should orchestrator spawn agent containers, or just tmux?

**Options:**
- A) Keep tmux in orchestrator container
- B) Spawn separate containers per agent
- C) Hybrid (tmux in dev, containers in prod)

**Recommendation:** A for MVP, B later

### 3. Mock Claude API?
**Question:** Should we build a mock Claude API for testing?

**Implementation:**
- Simple HTTP server
- Responds to prompts with canned responses
- Simulates credit usage
- Tracks token counts

**Priority:** Nice to have, not MVP

### 4. Multi-Project Containers?
**Question:** One container per project, or all in orchestrator?

**Trade-offs:**
- Separate: Better isolation, more overhead
- Single: Simpler, less isolation

**Recommendation:** Single container for now (matches tmux approach)

## Dependencies

### Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo apt install docker-compose-plugin
```

### Python Packages
None (same as existing)

## Success Criteria

- [ ] `docker-compose up` starts orchestrator
- [ ] Health checks pass
- [ ] CSV priority file works
- [ ] Can switch between CSV/Sheets
- [ ] Tests run in container
- [ ] Dev container works
- [ ] Documentation complete
- [ ] CI tests Docker builds

## Future Enhancements

- Kubernetes manifests (for multi-node)
- Docker Swarm mode
- Container-per-project mode
- Mock Claude API server
- Performance metrics collection
- Log aggregation (ELK stack)
- Grafana dashboard

## References

- Docker Compose: https://docs.docker.com/compose/
- Multi-stage builds: https://docs.docker.com/build/building/multi-stage/
- Health checks: https://docs.docker.com/engine/reference/builder/#healthcheck
- CSV format: https://tools.ietf.org/html/rfc4180

---

**Next Steps:**
1. Implement CSV priority source
2. Create Dockerfile
3. Create docker-compose.yml
4. Test in container
5. Update documentation
