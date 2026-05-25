describe("sized tests", () => {
	function makeValue(input) {
		return input.trim();
	}

	test("keeps tests small", () => {
		expect(makeValue(" value ")).toBe("value");
	});
});

description("custom suite names", () => {
	test("uses the configured suite exception", () => {
		expect(Boolean("value")).toBe(true);
	});
});

test.describe("framework suite names", () => {
	test("uses default suite exceptions", () => {
		expect(Number("1")).toBe(1);
	});
});
