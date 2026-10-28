import { describe, it, expect, vi } from "vitest";
import { dispatchTriageKey, TriageHotkeyActions } from "@/hooks/useTriageHotkeys";

describe("Task 4: useTriageHotkeys Keyboard Navigation Dispatcher", () => {
  it("should trigger onApprove on key 'A', 'a', or 'Enter'", () => {
    const actions: TriageHotkeyActions = {
      onApprove: vi.fn(),
      onReject: vi.fn(),
    };

    const preventDefault = vi.fn();
    dispatchTriageKey({ key: "a", preventDefault }, actions);
    expect(actions.onApprove).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();

    dispatchTriageKey({ key: "A", preventDefault }, actions);
    expect(actions.onApprove).toHaveBeenCalledTimes(2);

    dispatchTriageKey({ key: "Enter", preventDefault }, actions);
    expect(actions.onApprove).toHaveBeenCalledTimes(3);
    expect(actions.onReject).not.toHaveBeenCalled();
  });

  it("should trigger onReject on key 'r' or 'R'", () => {
    const actions: TriageHotkeyActions = {
      onApprove: vi.fn(),
      onReject: vi.fn(),
    };

    const preventDefault = vi.fn();
    dispatchTriageKey({ key: "r", preventDefault }, actions);
    expect(actions.onReject).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();

    dispatchTriageKey({ key: "R", preventDefault }, actions);
    expect(actions.onReject).toHaveBeenCalledTimes(2);
    expect(actions.onApprove).not.toHaveBeenCalled();
  });

  it("should trigger onNext on 'j' or 'ArrowDown', and onPrevious on 'k' or 'ArrowUp'", () => {
    const actions: TriageHotkeyActions = {
      onNext: vi.fn(),
      onPrevious: vi.fn(),
    };

    const preventDefault = vi.fn();
    dispatchTriageKey({ key: "j", preventDefault }, actions);
    expect(actions.onNext).toHaveBeenCalledTimes(1);

    dispatchTriageKey({ key: "ArrowDown", preventDefault }, actions);
    expect(actions.onNext).toHaveBeenCalledTimes(2);

    dispatchTriageKey({ key: "k", preventDefault }, actions);
    expect(actions.onPrevious).toHaveBeenCalledTimes(1);

    dispatchTriageKey({ key: "ArrowUp", preventDefault }, actions);
    expect(actions.onPrevious).toHaveBeenCalledTimes(2);
  });

  it("should trigger onToggleLightbox on Space when modal is closed", () => {
    const actions: TriageHotkeyActions = {
      onToggleLightbox: vi.fn(),
      onCloseModal: vi.fn(),
    };

    const preventDefault = vi.fn();
    dispatchTriageKey({ key: " ", preventDefault }, actions, { isModalOpen: false });
    expect(actions.onToggleLightbox).toHaveBeenCalledTimes(1);
    expect(actions.onCloseModal).not.toHaveBeenCalled();
  });

  it("should trigger onCloseModal on Space or Escape when modal is open", () => {
    const actions: TriageHotkeyActions = {
      onToggleLightbox: vi.fn(),
      onCloseModal: vi.fn(),
    };

    const preventDefault = vi.fn();
    dispatchTriageKey({ key: " ", preventDefault }, actions, { isModalOpen: true });
    expect(actions.onCloseModal).toHaveBeenCalledTimes(1);

    dispatchTriageKey({ key: "Escape", preventDefault }, actions, { isModalOpen: true });
    expect(actions.onCloseModal).toHaveBeenCalledTimes(2);
  });

  it("should ignore hotkeys if the user is typing in an input element", () => {
    const actions: TriageHotkeyActions = {
      onApprove: vi.fn(),
      onReject: vi.fn(),
    };

    const mockInputElement = { tagName: "INPUT", isContentEditable: false };
    const preventDefault = vi.fn();

    dispatchTriageKey({ key: "a", preventDefault, target: mockInputElement }, actions);
    expect(actions.onApprove).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();

    dispatchTriageKey({ key: "r", preventDefault, target: mockInputElement }, actions);
    expect(actions.onReject).not.toHaveBeenCalled();
  });
});
