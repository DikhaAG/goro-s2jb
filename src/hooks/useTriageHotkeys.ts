import { useEffect } from "react";

export interface TriageHotkeyActions {
  onApprove?: () => void;
  onReject?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleLightbox?: () => void;
  onCloseModal?: () => void;
}

export interface UseTriageHotkeysOptions {
  enabled?: boolean;
  isModalOpen?: boolean;
}

export function dispatchTriageKey(
  event: { key: string; preventDefault?: () => void; target?: any },
  actions: TriageHotkeyActions,
  options: UseTriageHotkeysOptions = { enabled: true, isModalOpen: false }
) {
  const { enabled = true, isModalOpen = false } = options;
  if (!enabled) return;

  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  ) {
    if (event.key === "Escape" && isModalOpen) {
      actions.onCloseModal?.();
    }
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault?.();
    actions.onCloseModal?.();
    return;
  }

  // If modal is open, Space or Escape closes it
  if (isModalOpen) {
    if (event.key === " ") {
      event.preventDefault?.();
      actions.onCloseModal?.();
    }
    return;
  }

  switch (event.key.toLowerCase()) {
    case "a":
      event.preventDefault?.();
      actions.onApprove?.();
      break;
    case "r":
      event.preventDefault?.();
      actions.onReject?.();
      break;
    case "j":
    case "arrowdown":
      event.preventDefault?.();
      actions.onNext?.();
      break;
    case "k":
    case "arrowup":
      event.preventDefault?.();
      actions.onPrevious?.();
      break;
    case " ":
      event.preventDefault?.();
      actions.onToggleLightbox?.();
      break;
    case "enter":
      event.preventDefault?.();
      actions.onApprove?.();
      break;
    default:
      break;
  }
}

export function useTriageHotkeys(
  actions: TriageHotkeyActions,
  options: UseTriageHotkeysOptions = { enabled: true, isModalOpen: false }
) {
  const { enabled = true, isModalOpen = false } = options;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      dispatchTriageKey(event, actions, options);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actions, enabled, isModalOpen, options]);
}
