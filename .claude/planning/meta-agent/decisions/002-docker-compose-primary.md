# ADR 002: Docker Compose as Primary Implementation

**Date:** 2026-01-01
**Status:** Accepted
**Deciders:** Mike + Claude
**Supersedes:** Current tmux-based approach

## Context

Need architecture for running:
- Orchestrator service (24/7 daemon)
- Claude Code agents (per-project isolation)
- State persistence
- System service behavior (start on boot, auto-restart)

## Decision

**Make Docker Compose the PRIMARY implementation**, not just an option.

## Rationale

### Why Docker Compose is Better

**1. Built-in System Service**
```yaml
services:
  orchestrator:
    restart: unless-stopped  # Systemd-like behavior
    depends_on:
      - postgres
```
- No need to write systemd service files
- Works on any OS (Linux, macOS, Windows)
- Standard tooling everyone knows

**2. True Isolation**
```yaml
services:
  project-antenna:
    image: cto-sidekick/agent
    volumes:
      - ~/Projects/antenna:/workspace
    networks:
      - isolated
```
- Each project = separate container
- Network isolation per project
- Resource limits (CPU, memory)
- No tmux complexity

**3. Health Checks**
```yaml
healthcheck:
  test: ["CMD", "python", "/app/status.py"]
  interval: 30s
  retries: 3
```
- Built-in monitoring
- Automatic restart on failure
- Status visibility

**4. Community Solutions**
- Docker sandboxing already solved
- Multiple community projects exist:
  - `textcortex/claude-code-sandbox` (web UI!)
  - `agent-infra/sandbox`
  - Official Docker Desktop integration

**5. Simpler Than VMs**
- No libvirt complexity
- No VM template management
- Faster startup (seconds vs minutes)
- Better resource usage

**6. Development Workflow**
```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f orchestrator

# Enter project container
docker-compose exec project-antenna bash

# Restart on changes
docker-compose restart orchestrator
```

### Comparison

| Feature | Tmux Approach | Docker Compose Approach |
|---------|---------------|------------------------|
| Isolation | Process-level | Container-level ✅ |
| Service | Manual systemd | Built-in restart ✅ |
| Multi-project | Same host | Separate containers ✅ |
| Resource limits | OS-level | Docker built-in ✅ |
| Visibility | tmux attach | docker logs ✅ |
| Portability | Linux-specific | Cross-platform ✅ |
| Setup complexity | Medium | Low ✅ |
| GPU access | Direct | Pass-through |
| Networking | Host | Isolated ✅ |

## Implementation

### Architecture

```
┌─────────────────────────────────────────────────┐
│              Docker Compose Stack               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐        ┌──────────────────┐  │
│  │ Orchestrator│◄──────►│   PostgreSQL     │  │
│  │  Container  │        │   (state DB)     │  │
│  └──────┬──────┘        └──────────────────┘  │
│         │                                      │
│         │ Manages                              │
│         ▼                                      │
│  ┌──────────────────────────────────────┐    │
│  │       Agent Containers               │    │
│  ├──────────────────────────────────────┤    │
│  │ ┌────────────┐  ┌────────────┐      │    │
│  │ │ Project A  │  │ Project B  │      │    │
│  │ │ (Claude)   │  │ (Claude)   │      │    │
│  │ └────────────┘  └────────────┘      │    │
│  └──────────────────────────────────────┘    │
│                                                 │
│  ┌──────────────────────────────────────┐    │
│  │         Shared Services              │    │
│  ├──────────────────────────────────────┤    │
│  │ Qwen GPU Server (both RTX 3090s)    │    │
│  │ Dashboard (web UI)                   │    │
│  │ CSV Priority Watcher                 │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  # State database
  postgres:
    image: postgres:16
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: cto_sidekick
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD", "pg_isready"]
      interval: 10s

  # Main orchestrator
  orchestrator:
    build: .
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./config.yaml:/app/config.yaml
      - ./priorities.csv:/app/priorities.csv
      - /var/run/docker.sock:/var/run/docker.sock  # Manage containers
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres/cto_sidekick
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "/app/src/status.py"]
      interval: 30s

  # Qwen GPU server
  qwen:
    image: ollama/ollama:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    volumes:
      - qwen-models:/root/.ollama
    restart: unless-stopped

  # Dashboard (optional)
  dashboard:
    build:
      context: .
      dockerfile: Dockerfile.dashboard
    ports:
      - "5000:5000"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres/cto_sidekick
    restart: unless-stopped

volumes:
  postgres-data:
  qwen-models:

networks:
  default:
    name: cto-network
```

### Agent Container (spawned dynamically)

```yaml
# Template for agent containers
# Spawned by orchestrator for each project
version: '3.8'

services:
  agent-{project-name}:
    image: cto-sidekick/claude-agent
    volumes:
      - {project-dir}:/workspace:rw
    working_dir: /workspace
    environment:
      PROJECT_NAME: {project-name}
      ORCHESTRATOR_URL: http://orchestrator:8080
    command: ["claude", "--dangerously-skip-permissions"]
    restart: "no"  # Single-run, orchestrator manages
    networks:
      - cto-network
```

## Migration Path

### Phase 1: Docker-ify Current System (Week 1)
1. Create Dockerfile for orchestrator
2. Create docker-compose.yml
3. Migrate state to PostgreSQL
4. CSV priority file support
5. Test basic workflow

### Phase 2: Dynamic Agent Containers (Week 2)
1. Orchestrator spawns containers per project
2. Container lifecycle management
3. Health monitoring
4. Log aggregation

### Phase 3: GPU & Advanced Features (Week 3)
1. Qwen GPU container
2. Dashboard container
3. MCP servers as containers
4. Multi-container coordination

## Benefits

### For Development
- ✅ Consistent environment (Docker everywhere)
- ✅ Quick setup (one `docker-compose up`)
- ✅ Easy debugging (docker logs, exec)
- ✅ Reproducible builds

### For Deployment
- ✅ Works on any Docker host
- ✅ Easy scaling (docker-compose scale)
- ✅ Standard monitoring (docker stats)
- ✅ Simple backups (volume snapshots)

### For Isolation
- ✅ Network isolation per container
- ✅ Resource limits enforced
- ✅ Filesystem isolation
- ✅ Security boundaries

### For Operations
- ✅ Auto-restart (restart: unless-stopped)
- ✅ Health checks (built-in)
- ✅ Log management (docker logs)
- ✅ Update strategy (rolling restart)

## Consequences

### Positive
- Simpler than VM approach
- Better than tmux approach
- Industry-standard tooling
- Cross-platform
- Well-documented
- Community support

### Negative
- Requires Docker installed
- GPU passthrough more complex than direct
- Container overhead (minimal)
- Docker learning curve (but most devs know it)

### Neutral
- Different from original tmux plan
- Need to rewrite some runner code
- But cleaner architecture overall

## Open Questions

### 1. Dynamic Container Spawning?
**Question:** Should orchestrator spawn agent containers dynamically?

**Options:**
- A) Pre-defined containers in docker-compose.yml
- B) Orchestrator spawns containers via Docker API
- C) Hybrid (common projects pre-defined, others dynamic)

**Recommendation:** B (dynamic) - more flexible

### 2. Shared vs Per-Project Networks?
**Question:** Network isolation level?

**Options:**
- A) All share one network (simpler)
- B) Each project isolated network (more secure)
- C) Project groups (related projects share network)

**Recommendation:** B for security, A for MVP

### 3. Container Persistence?
**Question:** Keep containers running or start/stop?

**Options:**
- A) Keep running (faster switching)
- B) Start on-demand (resource efficient)

**Recommendation:** B (start on-demand)

## Implementation Notes

### Using Docker API

```python
# src/runners/docker_agent.py

import docker

class DockerAgentRunner(AgentRunner):
    def __init__(self):
        self.client = docker.from_env()

    def start(self, project: Project, prompt: str):
        # Create container for project
        container = self.client.containers.run(
            image="cto-sidekick/claude-agent",
            name=f"agent-{project.name}",
            volumes={
                project.directory: {
                    'bind': '/workspace',
                    'mode': 'rw'
                }
            },
            environment={
                'INITIAL_PROMPT': prompt
            },
            detach=True,
            remove=True  # Auto-remove on completion
        )

        return container

    def is_running(self):
        try:
            container = self.client.containers.get(self.container_name)
            return container.status == 'running'
        except docker.errors.NotFound:
            return False
```

## Next Steps

1. ✅ Document decision (this file)
2. [ ] Update TODO.md with Docker-first tasks
3. [ ] Create basic Dockerfile
4. [ ] Create docker-compose.yml
5. [ ] Test with one project
6. [ ] Migrate state to PostgreSQL
7. [ ] Implement dynamic container spawning

## References

- Docker Compose: https://docs.docker.com/compose/
- Docker Python SDK: https://docker-py.readthedocs.io/
- Community sandboxes: textcortex/claude-code-sandbox
- Docker systemd: https://docs.docker.com/config/containers/start-containers-automatically/

---

**Status:** Accepted - This is now the PRIMARY implementation path
**Impact:** Simplifies architecture, better isolation, industry standard
