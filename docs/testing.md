# Testing

The applications have different tests. The unit tests and end-to-end tests run in CI after creating a pull request. Therefore, pull requests can only be merged if all tests have passed.

## Unit testing

For unit testing we use [Jest](https://jestjs.io/). You can run the tests with the following command:

    npm run test

### Running the researcher tests in the agent sandbox

Jest transforms this app's TypeScript with SWC, the Rust compiler Next.js uses in place of Babel. SWC is a native binary, and npm installs only the one matching the machine that ran the install. A `node_modules` populated on macOS therefore holds `@next/swc-darwin-arm64` and nothing else, and on linux/arm64 Jest exits before running a test:

    Failed to load SWC binary for linux/arm64

The linux/arm64 build sits in the shared toolchain. Point node at it:

    NODE_PATH="$PWD/../workbench/toolchain/linux-arm64/next-swc/14.2.25" npm test --workspace=apps/researcher

The path has to be absolute. Jest runs each test file in a worker whose working directory is `apps/researcher`, not the repo root, so a relative `NODE_PATH` resolves somewhere else and the binary goes missing again — with the same error message, which is what makes it worth writing down.

The version directory must match the `next` version in `package.json`; a mismatch is what the path is there to make visible. On a Mac, leave `NODE_PATH` unset.

`npm run compile` needs none of this. `tsc` is itself JavaScript, so type errors surface in the sandbox whether or not the tests can run.

## Integration testing

For integration testing we use [Jest](https://jestjs.io/). You can run the tests with the following command:

    npm run test:integration

Beware: the integration tests are not run in CI. The application does not have its own, isolated search APIs to test against, so test runs on CI could fail due to e.g. connectivity issues with the external search APIs.

## End-to-end testing

For end-to-end testing we use [Playwright](https://playwright.dev/). You can run the tests with the following command:

    npm run test:e2e

For writing and debugging tests, you can use [UI mode](https://playwright.dev/docs/test-ui-mode) with the command:

    npm run test:e2e:open

### Writing end-to-end tests

We use the attribute **data-testid** to make it easier to target elements.

If you need to forward the data-testid to a component, use the component attribute `testId`. See the [badge component](https://github.com/colonial-heritage/dataset-browser/blob/main/src/components/badge.tsx) for an example.
