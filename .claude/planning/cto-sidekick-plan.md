# Mike's CTO Sidekick: Autonomous Development Orchestration Service
## Multi-Project Agent Management & Prioritization System
## Created: 2025-12-31

## VISION

A Linux system service that acts as your **autonomous CTO sidekick**, managing multiple development projects across different technologies (biodiversity tech, radio/SDR, AI/ML) by:

1. **Orchestrating autonomous agents** (Claude Code, local Qwen, multi-model workflows)
2. **Managing compute resources** (VMs, Docker containers, GPU allocation)
3. **Tracking project priorities** (Google Sheets integration for status/planning)
4. **Resuming work intelligently** (5-hour credit cycles, context preservation)
5. **Monitoring progress** (mobile-accessible dashboard, notifications)
6. **Adapting resource allocation** (route tasks to appropriate models/infrastructure)

**Goal**: Walk away from your desk. Come back hours/days later. Projects have advanced autonomously based on priorities you set in a Google Sheet.

---

## HIGH-LEVEL GOALS

### 1. Multi-Project Context Management
- **Problem**: Working on Antenna (Django/ML), eButterfly (conservation), APRS tools (radio), Pipecat voice assistant, etc. simultaneously
- **Solution**: Each project gets isolated environment (VM or container) with persistent state
- **Benefit**: Resume any project instantly without context switching overhead

### 2. Intelligent Task Routing
- **Problem**: Not all tasks need expensive Claude Sonnet 4. Some work for Qwen. Some need GPU.
- **Solution**: Classify tasks by complexity/type, route to optimal model/infrastructure
- **Benefit**: Maximize Claude credits, minimize cost, leverage local 48GB GPU

### 3. Priority-Driven Execution
- **Problem**: Multiple projects compete for attention and credits
- **Solution**: Google Sheet defines priorities, deadlines, dependencies
- **Benefit**: Highest-value work happens first, automatic re-prioritization

### 4. Autonomous Continuation
- **Problem**: 5-hour Claude credit cycles require manual intervention
- **Solution**: Service monitors credit status, auto-resumes work on renewal
- **Benefit**: True "set it and forget it" autonomous development

### 5. Remote Visibility
- **Problem**: Need to check progress while away from desk (mobile, other work)
- **Solution**: Web dashboard + push notifications via Tailscale
- **Benefit**: Stay informed without babysitting terminal windows

### 6. Resource Optimization
- **Problem**: 48GB GPU underutilized, Claude credits over-used
- **Solution**: Route appropriate work to local Qwen, offload Claude when possible
- **Benefit**: Faster execution, lower cost, better hardware utilization

### 7. State Preservation
- **Problem**: Agents lose context between sessions
- **Solution**: Structured state files (CONTINUATION.md pattern), git checkpoints
- **Benefit**: Pick up exactly where agent left off

### 8. Multi-Model Coordination
- **Problem**: Need Claude for planning, Qwen for implementation, Gemini for review
- **Solution**: Pipeline tasks through multiple models based on strengths
- **Benefit**: Best tool for each job, cost optimization

---

## CORE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIKES-CTO-SIDEKICK SERVICE                   │
│                     (Python systemd daemon)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼─────┐        ┌────▼─────┐        ┌────▼─────┐
    │ Scheduler │        │ Resource │        │  State   │
    │  Engine   │        │ Manager  │        │ Tracker  │
    └────┬─────┘        └────┬─────┘        └────┬─────┘
         │                   │                    │
         └───────────────────┼────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │                                       │
    ┌────▼──────────┐                  ┌────────▼─────┐
    │  Google Sheet │                  │ Agent Pool   │
    │  Integration  │                  │ Manager      │
    │               │                  │              │
    │ - Priorities  │                  │ - Claude     │
    │ - Status      │                  │ - Qwen       │
    │ - Deadlines   │                  │ - Gemini     │
    └───────────────┘                  └────┬─────────┘
                                            │
         ┌──────────────────────────────────┴──────────┐
         │                                             │
    ┌────▼────────┐                          ┌────────▼──────┐
    │ VM Manager  │                          │ Web Dashboard │
    │             │                          │               │
    │ - QEMU/KVM  │                          │ - Flask/React │
    │ - GPU Pass  │                          │ - Tailscale   │
    │ - Network   │                          │ - Ntfy.sh     │
    └─────────────┘                          └───────────────┘
```

---

## IMPLEMENTATION OPTIONS

### Option 1: MVP - Single Host, Docker-Based
**Scope**: 1-2 weeks
**Complexity**: Low-Medium

**Stack**:
- Python daemon (systemd service)
- Docker for agent isolation (textcortex/claude-code-sandbox)
- Google Sheets API (gspread library)
- Flask dashboard
- SQLite for state tracking

**Components**:
```
/opt/cto-sidekick/
├── daemon.py              # Main service (watches Sheet, spawns agents)
├── scheduler.py           # Priority queue, task routing
├── agents/
│   ├── claude_runner.py   # Spawn/monitor Claude in Docker
│   ├── qwen_runner.py     # Local Qwen API client
│   └── gemini_runner.py   # Gemini API client
├── state/
│   ├── tracker.py         # Read/write CONTINUATION.md, state DB
│   └── projects.db        # SQLite: project state, agent status
├── integrations/
│   ├── sheets.py          # Google Sheets sync
│   └── github.py          # Optional: GitHub Projects API
├── dashboard/
│   ├── app.py             # Flask web UI
│   └── templates/
└── config.yaml            # Global configuration
```

**Pros**:
- ✅ Fast to build
- ✅ No VM complexity
- ✅ Docker isolation sufficient
- ✅ Easy debugging

**Cons**:
- ❌ All projects share host OS
- ❌ No true multi-project isolation
- ❌ GPU sharing between Docker containers awkward

---

### Option 2: Balanced - VM Pool + Docker Agents
**Scope**: 3-4 weeks
**Complexity**: Medium-High

**Stack**:
- Python daemon (systemd on host)
- libvirt/QEMU for VM management
- Docker inside VMs for agent isolation
- Google Sheets API
- FastAPI dashboard (async for better perf)
- PostgreSQL for state (more robust than SQLite)

**Architecture**:
```
Host (Debian):
├── cto-sidekick daemon (Python)
├── PostgreSQL (state database)
├── FastAPI dashboard
└── VM Pool (libvirt):
    ├── VM1: Antenna project (Docker + Claude)
    ├── VM2: APRS tools (Docker + Claude)
    ├── VM3: Qwen inference server (GPU passthrough, both RTX 3090s)
    └── VM4: General pool (on-demand)
```

**VM Template**:
- Ubuntu 24.04
- Docker installed
- Claude Code installed
- Git configured
- SSH keys
- Tailscale
- Auto-mount project via NFS/9p

**Workflow**:
1. Daemon reads priorities from Google Sheet
2. For each active project, ensure VM exists (clone from template if needed)
3. Start Claude in Docker inside VM
4. Claude calls Qwen on VM3 via network (MCP server or direct API)
5. Update Sheet with progress
6. Shutdown idle VMs after 1 hour

**Pros**:
- ✅ True project isolation (separate kernels)
- ✅ GPU passthrough to dedicated Qwen VM
- ✅ Can snapshot/rollback per project
- ✅ Network isolation per VM

**Cons**:
- ❌ More complexity
- ❌ Resource overhead (multiple VMs)
- ❌ Longer startup times

---

### Option 3: Maximum - Cloud + Local Hybrid
**Scope**: 4-6 weeks
**Complexity**: High

**Stack**:
- Python daemon (systemd)
- Local VMs (QEMU) for sensitive projects
- Claude Code on Web for parallel cloud work
- Local Qwen + Whisper (GPU VM)
- Kubernetes (k3s) for container orchestration
- React dashboard
- TimescaleDB (for metrics over time)

**Architecture**:
```
Home Infrastructure:
├── Host: Orchestration daemon
├── VM Pool: Local projects (sensitive data)
├── GPU VM: Qwen, Whisper, local inference
└── k3s cluster: Container orchestration

Cloud (Anthropic):
├── Claude Code on Web (parallel tasks)
└── GitHub repos (sync)

Mobile:
└── iOS dashboard (Tailscale + push notifs)
```

**Pros**:
- ✅ Maximum parallelism (local + cloud)
- ✅ Scales to many projects
- ✅ Professional-grade orchestration (k8s)

**Cons**:
- ❌ Overkill for current scale
- ❌ High complexity
- ❌ Expensive (cloud costs)

---

## RECOMMENDED APPROACH: Option 2 (VM Pool)

**Why**:
1. ✅ Matches your "different projects, different VMs" preference
2. ✅ GPU passthrough to dedicated Qwen VM
3. ✅ True isolation for biodiversity work (sensitive data)
4. ✅ Snapshot/rollback per project
5. ✅ Reasonable complexity
6. ✅ Fits your existing infrastructure (Debian, capable hardware)

**Phase 1 (Week 1)**: Core daemon + Docker agents + Sheets integration
**Phase 2 (Week 2)**: VM management + GPU passthrough setup
**Phase 3 (Week 3)**: Web dashboard + monitoring
**Phase 4 (Week 4)**: Multi-model routing + optimization

---

## GOOGLE SHEETS SCHEMA

### Sheet 1: "Projects"

| Project | Priority | Status | Agent | Last Update | Next Action | Deadline | GPU? | Model | Credits Used |
|---------|----------|--------|-------|-------------|-------------|----------|------|-------|--------------|
| Antenna ML Pipeline | 1 | In Progress | Claude (VM1) | 2025-12-31 14:30 | Implement batch processing | 2026-01-15 | Yes | Sonnet 4 | 450 |
| APRS Audio Tools | 2 | Waiting | - | 2025-12-30 18:00 | Create CLI wrapper | 2026-01-10 | No | Qwen | 0 |
| eButterfly Export | 3 | Blocked | - | 2025-12-29 | Waiting for API access | 2026-02-01 | No | - | 0 |
| Pipecat Voice | 4 | Planning | Gemini | 2025-12-31 10:00 | Research frameworks | 2026-01-20 | Yes | Gemini 2.0 | 25 |

### Sheet 2: "Task Queue"

| Task ID | Project | Description | Type | Assigned To | Status | Started | Completed | Output |
|---------|---------|-------------|------|-------------|--------|---------|-----------|--------|
| T001 | Antenna | Refactor image preprocessing | Implementation | Qwen (VM3) | Running | 2025-12-31 12:00 | - | - |
| T002 | APRS | Create decoder tests | Testing | Claude (VM2) | Queued | - | - | - |
| T003 | Pipecat | Evaluate VAD options | Research | Gemini API | Complete | 2025-12-30 | 2025-12-31 | docs/pipecat/vad-analysis.md |

### Sheet 3: "Agent Status"

| Agent | Type | VM | Status | Current Task | Credits | GPU | Uptime |
|-------|------|-----|--------|--------------|---------|-----|--------|
| claude-vm1 | Claude Sonnet 4 | VM1 | Active | T001 | 15/40 | No | 2h 15m |
| qwen-vm3 | Qwen 2.5 Coder 32B | VM3 | Active | T001 | ∞ | Both | 8h 45m |
| gemini-api | Gemini 2.0 Flash | - | Idle | - | 18/25 | No | - |

---

## CORE DAEMON LOGIC

```python
# /opt/cto-sidekick/daemon.py

import time
from typing import List
from dataclasses import dataclass
from scheduler import Scheduler
from integrations.sheets import SheetsClient
from agents.claude_runner import ClaudeRunner
from agents.qwen_runner import QwenRunner
from state.tracker import StateTracker

@dataclass
class Project:
    name: str
    priority: int
    status: str
    next_action: str
    vm_id: str
    requires_gpu: bool
    model_preference: str

class CTOSidekick:
    def __init__(self):
        self.sheets = SheetsClient()
        self.scheduler = Scheduler()
        self.state = StateTracker()
        self.agents = {
            'claude': ClaudeRunner(),
            'qwen': QwenRunner()
        }
    
    def run(self):
        """Main daemon loop"""
        while True:
            # 1. Sync priorities from Google Sheet
            projects = self.sheets.get_active_projects()
            
            # 2. Update scheduler with current priorities
            self.scheduler.update_priorities(projects)
            
            # 3. Check Claude credit status
            credits = self.get_claude_credits()
            
            # 4. Get next task based on priority + credits + resources
            task = self.scheduler.get_next_task(
                claude_credits=credits,
                qwen_available=self.agents['qwen'].is_idle()
            )
            
            if task:
                # 5. Route to appropriate agent
                agent = self.select_agent(task)
                
                # 6. Ensure VM exists for this project
                vm = self.ensure_vm(task.project)
                
                # 7. Execute task
                result = agent.execute(
                    task=task,
                    vm=vm,
                    gpu=task.requires_gpu
                )
                
                # 8. Update state + Sheet
                self.state.record_progress(task, result)
                self.sheets.update_status(task.project, result)
            
            # 9. Sleep and repeat
            time.sleep(60)  # Check every minute
    
    def select_agent(self, task):
        """Route task to best available agent"""
        # Complex tasks → Claude (if credits available)
        if task.complexity == 'high' and self.get_claude_credits() > 5:
            return self.agents['claude']
        
        # Boilerplate/implementation → Qwen
        if task.type in ['implementation', 'testing', 'refactor']:
            return self.agents['qwen']
        
        # Default to Qwen (free, local)
        return self.agents['qwen']
```

---

## VM MANAGEMENT STRATEGY

### VM Template Creation
```bash
# Create base template once
virt-install \
  --name ubuntu-dev-template \
  --ram 8192 \
  --vcpus 4 \
  --disk size=50 \
  --os-variant ubuntu24.04 \
  --network bridge=virbr0

# Inside template:
sudo apt install docker.io git tailscale
npm install -g @anthropic/claude-code
# Configure SSH, git, etc.

# Shutdown and mark as template
virsh shutdown ubuntu-dev-template
```

### Per-Project VM Cloning
```python
# In daemon
def ensure_vm(self, project: Project) -> VM:
    """Ensure VM exists for project, clone from template if needed"""
    vm_name = f"cto-{project.name.lower().replace(' ', '-')}"
    
    if not self.vm_exists(vm_name):
        # Clone from template
        subprocess.run([
            'virt-clone',
            '--original', 'ubuntu-dev-template',
            '--name', vm_name,
            '--auto-clone'
        ])
        
        # Mount project directory
        self.mount_project(vm_name, project)
        
        # Start VM
        subprocess.run(['virsh', 'start', vm_name])
        
        # Wait for boot
        self.wait_for_vm(vm_name)
    
    return VM(name=vm_name, project=project)
```

### GPU Passthrough to Qwen VM
```xml
<!-- VM3: qwen-inference-server.xml -->
<domain type='kvm'>
  <name>qwen-inference-server</name>
  <memory>32768</memory>
  <vcpu>16</vcpu>
  <devices>
    <!-- Pass through both RTX 3090s -->
    <hostdev mode='subsystem' type='pci' managed='yes'>
      <source>
        <address domain='0x0000' bus='0x01' slot='0x00' function='0x0'/>
      </source>
    </hostdev>
    <hostdev mode='subsystem' type='pci' managed='yes'>
      <source>
        <address domain='0x0000' bus='0x02' slot='0x00' function='0x0'/>
      </source>
    </hostdev>
  </devices>
</domain>
```

**Inside Qwen VM**:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull Qwen model (uses both GPUs automatically)
ollama pull qwen2.5-coder:32b

# Start MCP server (accessible from other VMs)
python qwen-mcp-server.py --host 0.0.0.0 --port 8000
```

**From Claude VMs**:
```json
// .mcp.json in each project VM
{
  "mcpServers": {
    "qwen": {
      "command": "npx",
      "args": ["-y", "mcp-client", "http://qwen-vm:8000"]
    }
  }
}
```

---

## WEB DASHBOARD

### Technology Stack
- **Backend**: Flask or FastAPI (Python)
- **Frontend**: Simple HTML/JS (or React if you want fancier)
- **Database**: PostgreSQL (state, metrics)
- **Auth**: Tailscale (automatic, no passwords needed)
- **Notifications**: ntfy.sh (push to mobile)

### Dashboard Views

**View 1: Project Overview**
```
╔══════════════════════════════════════════════════════════╗
║  Mike's CTO Sidekick                    Credits: 15/40   ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Active Projects                                         ║
║  ┌──────────────────────────────────────────────────┐  ║
║  │ 🟢 Antenna ML Pipeline        Priority: 1        │  ║
║  │    Agent: Claude (VM1)        GPU: ✓             │  ║
║  │    Progress: Implementing batch processor        │  ║
║  │    Last update: 2 minutes ago                    │  ║
║  └──────────────────────────────────────────────────┘  ║
║  ┌──────────────────────────────────────────────────┐  ║
║  │ 🟡 APRS Audio Tools           Priority: 2        │  ║
║  │    Agent: Qwen (VM3)          GPU: ✗             │  ║
║  │    Progress: Writing unit tests                  │  ║
║  │    Last update: 15 minutes ago                   │  ║
║  └──────────────────────────────────────────────────┘  ║
║                                                          ║
║  Queue: 3 tasks waiting                                  ║
╚══════════════════════════════════════════════════════════╝
```

**View 2: Resource Usage**
```
╔══════════════════════════════════════════════════════════╗
║  Resource Allocation                                     ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  VMs Running: 3/10                                       ║
║  ┌──────────────────────────────────────────────────┐  ║
║  │ VM1: Antenna        CPU: 45%   RAM: 6.2/8 GB    │  ║
║  │ VM2: APRS           CPU: 12%   RAM: 2.1/8 GB    │  ║
║  │ VM3: Qwen Server    CPU: 89%   RAM: 28/32 GB    │  ║
║  │      GPU0: 95%  GPU1: 87%  VRAM: 44/48 GB       │  ║
║  └──────────────────────────────────────────────────┘  ║
║                                                          ║
║  Credits Used Today                                      ║
║  Claude: 450 tokens  Gemini: 125 tokens                  ║
╚══════════════════════════════════════════════════════════╝
```

**View 3: Task Timeline**
```
╔══════════════════════════════════════════════════════════╗
║  Recent Activity                                         ║
╠══════════════════════════════════════════════════════════╣
║  14:30  ✓ Antenna: Completed image preprocessing       ║
║  14:15  → APRS: Started test generation                 ║
║  13:45  ⚠ Pipecat: Blocked (missing dependency)         ║
║  13:30  ✓ eButterfly: Sheet export successful           ║
╚══════════════════════════════════════════════════════════╝
```

---

## TASK CLASSIFICATION & ROUTING

```python
# In scheduler.py

from enum import Enum
from dataclasses import dataclass

class TaskType(Enum):
    PLANNING = "planning"
    RESEARCH = "research"
    IMPLEMENTATION = "implementation"
    TESTING = "testing"
    REFACTORING = "refactoring"
    DOCUMENTATION = "documentation"
    DEBUGGING = "debugging"
    REVIEW = "review"

class Complexity(Enum):
    LOW = 1      # Boilerplate, simple changes
    MEDIUM = 2   # Standard implementation
    HIGH = 3     # Architecture, complex algorithms
    CRITICAL = 4 # Production bugs, security

@dataclass
class Task:
    project: str
    description: str
    task_type: TaskType
    complexity: Complexity
    requires_gpu: bool
    deadline: str
    
    def select_agent(self, available_agents):
        """Routing logic"""
        
        # Critical + high complexity → Claude (if credits)
        if self.complexity == Complexity.CRITICAL:
            if available_agents['claude'].credits > 10:
                return 'claude'
            else:
                # Fall back to Gemini for critical
                return 'gemini'
        
        # Planning/architecture → Claude or Gemini
        if self.task_type == TaskType.PLANNING:
            if available_agents['claude'].credits > 5:
                return 'claude'
            return 'gemini'
        
        # Implementation/testing → Qwen (local, fast, free)
        if self.task_type in [TaskType.IMPLEMENTATION, TaskType.TESTING]:
            return 'qwen'
        
        # ML tasks requiring GPU → Qwen on GPU VM
        if self.requires_gpu:
            return 'qwen'
        
        # Documentation → Qwen (good enough, free)
        if self.task_type == TaskType.DOCUMENTATION:
            return 'qwen'
        
        # Review → Gemini (fresh eyes)
        if self.task_type == TaskType.REVIEW:
            return 'gemini'
        
        # Default: Qwen (cheapest)
        return 'qwen'
```

---

## MONITORING & NOTIFICATIONS

### Push Notifications (ntfy.sh)
```python
# In state/tracker.py

import requests

def notify(self, event: str, project: str, details: str):
    """Send push notification to mobile"""
    requests.post(
        'https://ntfy.sh/mikes-dev-updates',
        headers={
            'Title': f'{event}: {project}',
            'Priority': 'default',
            'Tags': 'computer,clipboard'
        },
        data=details
    )

# Usage:
# Task completed
self.notify('✓ Complete', 'Antenna', 'Batch processing implemented')

# Task blocked
self.notify('⚠ Blocked', 'Pipecat', 'Missing API key')

# Credits low
self.notify('💰 Low Credits', 'Claude', 'Only 5 prompts remaining')
```

### Mobile Access
```python
# In dashboard/app.py (Flask)

from flask import Flask, render_template
import tailscale

app = Flask(__name__)

@app.route('/')
def index():
    """Main dashboard - accessible via Tailscale"""
    projects = get_active_projects()
    agents = get_agent_status()
    return render_template('dashboard.html', 
                         projects=projects,
                         agents=agents)

if __name__ == '__main__':
    # Only accessible via Tailscale network
    app.run(host='0.0.0.0', port=5000)
```

**Access from iPhone**: `http://devbox.tailscale:5000`

---

## STATE MANAGEMENT

### Database Schema (PostgreSQL)
```sql
-- Projects table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    priority INT NOT NULL,
    status VARCHAR(50),
    next_action TEXT,
    vm_id VARCHAR(100),
    requires_gpu BOOLEAN,
    model_preference VARCHAR(50),
    deadline TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    description TEXT NOT NULL,
    task_type VARCHAR(50),
    complexity INT,
    assigned_to VARCHAR(50),
    status VARCHAR(50),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    output_path TEXT,
    credits_used INT DEFAULT 0
);

-- Agent status table
CREATE TABLE agent_status (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR(50) UNIQUE NOT NULL,
    agent_type VARCHAR(50),
    vm_id VARCHAR(100),
    status VARCHAR(50),
    current_task_id INT REFERENCES tasks(id),
    credits_remaining INT,
    uptime_seconds INT,
    last_heartbeat TIMESTAMP DEFAULT NOW()
);

-- Metrics table (time series)
CREATE TABLE metrics (
    timestamp TIMESTAMP DEFAULT NOW(),
    metric_name VARCHAR(100),
    project VARCHAR(255),
    value NUMERIC,
    unit VARCHAR(50)
);
```

### CONTINUATION.md Pattern (Per Project)
```markdown
# Continuation State: Antenna ML Pipeline
Last Updated: 2025-12-31 14:30:00
Agent: Claude (VM1)
Credits Used: 450

## Current Task
Implement batch processing pipeline for insect image classification

## Progress
- [x] Set up image preprocessing module
- [x] Created batch loader
- [ ] Implement parallel processing with multiprocessing
- [ ] Add progress bar
- [ ] Write integration tests

## Context
Working in `src/antenna/processing/batch.py`. Using Django ORM for database queries. Need to maintain compatibility with existing single-image pipeline.

Key decisions:
- Batch size: 32 images
- Workers: 4 processes
- GPU usage: CUDA if available, CPU fallback

## Blockers
None currently

## Next Action
Implement multiprocessing pool in batch.py, ensure proper cleanup of resources. Verify memory usage stays under 8GB.

## References
- Original issue: #145
- Design doc: docs/antenna/batch-processing.md
- Related PR: #142 (single image pipeline)
```

---

## INTEGRATION WITH GOOGLE SHEETS

### Authentication Setup
```python
# In integrations/sheets.py

import gspread
from oauth2client.service_account import ServiceAccountCredentials

class SheetsClient:
    def __init__(self):
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        creds = ServiceAccountCredentials.from_json_keyfile_name(
            '/opt/cto-sidekick/credentials/sheets-api.json',
            scope
        )
        self.client = gspread.authorize(creds)
        self.sheet = self.client.open('CTO Sidekick - Projects')
    
    def get_active_projects(self):
        """Read projects from Sheet"""
        worksheet = self.sheet.worksheet('Projects')
        records = worksheet.get_all_records()
        
        return [
            Project(
                name=r['Project'],
                priority=r['Priority'],
                status=r['Status'],
                next_action=r['Next Action'],
                vm_id=r.get('VM', None),
                requires_gpu=r['GPU?'] == 'Yes',
                model_preference=r['Model']
            )
            for r in records
            if r['Status'] in ['In Progress', 'Queued']
        ]
    
    def update_status(self, project_name: str, status: str, details: str):
        """Write back to Sheet"""
        worksheet = self.sheet.worksheet('Projects')
        cell = worksheet.find(project_name)
        
        # Update Status column
        worksheet.update_cell(cell.row, 3, status)
        
        # Update Last Update column
        worksheet.update_cell(cell.row, 5, datetime.now().isoformat())
        
        # Append to activity log
        log_sheet = self.sheet.worksheet('Activity Log')
        log_sheet.append_row([
            datetime.now().isoformat(),
            project_name,
            status,
            details
        ])
```

### Alternative: GitHub Projects
```python
# If you prefer GitHub over Sheets

from github import Github

class GithubProjectsClient:
    def __init__(self):
        self.gh = Github(os.getenv('GITHUB_TOKEN'))
        self.repo = self.gh.get_repo('yourusername/cto-sidekick-tracking')
        self.project = self.repo.get_projects()[0]
    
    def get_active_tasks(self):
        """Read from GitHub Projects board"""
        columns = self.project.get_columns()
        in_progress = [c for c in columns if c.name == 'In Progress'][0]
        
        tasks = []
        for card in in_progress.get_cards():
            issue = card.get_content()
            tasks.append(Task.from_github_issue(issue))
        
        return tasks
```

**Recommendation**: **Use Google Sheets**. 
- Easier to edit on mobile
- No API rate limits
- Simpler for non-technical stakeholders
- Can use formulas for priorities

---

## DEPLOYMENT

### System Service Configuration
```ini
# /etc/systemd/system/cto-sidekick.service

[Unit]
Description=Mike's CTO Sidekick - Autonomous Development Orchestration
After=network.target postgresql.service libvirtd.service

[Service]
Type=simple
User=mike
Group=mike
WorkingDirectory=/opt/cto-sidekick
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
Environment="PYTHONPATH=/opt/cto-sidekick"
ExecStart=/usr/bin/python3 /opt/cto-sidekick/daemon.py
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cto-sidekick

[Install]
WantedBy=multi-user.target
```

### Installation Script
```bash
#!/bin/bash
# install.sh

set -e

echo "Installing Mike's CTO Sidekick..."

# 1. Install system dependencies
sudo apt update
sudo apt install -y \
    python3 python3-pip python3-venv \
    postgresql postgresql-client \
    libvirt-daemon-system qemu-kvm \
    docker.io

# 2. Create service directory
sudo mkdir -p /opt/cto-sidekick
sudo chown $USER:$USER /opt/cto-sidekick

# 3. Create virtual environment
cd /opt/cto-sidekick
python3 -m venv venv
source venv/bin/activate

# 4. Install Python dependencies
pip install \
    gspread oauth2client \
    psycopg2-binary sqlalchemy \
    flask fastapi uvicorn \
    requests pyyaml \
    libvirt-python

# 5. Create database
sudo -u postgres psql << EOF
CREATE DATABASE cto_sidekick;
CREATE USER cto_user WITH PASSWORD 'changeme';
GRANT ALL PRIVILEGES ON DATABASE cto_sidekick TO cto_user;
EOF

# 6. Initialize database schema
python init_db.py

# 7. Create config file
cp config.yaml.example config.yaml
nano config.yaml  # Edit as needed

# 8. Install systemd service
sudo cp cto-sidekick.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cto-sidekick
sudo systemctl start cto-sidekick

echo "Installation complete!"
echo "Dashboard: http://localhost:5000"
echo "Logs: journalctl -u cto-sidekick -f"
```

---

## CONFIGURATION FILE

```yaml
# /opt/cto-sidekick/config.yaml

# Google Sheets
sheets:
  credentials: /opt/cto-sidekick/credentials/sheets-api.json
  spreadsheet_name: "CTO Sidekick - Projects"
  sync_interval: 60  # seconds

# Database
database:
  host: localhost
  port: 5432
  name: cto_sidekick
  user: cto_user
  password: changeme

# VM Management
vms:
  provider: libvirt  # or 'proxmox'
  template: ubuntu-dev-template
  max_vms: 10
  idle_shutdown: 3600  # seconds (1 hour)
  
  # GPU VM (dedicated Qwen server)
  qwen_vm:
    name: qwen-inference-server
    ram: 32768
    vcpus: 16
    gpus: [0, 1]  # Both RTX 3090s
    autostart: true

# Agents
agents:
  claude:
    enabled: true
    runner: docker  # or 'vm', 'native'
    image: textcortex/claude-code-sandbox
    credit_threshold: 5  # Stop if credits below this
    
  qwen:
    enabled: true
    model: qwen2.5-coder:32b
    endpoint: http://qwen-vm:8000
    
  gemini:
    enabled: true
    api_key_env: GEMINI_API_KEY
    daily_limit: 500  # requests

# Scheduler
scheduler:
  check_interval: 60  # seconds
  max_concurrent_tasks: 3
  
  # Task routing preferences
  routing:
    planning: claude      # If credits available
    implementation: qwen  # Always
    testing: qwen         # Always
    review: gemini        # Always
    documentation: qwen   # Always

# Dashboard
dashboard:
  enabled: true
  host: 0.0.0.0
  port: 5000
  
# Notifications
notifications:
  ntfy:
    enabled: true
    topic: mikes-dev-updates
    
  # Email (optional)
  email:
    enabled: false
    smtp_host: smtp.gmail.com
    from: cto-sidekick@yourdomain.com

# Monitoring
monitoring:
  metrics_retention_days: 90
  log_level: INFO
```

---

## PHASED IMPLEMENTATION PLAN

### Phase 1: Core Foundation (Week 1)
**Goal**: Basic orchestration working

**Tasks**:
1. Set up project structure
2. Implement Google Sheets integration
3. Create basic scheduler (priority queue)
4. Implement Docker-based Claude runner
5. Create simple Flask dashboard
6. Database schema + migrations
7. State tracking (CONTINUATION.md pattern)

**Deliverable**: Can start single Claude agent based on Sheet priority

### Phase 2: VM Infrastructure (Week 2)
**Goal**: Multi-project VM isolation

**Tasks**:
1. Create Ubuntu dev template VM
2. Implement VM cloning/lifecycle management
3. Set up Qwen GPU VM with passthrough
4. Network configuration (VMs can talk to each other)
5. Project directory mounting (NFS or 9p)
6. VM monitoring (resource usage)

**Deliverable**: Each project runs in isolated VM

### Phase 3: Multi-Model Integration (Week 3)
**Goal**: Intelligent task routing

**Tasks**:
1. Implement Qwen MCP server on GPU VM
2. Gemini API integration
3. Task classification logic
4. Multi-model routing in scheduler
5. Credit tracking per model
6. Cost optimization logic

**Deliverable**: Tasks automatically routed to best model

### Phase 4: Monitoring & Polish (Week 4)
**Goal**: Production-ready system

**Tasks**:
1. Enhanced dashboard (resource graphs, timeline)
2. Mobile notifications (ntfy.sh)
3. Tailscale integration for remote access
4. Error handling + retry logic
5. Logging + metrics collection
6. Documentation
7. Backup/restore procedures

**Deliverable**: Fully autonomous, remotely monitored system

---

## SUCCESS CRITERIA

The system is **working** when:

1. ✅ You can add a project to Google Sheet with priority
2. ✅ Daemon automatically picks it up within 1 minute
3. ✅ Agent (Claude/Qwen/Gemini) starts working autonomously
4. ✅ Progress updates appear in Sheet automatically
5. ✅ You get push notification on completion
6. ✅ Can check status from iPhone via Tailscale dashboard
7. ✅ VMs auto-start/stop based on workload
8. ✅ GPU VM serves Qwen to all project VMs
9. ✅ Claude credits optimized (only used for complex work)
10. ✅ System runs 24/7 without intervention

The system is **excellent** when:

11. ✅ Can resume any project instantly after days/weeks
12. ✅ Multi-model pipelines work (Claude plans → Qwen implements → Gemini reviews)
13. ✅ Automatic re-prioritization based on deadlines
14. ✅ Cost per project tracked accurately
15. ✅ Zero manual task routing decisions needed

---

## RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| VM sprawl (too many VMs) | Resource exhaustion | Auto-shutdown after 1hr idle, max 10 VMs |
| Claude credit depletion | Work stops | Automatic fallback to Qwen, credit alerts at 25% |
| Sheet API rate limits | Sync delays | Cache Sheet data, sync every 60s not 1s |
| GPU VM crash | Qwen unavailable | Health checks, auto-restart, graceful degradation to API |
| Network issues | Agents can't communicate | Retry logic, queue tasks for later |
| Database corruption | State loss | Daily backups, WAL archiving |
| Runaway agent | Infinite loops | Timeout per task (4 hours max), resource limits |

---

## FUTURE ENHANCEMENTS

**Beyond MVP**:
- **Voice control**: "Hey CTO, prioritize Antenna project"
- **Smart scheduling**: Learn when you're most likely to review PRs
- **Dependency tracking**: Auto-block tasks if dependencies incomplete
- **Cost budgets**: Alert if monthly spend exceeds threshold
- **Team collaboration**: Multiple developers, shared Sheet
- **CI/CD integration**: Auto-deploy when tests pass
- **Slack integration**: Status updates in Slack channel

---

## ESTIMATED EFFORT

**Development Time**:
- Phase 1 (Core): 40 hours
- Phase 2 (VMs): 30 hours
- Phase 3 (Multi-model): 25 hours
- Phase 4 (Polish): 20 hours

**Total**: ~115 hours = 3-4 weeks full-time, or 6-8 weeks part-time

**Ongoing Maintenance**: 2-4 hours/week (Sheet updates, config tweaks, new projects)

---

## CONCLUSION

This system transforms your development workflow from:

**Before**: Manual context switching, credit management, babysitting agents
**After**: Set priorities in Sheet, walk away, get notifications when done

**Key Innovation**: Using VMs for true multi-project isolation + GPU passthrough for local Qwen, orchestrated by priority-driven daemon reading from Google Sheets.

**Next Steps**:
1. Review this plan
2. Set up Google Sheets template
3. Create Ubuntu dev VM template
4. Start Phase 1 implementation (core daemon)

---

*Last Updated: 2025-12-31*
*Author: Claude (assisting Mike)*
