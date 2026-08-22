# Contributing to ShipFree

Thank you for considering contributing to ShipFree! We welcome contributions from the community.

## How to Contribute

1. **Fork the repository**: Click the "Fork" button at the top right of the repository page.

2. **Clone your fork**:

   ```sh
   git clone https://github.com/your-username/shipfree.git
   cd shipfree
   ```

3. **Set up your development environment**:

   Requires [Bun](https://bun.sh) 1.2+ and [Docker Desktop](https://docs.docker.com/desktop/) (running).

   ```sh
   bun install
   cp .env.example .env
   bun run setup     # starts Postgres, applies migrations
   bun dev           # http://localhost:3000
   ```

   That is a one-time setup. On later sessions just run `bun run db:up && bun dev`.

   No third-party API keys are needed — emails print to the console and billing
   is off by default. See [docs/quickstart.mdx](docs/quickstart.mdx) for the full
   walkthrough and [docs/troubleshooting.mdx](docs/troubleshooting.mdx) if a step
   fails.

   If your change touches `src/database/schema.ts`, run `bun run generate-migration`
   and commit the generated files in `migrations/` with your change.

4. **Create a branch**:

   ```sh
   git checkout -b my-feature-branch
   ```

5. **Make your changes**: Implement your feature or bug fix.

6. **Commit your changes**:

   ```sh
   git add .
   git commit -m "Description of your changes"
   ```

7. **Push to your fork**:

   ```sh
   git push origin my-feature-branch
   ```

8. **Create a Pull Request**: Go to the original repository and click the "New Pull Request" button.

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Reporting Issues

If you find a bug or have a feature request, please create an issue on GitHub.

Thank you for your contributions!