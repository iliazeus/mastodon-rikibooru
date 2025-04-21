import { File } from "buffer";

(globalThis.File as any) ??= File;
