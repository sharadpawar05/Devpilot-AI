function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const el = document.getElementById('sr-announcer');
  if (el) {
    el.setAttribute('aria-live', priority);
    el.textContent = message;
    setTimeout(() => {
      el.textContent = '';
    }, 1000);
  }
}

function createKeyboardHandler(action: () => void): (e: React.KeyboardEvent) => void {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };
}

function getAriaLabelForButton(action: string, state?: string): string {
  if (state) {
    return `${action}, ${state}`;
  }
  return action;
}

function getAriaExpanded(isExpanded: boolean): string {
  return String(isExpanded);
}

function getAriaSelected(isSelected: boolean): string {
  return String(isSelected);
}

function getAriaCurrent(page: number): 'page' | undefined {
  return page > 0 ? 'page' : undefined;
}

export {
  announceToScreenReader,
  createKeyboardHandler,
  getAriaLabelForButton,
  getAriaExpanded,
  getAriaSelected,
  getAriaCurrent,
};
