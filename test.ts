import { leaveAsync, run, value } from "./src/functional";
import {
	effectAsync,
	genFuncAsync,
	pipeAsync,
	promise,
} from "./src/functional/async";
import type { PromiseReactive } from "./src/functional/types";

// Define the User type from the API
interface User {
	id: number;
	name: string;
	username: string;
	email: string;
	address: {
		street: string;
		suite: string;
		city: string;
		zipcode: string;
		geo: {
			lat: string;
			lng: string;
		};
	};
	phone: string;
	website: string;
	company: {
		name: string;
		catchPhrase: string;
		bs: string;
	};
}

// Define the transformed result type
type UserDisplay = string;

// Simple API test using pipeAsync
console.log("=== Simple API Test with pipeAsync ===");

// Create a promise that fetches user data
const userPromise = promise<User, unknown>(
	fetch("https://jsonplaceholder.typicode.com/users/1").then(
		(res) => res.json() as Promise<User>,
	),
);

// Transform the user data with proper typing
run(
	pipeAsync(userPromise, async (promiseReactive) => {
		if (promiseReactive.state === "fulfilled" && promiseReactive.value) {
			promiseReactive.value.username = "Bob";
			return promiseReactive;
		}
		return promiseReactive;
	}),
);

const user = await leaveAsync(userPromise);
console.log(user);
