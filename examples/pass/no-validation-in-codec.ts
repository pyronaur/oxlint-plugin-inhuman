import Type from "typebox";

type Completion = {
	failure?: Error;
	value: string;
};

const transformCompletion = (completion: Completion) => {
	if (completion.failure != null) {
		throw completion.failure;
	}

	return completion.value.length;
};

const Length = Type.Decode(Type.String(), (value) => value.length);
const CompletionValue = Type.Decode(
	Type.Object({
		failure: Type.Optional(Type.Unknown()),
		value: Type.String(),
	}),
	transformCompletion,
);

console.log(Length, CompletionValue);
