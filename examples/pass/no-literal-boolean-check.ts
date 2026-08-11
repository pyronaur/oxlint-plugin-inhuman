import { Type } from "typebox";
import { Check } from "typebox/value";

const Enabled = Type.Boolean();
const EnabledText = Type.Literal("true");

console.log(Check(Enabled, true), Check(EnabledText, "true"));
