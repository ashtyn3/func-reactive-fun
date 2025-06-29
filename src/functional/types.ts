import { createReactiveContext, type ReactiveContext } from "../reactive";

export type Reactive<T> = [() => T, (newValue: T) => void];

export type PartialReactive = (
	ctx: ReactiveContext,
	cache: Map<string, Reactive<any>>,
) => void;

export type MonadicReactive<T> = (
	ctx: ReactiveContext,
	cache: Map<string, Reactive<any>>,
) => Reactive<T>;

export type ContextBoundFunction<T> = (
	get: <T>(reactive: MonadicReactive<T>) => T,
) => T;

export type PipeFn<T> = (v: T) => T;

export const TapSymbol = Symbol.for("tap");
export interface TapFn<T> {
	[TapSymbol]: true;
	(v: T): void;
}

// Try types for error handling
export interface Ok<T> {
	readonly _tag: "Ok";
	readonly value: T;
}

export interface Err<E> {
	readonly _tag: "Err";
	readonly error: E;
}

export type Try<T, E> = Ok<T> | Err<E>;
export type TryReactive<T, E> = MonadicReactive<Try<T, E>>;

export interface PromiseReactive<T, E> {
	readonly _tag: "Promise";
	readonly promise: Promise<Try<T, E>>;
	readonly state: "pending" | "fulfilled" | "rejected";
	readonly value: T | undefined;
	readonly error: E | undefined;
}
