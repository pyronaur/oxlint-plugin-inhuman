import { Type as T } from "typebox";
import * as TypeBox from "typebox";
import { Check as verify } from "typebox/value";
import * as Value from "typebox/value";

const ExistingPath = T.Literal(true);

verify(ExistingPath, true);
verify(T.Literal(false), false);
Value.Check(TypeBox.Type.Literal(true), true);
