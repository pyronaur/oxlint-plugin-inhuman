import { Type } from "typebox";

const EncodedValue = Type.String();
const DecodedValue = Type.Decode(EncodedValue, (value) => value.length);

const unrelated = {
	Decode: (value: unknown) => value,
	Unknown: () => "foo",
};

console.log(DecodedValue, unrelated.Decode(unrelated.Unknown()));
