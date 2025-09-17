# Scavenger Hunt Game - Implementation Guide

## 📄 Project Awareness & Context
- **Always read `PLANNING.md`** at the start of a new conversation to understand the project's architecture, goals, style, and constraints.
- **Check `TASKS.md`** before starting a new task. If the task isn't listed, add it with a brief description and today's date.
- **Product documents** are stored in directory docs and its subdirectories. Make sure you read and apply solutions to align with PRDs.
  If task contradicts the product docs, raise it as a risk
- **Use consistent naming conventions, file structure, and architecture patterns** as described in `PLANNING.md`.

## 🧱 Code Structure & Modularity
- **Never create a file longer than 500 lines of code.** If a file approaches this limit, refactor by splitting it into modules or helper files.

## 🧪 Testing & Reliability

### Test Organization

- Place unit tests alongside source files using `.test.ts` or `.spec.ts` suffix convention
- Use `__tests__` directories for grouping related test files when appropriate
- Keep integration tests in a separate `test/` or `e2e/` directory at project root
- Organize test files to mirror source code structure for easy navigation
- Use descriptive test names following the pattern: `should [expected behavior] when [condition]`

### Testing Best Practices

- Always test error paths, edge cases, and boundary conditions, not just happy paths
- Use `describe` blocks to group related tests and provide context
- Follow the AAA pattern: Arrange, Act, Assert for clear test structure
- Leverage parameterized tests with `it.each()` or `test.each()` for testing multiple scenarios
- Keep tests independent - each test should be able to run in isolation
- Use `beforeEach()` and `afterEach()` for consistent test setup and teardown
- Avoid testing implementation details - focus on behavior and public APIs

### Testing Frameworks & Tools

- Use Jest or Vitest as primary testing frameworks for their rich ecosystem
- Leverage TypeScript's type checking in tests - avoid `@ts-ignore` or `any` types
- Use `tsx` or `ts-node` for running TypeScript tests without compilation step
- Enable strict type checking in test files with `"strict": true` in tsconfig
- Consider using `@types/jest` or `@vitest/ui` for enhanced IDE support

### Async Testing

- Use `async/await` syntax for testing asynchronous code
- Set appropriate timeouts for async operations: `jest.setTimeout()` or test-specific timeouts
- Test both resolved and rejected promise scenarios
- Use `waitFor` utilities from testing libraries for DOM or state changes
- Be careful with fake timers - use `jest.useFakeTimers()` and `jest.runAllTimers()` correctly
- Test race conditions and concurrent operations when applicable

### Error Handling in Tests

- Use `expect().toThrow()` or `expect().rejects.toThrow()` for testing exceptions
- Create custom matchers for domain-specific error assertions
- Test error messages and error types, not just that an error occurred
- Use try-catch blocks sparingly - prefer Jest's built-in error assertions
- Validate error recovery and fallback mechanisms

### Mocking & Test Doubles

- Use `jest.mock()` or `vi.mock()` for module mocking
- Prefer dependency injection over module mocking when possible
- Create factory functions for generating test data consistently
- Use `jest.spyOn()` for spying on existing implementations
- Reset mocks between tests using `jest.clearAllMocks()` or `beforeEach()` hooks
- Use libraries like `msw` for mocking HTTP requests instead of mocking fetch/axios directly
- Avoid over-mocking - test real implementations when reasonable

### Test Data Management

- Use factory functions or builders for creating test objects
- Leverage libraries like `faker.js` or `@faker-js/faker` for generating realistic test data
- Keep test fixtures in separate files when they grow large
- Use snapshot testing judiciously - only for stable, deterministic outputs
- Version control test data and fixtures alongside code

### Integration Testing

- Test API endpoints with `supertest` for Express/Node.js applications
- Use Playwright or Cypress for end-to-end browser testing
- Test database operations with test databases or in-memory alternatives
- Use Docker containers for testing with real external dependencies
- Implement health checks and smoke tests for production deployments

### Performance Testing

- Use `jest.performance` or dedicated tools like `benchmark.js` for micro-benchmarks
- Profile memory usage with heap snapshots and Chrome DevTools
- Test with production-like data volumes and concurrency levels
- Monitor test execution time and fail tests that exceed thresholds
- Use `console.time()` and `console.timeEnd()` for quick performance checks

### Coverage & Quality

- Aim for high code coverage but prioritize meaningful tests over coverage percentage
- Use `nyc` or built-in Jest coverage with Istanbul for coverage reporting
- Configure coverage thresholds in `jest.config.js` or `vitest.config.ts`
- Exclude generated files and type definitions from coverage reports
- Focus on branch coverage and path coverage, not just line coverage

### Testing Type Safety

- Test TypeScript types using `tsd` or `expect-type` libraries
- Verify type inference works correctly for generic functions
- Test discriminated unions and type guards thoroughly
- Use `// @ts-expect-error` to test that invalid code fails type checking
- Create type-level tests for complex type utilities

### CI/CD Integration

- Run tests in CI with `--ci` flag for optimized output
- Use parallel test execution when possible: `--maxWorkers=50%`
- Cache `node_modules` and build artifacts between CI runs
- Run different test suites in parallel CI jobs (unit, integration, e2e)
- Generate and archive test reports and coverage reports
- Fail fast on critical test failures but collect all results for analysis

### Common Testing Anti-patterns to Avoid

- Don't test private methods directly - test through public interfaces
- Avoid shared mutable state between tests
- Don't use real network calls or file system in unit tests
- Avoid time-dependent tests - mock `Date.now()` or use fixed timestamps
- Don't write tests that depend on test execution order
- Avoid excessive setup code - it might indicate design issues
- Don't ignore flaky tests - fix them or remove them
- Avoid testing third-party library behavior
- Don't use production configurations or credentials in tests

### Testing Best Practices Checklist

- [ ] Each test has a single, clear assertion
- [ ] Test names clearly describe what is being tested
- [ ] Tests are deterministic and reproducible
- [ ] No console.log statements left in tests
- [ ] Mocks are properly cleaned up after each test
- [ ] Async operations are properly awaited
- [ ] Error cases are thoroughly tested
- [ ] Tests run quickly (< 100ms for unit tests)
- [ ] No hardcoded values that might change
- [ ] Tests document behavior through their structure

## ✅ Task Completion
- **Mark completed tasks in `TASKS.md`** immediately after finishing them.
- Add new sub-tasks or TODOs discovered during development to `TASKS.md` under a "Discovered During Work" section.

## 🔎 Style & Conventions

### Code Formatting
- **Prettier Configuration**: Uses single quotes, semicolons, and trailing commas for consistent formatting
- **Quote Style**: Single quotes (`'`) for strings, consistent with ESLint configuration
- **Line Length**: 100 characters maximum
- **Indentation**: 2 spaces, no tabs

### Naming Conventions

- Use camelCase for functions, variables, and method names
- Use PascalCase for classes, interfaces, types, enums, and type parameters
- Use SCREAMING_SNAKE_CASE for global constants and enum members
- Prefix private properties with underscore: _privateProperty (though # private fields are preferred)
- Prefix interfaces with 'I' only when necessary to avoid naming conflicts
- Use descriptive names over abbreviations (prefer calculateTotal over calcTot)
- Boolean variables should start with is, has, can, should, etc.

### Error Handling Patterns

- Create custom error classes extending Error with proper stack traces
- Use discriminated unions for error types (type Result<T, E> = { ok: true; value: T } | { ok: false; error: E })
- Implement proper error boundaries in React applications
- Use try-catch blocks with specific error types, not generic catch-all
- Consider libraries like neverthrow or ts-results for functional error handling
- Always handle Promise rejections - use .catch() or try-catch with async/await

### Types & Type Safety

- Prefer unknown over any for truly unknown types
- Use type predicates (is functions) for runtime type checking
- Leverage const assertions for literal types: as const
- Use branded types or nominal typing for domain primitives
- Prefer interfaces for object shapes that might be extended
- Use type aliases for unions, intersections, and utility types
- Enable strict mode in tsconfig.json (strict: true)

### API Design

- Make invalid states unrepresentable using discriminated unions
- Use builder pattern with method chaining for complex object construction
- Provide both synchronous and asynchronous versions when appropriate
- Use function overloads to provide better type inference
- Design APIs with exhaustiveness checking using never type
- Prefer readonly arrays and objects in function parameters
- Use generics with constraints rather than any or unknown when possible

### Documentation

- Write JSDoc comments for all exported functions, classes, and types
- Include @example tags with usage examples in JSDoc
- Document @throws for exceptions and @returns for return values
- Use @deprecated tag for deprecated APIs with migration instructions
- Generate documentation with TypeDoc or similar tools
- Document generic type parameters with @template tags

### Module Organization

- One export per file for major components/classes (prefer named exports)
- Group related functionality in barrel exports (index.ts files)
- Use path mapping in tsconfig.json for clean imports (@/components/*)
- Keep modules focused on a single responsibility
- Avoid circular dependencies - use dependency injection when needed
- Organize by feature rather than by file type in larger applications

### Async Patterns

- Always handle Promise rejections to avoid unhandled rejection warnings
- Use async/await over Promise chains for better readability
- Implement proper cancellation with AbortController for fetch requests
- Avoid mixing callbacks and Promises - pick one pattern
- Use Promise.allSettled() when you need all results regardless of failures
- Consider AsyncIterator for streaming data patterns

### Performance & Memory

- Use const for immutable bindings, let for mutable ones (avoid var)
- Prefer object/array destructuring over repeated property access
- Use Map and Set over plain objects when appropriate
- Implement lazy loading and code splitting in large applications
- Be mindful of closure memory leaks in event handlers
- Use WeakMap and WeakSet for metadata that shouldn't prevent garbage collection

### Common Pitfalls to Avoid

- Don't use == or != - always use === and !==
- Avoid modifying Array.prototype or other built-in prototypes
- Don't rely on automatic semicolon insertion - be explicit
- Avoid delete operator on objects - use omit utilities or set to undefined
- Be careful with this binding - use arrow functions or .bind()
- Don't ignore TypeScript errors with @ts-ignore - use @ts-expect-error with explanation
- Avoid namespace and module declarations - use ES modules
- Don't use Function constructor or eval for dynamic code

### Tooling & Configuration

- Use ESLint with @typescript-eslint plugin for linting
- Configure Prettier for consistent code formatting
- Enable incremental compilation in tsconfig.json for faster builds
- Use source maps for debugging (sourceMap: true)
- Configure module resolution to 'node' or 'bundler' based on target
- Set up pre-commit hooks with husky and lint-staged
- Use ts-node or tsx for running TypeScript directly in development

### Framework-Specific Patterns

**React/Next.js:**
- Prefer function components with hooks over class components
- Use proper TypeScript types for props, state, and context
- Implement proper error boundaries for error handling
- Type event handlers correctly (React.MouseEvent<HTMLButtonElement>)

**Node.js/Express:**
- Type request and response objects with proper generics
- Use middleware typing for better type inference
- Implement proper error handling middleware
- Type environment variables with a schema validator like zod

**Testing:**
- Place test files adjacent to source files (*.test.ts or *.spec.ts)
- Use testing-library for React components
- Mock modules with proper types using jest.mocked()
- Type test fixtures and test data properly

## 📚 Documentation & Explainability
- Use relevant agent `documentation-manager` to maintain documentations
- **Update `README.md`** when new features are added, dependencies change, or setup steps are modified.
- **Comment non-obvious code** and ensure everything is understandable to a mid-level developer.
- When writing complex logic, **add an inline `# Reason:` comment** explaining the why, not just the what.

## 🧠 AI Behavior Rules
- **Never assume missing context. Ask questions if uncertain.**
- **Never hallucinate libraries or functions** – only use known, verified packages.
- **Always confirm file paths and module names** exist before referencing them in code or tests.
- **Never delete or overwrite existing code** unless explicitly instructed to or if part of a task from `TASKS.md`.

## 🔒 Validation Requirements

### Automatic Validation Triggers

This project uses automated validation agents to ensure code quality. The following triggers should invoke validation:

#### TypeScript Projects
When ANY of the following occur:
- Files matching `*.ts`, `*.tsx`, `*.js`, `*.jsx` are modified
- Package.json dependencies are updated
- TSConfig.json is modified
- Any test files (`*.test.ts`, `*.spec.ts`) are changed
- Build configuration files are updated

**Automatic Agent Invocation:**

@typescript-validation-gates

### Validation Command Mapping

The following commands should automatically trigger validation:

| Command Pattern | Agent to Invoke |
|----------------|-----------------|
| `npm test`, `yarn test`, `pnpm test` | @typescript-validation-gates |
| `npm run build`, `yarn build` | @typescript-validation-gates |
| Any commit message containing "feat:", "fix:", "refactor:" | @typescript-validation-gates |

### Post-Implementation Validation Protocol

After completing ANY of the following tasks, the appropriate validation agent MUST be invoked:

1. **Feature Implementation**
   - New functions/methods added
   - New components created
   - API endpoints implemented
   - State management changes

2. **Bug Fixes**
   - Any code modification addressing a bug
   - Error handling improvements
   - Type error resolutions

3. **Refactoring**
   - Code structure changes
   - Type definition updates
   - Module reorganization
   - Performance optimizations

4. **Dependency Updates**
   - Package additions/removals
   - Version updates
   - Lock file changes

### Validation Success Criteria

Code changes are ONLY considered complete when:
- All validation gates pass (100% success rate)
- No TypeScript errors exist
- Test coverage meets or exceeds 80%
- No ESLint errors or warnings
- Build succeeds without warnings
- All security audits pass

### Agent Invocation Examples

```bash
# After implementing a new feature
"I've added the new user authentication feature"
→ Automatically invoke: @typescript-validation-gates

# After fixing a bug
"Fixed the null pointer issue in the data processor"
→ Automatically invoke: @typescript-validation-gates

# Generic code change
"Update the API client to handle retries"
→ Automatically invoke: @typescript-validation-gates
```

## Integrity of code
Any change to the codebase will be followed by a complete execution of the Validation Gates. Use the relevant agent for execution.

## 🤝 Work with GitHub

- **Create brach for every task**, do not work directly on `main` branch. Each feature or bugfix must be handled on a separate branch.
- **Create a PR**, Do not continue directly to resolve the issue and merge the changes.
- Check the **CI build** completed successfully before reporting task as completed.
