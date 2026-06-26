# Installation and maintenance guide

This project uses the top-level Makefile as the main entry point for building,
running, and maintaining the dashboard.

## Prerequisites

Install the following tools:

1. Docker
2. Docker Compose provider
3. GNU Make

Clone the repository and move to its root:

```sh
git clone git@github.com:iterorganization/SimDB-Dashboard.git
cd SimDB-Dashboard
```

To see all available commands:

```sh
make help
```

## Main installation workflow (Docker image + Compose)

From the repository root:

1. Build the production service image:

```sh
make service
```

2. Start the dashboard container:

```sh
make up
```

3. Open the dashboard:

```text
http://localhost:80/dashboard/
```

Stop the service when needed:

```sh
make down
```

Did something change in the `docker-compose.yml` or `docker/*` files? Stop the service, and restart service (rebuild not necessary):

```sh
make down up
```

Changed something in the `dashboard/*` sources? (e.g. after a `git pull`.) Stop the service, rebuild the service image (dependencies are cached) and restart the service:

```sh
make down service up
```

If Docker cache appears stale during development, rebuild the service image without cache:

```sh
make down service-nocache up
```

Notes:

- `make up` starts Compose using the prebuilt `simdb-dashboard:service` image.
- Requests under `/scenarios/api/` are proxied by nginx to a backend expected at
  `host.docker.internal:5000`.
- `/api/` is also kept as a local/development compatibility alias.
- You can restart and change the host port with `DASHBOARD_PORT`, for example:

```sh
DASHBOARD_PORT=8080 make down up
```

- You can change the internal nginx proxy target for the SimDB server with `API_HOST` and/or `API_PORT` (default is host.docker.internal:5000). The browser still talks to the dashboard via the relative `/scenarios/api` endpoint, matching production nginx:

```sh
DASHBOARD_PORT=8081 API_PORT=5001 make down up
DASHBOARD_PORT=8082 API_HOST=172.20.0.1 API_PORT=5001 make down up
```

- The default browser-facing endpoint is `/scenarios/api`. Override `PUBLIC_SIMDB_URL` only if the browser should call a different SimDB endpoint directly, for example:

```sh
PUBLIC_SIMDB_URL=https://simdb.iter.org/scenarios/api make down up
```

In most deployments, prefer the default `/scenarios/api` value and configure `API_HOST`/`API_PORT` for the nginx proxy. That avoids browser CORS and mixed-content issues while matching production routing.

## Static artifact installation (non-Compose nginx deployments)

If you want to deploy static files to an existing nginx host:

1. Build and export frontend artifacts:

```sh
make dist
```

This creates `dist/` at the repository root containing the built app.

2. Copy artifacts to your web root (example path):

```sh
sudo cp -r dist/* /www/data/
```

With the Dockerfile defaults, assets are served under `/dashboard`, so the final
index path should be `/www/data/dashboard/index.html`.

## nginx configuration

Use a location block that falls back to the SPA entry point:

```nginx
root /www/data;

location /dashboard {
    try_files $uri $uri.html /dashboard/index.html;
}
```

This is required for client-side routes under `/dashboard/*`.

## Maintenance and verification

Use Makefile targets for quality checks and updates:

```sh
make lint         # run lint stage in Docker
make type-check   # run Vue/TypeScript type-check stage in Docker
make test         # run unit tests in Docker
make update-base  # rebuild service image pulling latest base images
make update-deps  # refresh package-lock and apply npm audit fixes
make distclean    # remove local images/artifacts and compose runtime state
```
