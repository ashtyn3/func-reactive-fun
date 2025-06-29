import { nanoid } from "nanoid";

export type Effect = () => void;
export type Consumable<T> = T | (() => T);

export interface ReactiveContext {
	effect: (effect: Effect) => void;
	reactive: <T>(target: T) => [() => T, (newValue: T) => void];
	transaction: (fn: () => void) => void;
	flush: () => void;
}

export function createReactiveContext(
	fn: (context: ReactiveContext) => void,
	finalBatch?: boolean,
) {
	let currentEffect: Effect | null = null;
	const reactMap: Map<string, Effect[]> = new Map();
	const reactCache: Map<string, any> = new Map();
	let currentBatch: Set<Effect> = new Set();
	let transactionDepth = 0;

	const context: ReactiveContext = {
		effect: (effect: Effect) => {
			currentEffect = effect;
			effect();
			currentEffect = null;
		},
		transaction: (fn: () => void) => {
			transactionDepth++;
			const originalBatch = currentBatch;

			if (transactionDepth === 1) {
				currentBatch = new Set();
			}

			fn();

			if (transactionDepth === 1) {
				currentBatch.forEach((fn) => fn());
				currentBatch.clear();
				currentBatch = originalBatch;
			}
			transactionDepth--;
		},
		flush: () => {
			currentBatch.forEach((fn) => fn());
			currentBatch.clear();
		},
		reactive: <T>(target: Consumable<T>) => {
			const id = nanoid();
			reactMap.set(id, []);
			const isFunction = typeof target === "function";
			let value: () => T = isFunction ? (target as () => T) : () => target as T;
			let computed = false;

			return [
				() => {
					if (currentEffect && !reactMap.get(id)?.includes(currentEffect)) {
						reactMap.get(id)?.push(currentEffect);
					}
					if (!computed) {
						computed = true;
						const result = value();
						reactCache.set(id, result);
						return result as T;
					}
					return reactCache.get(id) as T;
				},
				(newValue: Consumable<T>) => {
					if (newValue === value()) {
						return;
					}
					const isNewValueFunction = typeof newValue === "function";
					value = isNewValueFunction
						? (newValue as () => T)
						: () => newValue as T;

					const captured = value();

					computed = false;
					reactCache.set(id, captured);

					reactMap.get(id)?.forEach((listener) => {
						currentBatch.add(listener);
					});

					// Auto-flush if not in a transaction
					if (transactionDepth === 0) {
						currentBatch.forEach((fn) => fn());
						currentBatch.clear();
					}
				},
			];
		},
	};

	fn(context);

	if (finalBatch) {
		if (currentBatch.size > 0) {
			currentBatch.forEach((fn) => fn());
			currentBatch.clear();
		}
	}
	return context;
}
