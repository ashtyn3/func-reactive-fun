import { createReactiveContext } from "../reactive";
import type {
	Err,
	MonadicReactive,
	Ok,
	PartialReactive,
	Reactive,
	Try,
	TryReactive,
} from "./types";

export const ok = <T>(value: T): Try<T, any> => ({ _tag: "Ok", value });
export const err = <E>(error: E): Try<any, E> => ({ _tag: "Err", error });

export function isError<T, E>(t: Try<T, E>): t is Err<E> {
	return t._tag === "Err";
}

export const fromTry = <T, E>(
	fn: () => MonadicReactive<T>,
	onError: (e: Error) => MonadicReactive<E>,
): TryReactive<T, E> => {
	return (ctx, cache) => {
		try {
			// success path → read a T and wrap it in Ok<T>
			const [get] = fn()(ctx, cache);
			return ctx.reactive(() => ok(get())) as unknown as Reactive<Try<T, E>>;
		} catch (e) {
			// error path → read an E and wrap it in Err<E>
			const [getErr] = onError(e as Error)(ctx, cache);
			return ctx.reactive(() => err(getErr())) as unknown as Reactive<
				Try<T, E>
			>;
		}
	};
};

export function matchTry<T, E>(
	tryR: TryReactive<T, E>,
	onOk: (value: T, get: <U>(r: MonadicReactive<U>) => U) => void,
	onErr: (error: E, get: <U>(r: MonadicReactive<U>) => U) => void,
): PartialReactive {
	return (ctx, cache) => {
		const get = <U>(r: MonadicReactive<U>): U => r(ctx, cache)[0]();
		const [getter] = tryR(ctx, cache);
		const t = getter();
		if (t._tag === "Err") {
			onErr(t.error, get);
		} else {
			onOk(t.value, get);
		}
	};
}

export const isErrorGen = <T, E>(
	tryR: MonadicReactive<Try<T, E>>,
): MonadicReactive<boolean> => {
	return (ctx, cache) => {
		const [getTry] = tryR(ctx, cache);
		return ctx.reactive(() =>
			isError(getTry()),
		) as unknown as Reactive<boolean>;
	};
};
