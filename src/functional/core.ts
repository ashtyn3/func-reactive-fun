import { createReactiveContext, type ReactiveContext } from "../reactive";
import type {
	ContextBoundFunction,
	MonadicReactive,
	PartialReactive,
	PipeFn,
	Reactive,
	TapFn,
} from "./types";
import { TapSymbol } from "./types";

const reactiveCache = new Map<string, Reactive<any>>();

// Create a reactive value from a static value (cached by value)
export const value =
	<T>(initial: T): MonadicReactive<T> =>
	(ctx, cache) => {
		const cacheKey = `value:${JSON.stringify(initial)}`;

		if (!cache.has(cacheKey)) {
			cache.set(cacheKey, ctx.reactive(initial));
		}

		return cache.get(cacheKey) as Reactive<T>;
	};

// Create an effect (functional)
export const effect =
	(...fns: ContextBoundFunction<void>[]): PartialReactive =>
	(ctx, cache) => {
		const get = <T>(reactive: MonadicReactive<T>): T => {
			return reactive(ctx, cache)[0]();
		};
		ctx.effect(() => {
			for (const fn of fns) {
				fn(get);
			}
		});
	};

// Check if a function is a tap function
export const isTap = <T>(fn: PipeFn<T> | TapFn<T>): fn is TapFn<T> =>
	TapSymbol in fn;

// Pure description of a state update (pipe)
export const pipe =
	<T>(
		reactive: MonadicReactive<T>,
		...fns: (PipeFn<T> | TapFn<T>)[]
	): PartialReactive =>
	(ctx, cache) => {
		const [getter, setter] = reactive(ctx, cache);
		let value = getter();
		ctx.transaction(() => {
			for (const fn of fns) {
				if (isTap(fn)) {
					fn(value);
				} else {
					value = fn(value);
				}
			}
			setter(value);
		});
	};

// Run a description (Update or Effect) in the shared context
export function run(...thunks: PartialReactive[]) {
	createReactiveContext((ctx) => {
		for (const thunk of thunks) thunk(ctx, reactiveCache);
	});
}

// Run a description (Update or Effect) in a entirely new context (no shared reactive values), without flushing the current context
export function runInIsolate(...thunks: PartialReactive[]) {
	const isolatedCache = new Map<string, Reactive<any>>();
	const ctx = createReactiveContext((ctx) => {
		for (const thunk of thunks) thunk(ctx, isolatedCache);
	}, false);
	return ctx;
}

// Create a tap or side effect function
export const tap = <T>(fn: (v: T) => void): TapFn<T> => {
	const tapFn = (v: T): void => {
		fn(v);
	};
	(tapFn as any)[TapSymbol] = true;
	return tapFn as TapFn<T>;
};

export const chain = (...fns: PartialReactive[]): PartialReactive => {
	return (ctx, cache) => {
		for (const fn of fns) {
			fn(ctx, cache);
		}
	};
};
