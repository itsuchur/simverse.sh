FROM python:3.14-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY mcp_simverse ./mcp_simverse
COPY main.py ./
RUN uv sync --frozen --no-dev

ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4000/health')"

CMD ["uv", "run", "--no-dev", "python", "main.py"]
