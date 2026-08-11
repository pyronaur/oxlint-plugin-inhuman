import { Type } from "typebox";
import { Assert } from "typebox/value";

const Foo = Type.String();

function assertFoo(value: unknown): asserts value is string {
	try {
		Assert(Foo, value);
	} catch {
		throw new TypeError("foo");
	}
}

assertFoo("foo");
