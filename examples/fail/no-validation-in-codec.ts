import { Type as T } from "typebox";
import { Check as verifies } from "typebox/value";
import * as Value from "typebox/value";

const Text = T.String();

function rejectBlank(value: string) {
	if (value.length === 0) {
		throw new TypeError("blank");
	}

	return value;
}

const checksInline = T.Decode(Text, (value) => verifies(Text, value));
const assertsNested = T.Decode(Text, (value) => {
	const entries = [value];
	return entries.map((entry) => {
		Value.Assert(Text, entry);
		return entry;
	});
});
const rejectsConditionally = T.Decode(Text, rejectBlank);

console.log(checksInline, assertsNested, rejectsConditionally);
