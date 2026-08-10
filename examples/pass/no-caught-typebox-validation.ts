import { Parse as parseFoo } from "foo";
import { Type } from "typebox";
import { Decode, Parse } from "typebox/value";
import * as Value from "typebox/value";

const Foo = Type.Refine(Type.String(), (value) => value.length > 0);
const input: unknown = "foo";
const parsed = Parse(Foo, input);
const decoded = Decode(Foo, input);
const namespaced = Value.Parse(Foo, input);

try {
	parseFoo(input);
} catch (cause) {
	console.error(cause);
}

try {
	JSON.parse("{\"foo\":true}");
} catch (cause) {
	console.error(cause);
}

console.log(parsed, decoded, namespaced);
