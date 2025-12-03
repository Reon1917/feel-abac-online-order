// Simple event emitter for cart updates
// Used to notify components when cart changes without full page refresh

type CartEventListener = () => void;

const listeners: Set<CartEventListener> = new Set();

export function onCartChange(listener: CartEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitCartChange(): void {
  listeners.forEach((listener) => listener());
}
