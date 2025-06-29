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
