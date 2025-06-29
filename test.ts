import { effect, map, pipe, run, value, zip } from "./src/functional";

const a = value(1);

const b = value(2);

const both = zip(a, b);

const added = map(both, (both) => both[0] + both[1]);

run(
	effect((get) => {
		console.log(get(added));
	}),
	pipe(both, (v) => {
		v[0] = 10;
		v[1] = 20;
		return v;
	}),
);
