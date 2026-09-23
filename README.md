# Sawubona

The Sawubona Commons datahub: the researcher application, its workspace
packages, and the container image the Hetzner deployment runs. Search and the
object pages read an Elasticsearch index on Voyager, written from a Tabulous
delivery; community enrichments are Nanopublications.

A fork of the Colonial Collections datahub
([colonial-heritage](https://github.com/colonial-heritage)), with no upstream
remote — the two have diverged. The infrastructure lives in the separate
`devops` repository; `docs/` covers the index and the data we receive.

## Development

### Develop without Docker

#### Prerequisites

1. Node.js version 22
1. NPM version 10+

The following commands will run for all the workspaces. If you want to run a command for one workspace add the `-w` argument. For example, to add a package to the researcher app:

    npm install myPackage --save-exact -w researcher

#### Install packages

    npm install

#### Before pushing

    npm run verify

Runs everything CI runs, in CI's order — lint, the RSC boundary check, tests,
compile, the enrichment scripts, and the production build — stopping at the
first failure and writing the whole output to `tmp/verify.log`. Two pushes on
2026-09-23 went red for things already true on disk; both would have been
caught here in a couple of minutes.

#### Run development server

    npm run dev

Open the datahub on [http://localhost:3001](http://localhost:3001).

#### Create production build (for testing locally)

Create the file `apps/researcher/.env.production.local` and set the endpoint URLs:

    SEARCH_ENDPOINT_URL=
    NANOPUB_WRITE_ENDPOINT_URL=
    NANOPUB_WRITE_PROXY_ENDPOINT_URL=
    NANOPUB_SPARQL_ENDPOINT_URL=
    GEONAMES_USERNAME=

Then run:

    npm run build

#### Run production server (for testing locally)

    npm run start

### Develop with Docker

#### Install packages

    docker run --rm -it -v "$PWD":/app -w /app node:22 npm install --no-progress

#### Run container

    docker run --rm -it -v "$PWD":/app -w /app --env-file .env.local node:22 /bin/bash

#### Connect to the MySQL server

Add the environment variable `DATABASE_URL` to `apps/researcher/.env.local`. More information about connecting to the database is in the [database readme](packages/database/README.md).

#### Use the Nanopublications infrastructure for storing and retrieving user enrichments

Add the environment variables `NANOPUB_WRITE_ENDPOINT_URL`, `NANOPUB_WRITE_PROXY_ENDPOINT_URL` and `NANOPUB_SPARQL_ENDPOINT_URL` to `apps/researcher/.env.local`.

#### Run development server

    docker run --rm -it -v "$PWD":/app -w /app -p 3000:3000 -p 3001:3001 node:22 npm run dev

Open the datahub on [http://localhost:3001](http://localhost:3001).

#### Create production build (for testing locally)

Create the file `.env.production.local` in the root and set the endpoint URLs:

    SEARCH_ENDPOINT_URL=
    NANOPUB_WRITE_ENDPOINT_URL=
    NANOPUB_WRITE_PROXY_ENDPOINT_URL=
    NANOPUB_SPARQL_ENDPOINT_URL=
    GEONAMES_USERNAME=

Then run:

    docker run --rm -it -v "$PWD":/app -w /app node:22 npm run build

#### Run production server (for testing locally)

    docker run --rm -it -v "$PWD":/app -w /app -p 3000:3000 -p 3001:3001 node:22 npm run start
