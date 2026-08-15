import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

const handler = createStartHandler(defaultStreamHandler);

export const fetch = handler.fetch;
export default handler;

