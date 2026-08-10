type Payload = {
	name: string;
};

function assertPayload(value: unknown): asserts value is Payload {
	if (typeof value !== "object" || value === null || !("name" in value)) {
		throw new TypeError("Invalid payload");
	}
}

const payload: unknown = { name: "foo" };
assertPayload(payload);
console.log(payload);
