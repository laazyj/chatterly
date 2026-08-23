import { describe, expect, it } from "vitest";
import { selectToolProtocol } from "../src/tools/protocols/select.ts";

const canDoNativeTools = { nativeTools: true, streaming: true };
const cannot = { nativeTools: false, streaming: true };

describe("tool protocol selection", () => {
  it("follows the model's capability under auto", () => {
    expect(selectToolProtocol("auto", canDoNativeTools).name).toBe("native");
    expect(selectToolProtocol("auto", cannot).name).toBe("prompted");
  });

  // Regression: nativeTools was never wired through from config, so "auto" always saw
  // true and could never resolve to prompted.
  it("resolves auto to prompted for a model without native tool support", () => {
    expect(selectToolProtocol("auto", cannot).name).toBe("prompted");
  });

  it("lets an explicit setting override the capability, so the two can be A/B'd", () => {
    expect(selectToolProtocol("prompted", canDoNativeTools).name).toBe("prompted");
    expect(selectToolProtocol("native", cannot).name).toBe("native");
  });
});
