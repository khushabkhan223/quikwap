import type { BspAdapter } from "./adapter";
import { MockBspAdapter } from "./adapters/mock";
import { TwilioBspAdapter } from "./adapters/twilio";

type AdapterConfig = {
  provider: "mock" | "twilio";
};

export function createBspAdapter(config: AdapterConfig): BspAdapter {
  if (config.provider === "mock") {
    return new MockBspAdapter();
  }
  return new TwilioBspAdapter();
}
