function normalizedName(name) {
	return name.trim();
}

export function greet(name) {
	return `hello ${normalizedName(name)}`;
}
