import { createReactiveContext } from "../reactive";
import { err, ok } from "./error-handling";
import type {
	MonadicReactive,
	PartialReactive,
	PromiseReactive,
	Reactive,
} from "./types";

export const makePromise = <T, E>(
	promise: Promise<T>,
	cache: Map<string, Reactive<any>>,
): PromiseReactive<T, E> => {
	const cacheKey = `promise:${promise}`;
	let data: PromiseReactive<T, E> | undefined;
	data = {
		_tag: "Promise",
		promise: promise
			.then((v) => {
				data = {
					_tag: "Promise",
					promise: Promise.resolve(ok(v)),
					state: "fulfilled",
					value: v,
					error: undefined,
				};
				const [_, set] = cache.get(cacheKey) as Reactive<PromiseReactive<T, E>>;
				set(data);
				return ok(v);
			})
			.catch((e) => {
				data = {
					_tag: "Promise",
					promise: Promise.resolve(err(e)),
					state: "rejected",
					value: undefined,
					error: e,
				};
				const [_, set] = cache.get(cacheKey) as Reactive<PromiseReactive<T, E>>;
				set(data);
				return err(e);
			}),
		state: "pending",
		value: undefined,
		error: undefined,
	};

	return data;
};

export const promise = <T, E>(
	promise: Promise<T>,
): MonadicReactive<PromiseReactive<T, E>> => {
	return (ctx, cache) => {
		const cacheKey = `promise:${promise}`;
		if (!cache.has(cacheKey)) {
			cache.set(cacheKey, ctx.reactive(makePromise(promise, cache)));
		}
		return cache.get(cacheKey) as Reactive<PromiseReactive<T, E>>;
	};
};

export type AsyncContextBoundFunction<T> = (
	get: <T>(reactive: MonadicReactive<T>) => Promise<T>,
) => Promise<T>;

// Async pipe function type (supports type transformation)
export type AsyncPipeFn<T, U = T> = (v: T) => U | Promise<U>;

// Async tap function type
export type AsyncTapFn<T> = (v: T) => void | Promise<void>;

// Helper type to extract the result type from a pipe function
export type PipeResult<T, F> = F extends AsyncPipeFn<T, infer U> ? U : T;

// Helper type to chain pipe functions
export type PipeChain<T, Fns extends readonly any[]> = Fns extends readonly []
	? T
	: Fns extends readonly [infer F, ...infer Rest]
		? F extends AsyncPipeFn<T, infer U>
			? PipeChain<U, Rest>
			: F extends AsyncTapFn<T>
				? PipeChain<T, Rest>
				: T
		: T;

// Check if a value is a Promise
export const isPromise = <T>(value: T | Promise<T>): value is Promise<T> => {
	return value && typeof value === "object" && "then" in value;
};

// Create an async effect (functional)
export const effectAsync =
	(...fns: AsyncContextBoundFunction<void>[]): PartialReactive =>
	(ctx, cache) => {
		const get = <T>(reactive: MonadicReactive<T>): Promise<T> => {
			const result = reactive(ctx, cache)[0]();
			if (result && typeof result === "object" && "promise" in result) {
				return result as unknown as Promise<T>;
			}
			return Promise.resolve(result);
		};

		ctx.effect(async () => {
			for (const fn of fns) {
				await fn(get);
			}
		});
	};

export const funcAsync =
	(fn: AsyncContextBoundFunction<void>): PartialReactive =>
	(ctx, cache) => {
		const get = <T>(reactive: MonadicReactive<T>): Promise<T> => {
			const result = reactive(ctx, cache)[0]();
			if (result && typeof result === "object" && "promise" in result) {
				return result as unknown as Promise<T>;
			}
			return Promise.resolve(result);
		};

		(async () => {
			await fn(get);
		})();
	};
// Async pipe that supports both sync and async operations with type transformations
export function pipeAsync<T>(reactive: MonadicReactive<T>): PartialReactive;
export function pipeAsync<T, U>(
	reactive: MonadicReactive<T>,
	fn: AsyncPipeFn<T, U> | AsyncTapFn<T>,
): PartialReactive;
export function pipeAsync<T, U, V>(
	reactive: MonadicReactive<T>,
	fn1: AsyncPipeFn<T, U> | AsyncTapFn<T>,
	fn2: AsyncPipeFn<U, V> | AsyncTapFn<U>,
): PartialReactive;
export function pipeAsync<T, U, V, W>(
	reactive: MonadicReactive<T>,
	fn1: AsyncPipeFn<T, U> | AsyncTapFn<T>,
	fn2: AsyncPipeFn<U, V> | AsyncTapFn<U>,
	fn3: AsyncPipeFn<V, W> | AsyncTapFn<V>,
): PartialReactive;
export function pipeAsync<T>(
	reactive: MonadicReactive<T>,
	...fns: (AsyncPipeFn<any, any> | AsyncTapFn<any>)[]
): PartialReactive {
	return (ctx, cache) => {
		const [getter, setter] = reactive(ctx, cache);

		ctx.effect(async () => {
			// Get the current value inside the effect so it's reactive
			let value: T = getter();

			for (const fn of fns) {
				const result = fn(value);
				if (isPromise(result)) {
					const awaited = await result;
					// Only update value if it's not a tap function (tap functions return void)
					if (awaited !== undefined) {
						value = awaited as T;
					}
				} else {
					// Only update value if it's not a tap function (tap functions return void)
					if (result !== undefined) {
						value = result as T;
					}
				}
			}
			setter(value);
		});
	};
}

// Async generator wrapper
export async function* $async<T>(
	r: MonadicReactive<T>,
): AsyncGenerator<MonadicReactive<T>, T, T> {
	// pause here, yielding the reactive
	const v = yield r;
	// when we next(v), resume() will feed v back in
	return v;
}

// Async generator function
export const genFuncAsync = <R = void>(
	fn: (wrapper: typeof $async) => AsyncGenerator<MonadicReactive<any>, R, any>,
): PartialReactive => {
	return (ctx, cache) => {
		const _ = async <U>(r: MonadicReactive<U>): Promise<U> => {
			const result = r(ctx, cache)[0]();
			if (result && typeof result === "object" && "promise" in result) {
				return result.promise as unknown as Promise<U>;
			}
			return Promise.resolve(result);
		};

		ctx.effect(async () => {
			const gen = fn($async);
			let result = await gen.next();
			while (!result.done) {
				const reactiveValue = result.value;
				const resolvedValue = await _(reactiveValue);
				result = await gen.next(resolvedValue);
			}
		});
	};
};

export const mapAsync = <T extends PromiseReactive<T, any>, U>(
	reactive: MonadicReactive<T>,
	fn: (v: T) => Promise<PromiseReactive<U, any>>,
): MonadicReactive<U> => {
	return (ctx, cache) => {
		const [getter] = reactive(ctx, cache);
		return ctx.reactive(async () => {
			const value: PromiseReactive<T, any> = getter();
			await value.promise;
			return await fn(getter());
		}) as unknown as Reactive<U>;
	};
};
