import { createReactiveContext } from "../reactive";
import type {
	ContextBoundFunction,
	MonadicReactive,
	PartialReactive,
	Reactive,
} from "./types";

const reactiveCache = new Map<string, Reactive<any>>();

export const func = <T>(fn: ContextBoundFunction<T>): PartialReactive => {
	return (ctx, cache) => {
		const get = <T>(reactive: MonadicReactive<T>): T => {
			return reactive(ctx, cache)[0]();
		};
		fn(get);
	};
};

export const leave = <T>(fn: MonadicReactive<T>): T | undefined => {
	let v: T | undefined;
	createReactiveContext((ctx) => {
		v = fn(ctx, reactiveCache)[0]();
	});
	return v;
};

export const leaveAsync = <T>(fn: MonadicReactive<T>): Promise<T> => {
	return new Promise<T>((resolve) => {
		createReactiveContext((ctx) => {
			const result = fn(ctx, reactiveCache)[0]();
			if (result && typeof result === "object" && "promise" in result) {
				(result.promise as Promise<T>).then(resolve);
			} else {
				resolve(result as T);
			}
		});
	});
};
