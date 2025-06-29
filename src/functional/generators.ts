import type { MonadicReactive, PartialReactive } from "./types";

// Type-safe generator effect with proper type inference
export function* $<T>(
	r: MonadicReactive<T>,
): Generator<MonadicReactive<T>, T, T> {
	// pause here, yielding the reactive
	const v = yield r;
	// when we next(v), resume() will feed v back in
	return v;
}

export const genFunc =
	<
		Y extends MonadicReactive<any>,
		R = void,
		N = Y extends MonadicReactive<infer U> ? U : never,
	>(
		fn: (wrapper: typeof $) => Generator<Y, R, N>,
	): PartialReactive =>
	(ctx, cache) => {
		const _ = <U>(r: MonadicReactive<U>): U => r(ctx, cache)[0]();
		const gen = fn($);
		let result = gen.next();
		while (!result.done) {
			result = gen.next(result.value(ctx, cache)[0]());
		}
	};
