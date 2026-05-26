const Foo = {
	bar: 1,
};

const originalBar = Foo.bar;

Foo.bar = 2;

console.log(originalBar);
