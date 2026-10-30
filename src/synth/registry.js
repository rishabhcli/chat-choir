// The generated static imports make exactly the same discovered plugins available in browsers.
import { instruments } from './registry.generated.js';
export { instruments };
export const registry = Object.fromEntries(instruments.map(instrument => [instrument.id,instrument]));
