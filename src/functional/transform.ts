import type { MonadicReactive, Reactive } from "./types";

export const map = <T, U>(
	reactive: MonadicReactive<T>,
	fn: (v: T) => U,
): MonadicReactive<U> => {
	return (ctx, cache) => {
		const [getter] = reactive(ctx, cache);
		return ctx.reactive(() => {
			const value = getter();
			return fn(value);
		}) as unknown as Reactive<U>;
	};
};

export const zip =
	<T extends any[]>(
		...fns: { [K in keyof T]: MonadicReactive<T[K]> }
	): MonadicReactive<T> =>
	(ctx, cache) => {
		const value: any = {};
		fns.forEach((fn, i) => {
			value[i] = fn(ctx, cache);
		});

		// Create a proxy that allows setting individual values
		const proxy = new Proxy(value, {
			get(target, prop) {
				return target[prop][0];
			},
			set(target, prop, value) {
				const index = parseInt(prop as string);
				const reactive = target[index];
				if (reactive) {
					target[index][1](value);
				}
				return true;
			},
		});

		return [
			() => {
				return Object.keys(value).map((i) => {
					return proxy[i]();
				});
			},
			(newValue: T) => {
				Object.assign(proxy, newValue);
			},
		] as unknown as Reactive<T>;
	};
