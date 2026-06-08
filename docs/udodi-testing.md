# Testing

Udodi is designed to support both low-level runtime testing and high-level browser integration testing.

The recommended testing strategy is:

| Test Type | Purpose |
|---|---|
| Unit Tests | Verify isolated runtime behavior |
| DOM Tests | Validate directive behavior and DOM updates |
| Integration Tests | Verify component interaction and lifecycle behavior |
| Browser Playground Tests | Validate real browser runtime behavior |
| Performance Tests | Benchmark reactivity and rendering speed |

---

## Test Structure

All tests are located in the `tests/` directory:

```bash
tests/
├── unit/
├── directives/
│   ├── text.test.js
│   ├── bind.test.js
│   ├── if.test.js
│   └── for.test.js
├── reactivity/
│   ├── signal.test.js
│   ├── computed.test.js
│   └── watcher.test.js
└── integration/
    └── component-lifecycle.test.js
```

---

## Running Tests

Udodi uses **Vitest** for testing. Here are the most useful commands:

### Vitest Commands

| Command                                     | Purpose                                              |
|---------------------------------------------|------------------------------------------------------|
| `npm test`                                  | Run all tests once                                   |
| `npm run test:watch`                        | Watch mode (reruns on file changes)                  |
| `npm run test:ui`                           | Beautiful browser UI                                 |
| `npx vitest list`                           | List all discovered test files                       |
| `npx vitest tests/unit/tokenizer.test.js`   | Run specific test file                               |
| `npx vitest -t "Tokenizer"`                 | Run tests matching a name pattern                    |

---

## Recommended Testing Stack

### Unit + DOM Testing

Udodi works very well with:

- Vitest
- happy-dom

happy-dom is significantly faster than many browser-like DOM environments and is ideal for reactive runtime testing.

Recommended areas to test include:

- reactive propagation
- directive updates
- event bindings
- component mounting
- list rendering
- overlays and modals
- lifecycle cleanup
- scheduler behavior

---

## Why happy-dom?

Udodi performs direct DOM updates and fine-grained reactive mutations.

happy-dom is a strong fit because it provides:

- fast DOM execution
- lightweight browser emulation
- good event support
- modern DOM APIs
- efficient test startup time
- lower memory overhead

This makes it particularly useful for testing runtime-heavy UI libraries.

---

## Test Directory Structure

Recommended structure:

- components
- directives
- integration
- reactivity
- stores
- overlays
- queries
- utils
- fixtures

A clean separation of runtime domains helps keep tests maintainable as the framework grows.

---

## Global Test Setup

A shared test setup should:

- reset the DOM between tests
- clean up mounted components
- remove overlays/modals
- clear subscriptions and watchers
- reset global stores if necessary

This prevents state leakage and cross-test interference.

---

## Testing Philosophy

Udodi intentionally favors deterministic runtime behavior.

Tests should primarily validate:

- DOM correctness
- reactive propagation
- cleanup guarantees
- scheduler consistency
- predictable directive behavior

Avoid over-testing private implementation details.

Prefer testing:

- rendered output
- observable runtime effects
- lifecycle behavior
- state transitions

instead of internal runtime structure.

---

## Component Testing

Component tests should validate:

- initial rendering
- reactive updates
- lifecycle behavior
- prop updates
- nested component rendering
- cleanup behavior

Focus on how components behave from the consumer perspective.

---

## Directive Testing

Each directive should be tested independently.

Recommended directive coverage includes:

### Rendering Directives

- @text
- @if
- @show
- @for

### Reactive Binding Directives

- @bind
- @class
- @style
- @attr

### Event Directives

- @on
- event modifiers
- propagation behavior
- prevent/default behavior

### Validation Directives

- validation triggers
- validation messages
- error synchronization

Directive tests are critical because directives are the primary runtime surface area of Udodi.

---

## Reactivity Testing

The reactivity layer should be heavily tested.

Recommended areas include:

- signals
- computed values
- watchers
- batched updates
- dependency tracking
- scheduler ordering
- cleanup behavior

Reactive runtimes are highly sensitive to edge cases, so high coverage is strongly recommended.

---

## Store Testing

Store tests should validate:

- state updates
- subscriptions
- module isolation
- action execution
- batched mutations
- reactive propagation

Stores should remain predictable and deterministic under concurrent updates.

---

## Async Query Testing

Query runtime tests should validate:

- caching behavior
- deduplication
- invalidation
- retries
- loading states
- error handling
- AbortController cancellation

Async state management is often one of the most failure-prone areas in UI runtimes.

---

## Overlay & Modal Testing

Overlay tests should validate:

- modal stacking
- focus restoration
- teleport behavior
- backdrop interaction
- scroll locking
- cleanup after close

Overlay systems are especially important to test in real browser environments.

---

## Cleanup Testing

Lifecycle cleanup is important in reactive runtimes.

Recommended assertions include:

- removed event listeners
- destroyed watchers
- disconnected effects
- cleared overlays
- removed subscriptions

Memory leaks and stale reactive effects can become major runtime problems if cleanup is not thoroughly tested.

---

## Browser Playground Testing

Udodi includes a playground environment for real browser validation.

The playground should be used to validate:

- rendering behavior
- DOM updates
- event propagation
- overlay stacking
- scheduler timing
- performance characteristics
- browser compatibility

Playground testing is useful for validating behavior not perfectly simulated by DOM emulators.

---

## Performance Testing

Performance testing is highly recommended for reactive runtimes.

Useful benchmarks include:

- component mount speed
- directive binding cost
- reactive propagation speed
- large list rendering
- batched update throughput

Performance regressions should be monitored continuously as the runtime evolves.

---

## Coverage Recommendations

Recommended minimum coverage targets:

| Area | Suggested Coverage |
|---|---|
| Directives | 95%+ |
| Reactivity Core | 95%+ |
| Component Runtime | 90%+ |
| Store System | 90%+ |
| Query Runtime | 85%+ |
| Overlay Runtime | 85%+ |

---

## Continuous Integration

CI should validate:

- build success
- type safety
- test execution
- coverage thresholds
- browser compatibility where applicable

Testing should run automatically for:

- pushes
- pull requests
- release branches

---

## Recommended Long-Term Strategy

As Udodi grows, testing should evolve toward:

- runtime regression testing
- performance regression tracking
- browser compatibility suites
- integration snapshots
- stress testing large reactive trees

Reactive UI runtimes benefit heavily from strong automated testing discipline because small runtime changes can cascade across many rendering behaviors.
