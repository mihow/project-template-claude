# syntax=docker/dockerfile:1
#
# Multi-stage Dockerfile for Python applications using uv
#
# Dependencies are installed from uv.lock, so the image matches local installs.
#
# Build: docker build -t my-project .
# Run:   docker run --rm my-project
#

# =============================================================================
# Base stage: Python with a pinned uv
# =============================================================================
FROM python:3.12-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# =============================================================================
# Dependencies stage: runtime dependencies and the package itself
# =============================================================================
FROM base AS dependencies

# Third-party dependencies first, so this layer is reused until the lock changes
COPY pyproject.toml uv.lock README.md LICENSE ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Then the project, installed into the venv (not editable) so that the
# production stage only needs /opt/venv
COPY src/ ./src/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable

# =============================================================================
# Development stage: dev dependencies, editable install
# =============================================================================
FROM base AS development

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

CMD ["pytest", "-v"]

# =============================================================================
# Test stage: run tests during build
# =============================================================================
FROM development AS test

RUN pytest -v --tb=short

# =============================================================================
# Production stage: minimal image, non-root user
# =============================================================================
FROM python:3.12-slim AS production

RUN groupadd --gid 1000 app && \
    useradd --uid 1000 --gid 1000 --shell /bin/bash --create-home app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_ENV=production

WORKDIR /app

COPY --from=dependencies /opt/venv /opt/venv

USER app

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "from my_project import __version__; print(__version__)" || exit 1

CMD ["my-project", "info"]

LABEL org.opencontainers.image.title="my-project" \
      org.opencontainers.image.description="A Claude-first Python application" \
      org.opencontainers.image.source="https://github.com/yourusername/my-project"
