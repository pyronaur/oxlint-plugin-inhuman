import { Type as T } from "typebox";
import * as TypeBox from "typebox";

const UnknownInput = T.Unknown();
const direct = T.Decode(T.Any(), (value) => value);
const local = T.Decode(UnknownInput, (value) => value);
const namespaced = TypeBox.Type.Decode(TypeBox.Type.Unknown(), (value) => value);

console.log(direct, local, namespaced);
