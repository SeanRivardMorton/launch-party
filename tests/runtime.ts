// Minimal runtime stand-in for deterministic event/hibernation unit tests.
// Real WebSocket upgrades and D1 integration are covered by Playwright locally.
export class DurableObject {
  constructor(protected ctx: any, protected env: any) {}
}
