import { Type } from "typebox";
import * as Value from "typebox/value";

const Foo = Type.String();

function parseFoo(value: unknown): string {
	try {
		return Value.Parse(Foo, value);
	} catch {
		throw new Error("foo");
	}
}

parseFoo("foo");
