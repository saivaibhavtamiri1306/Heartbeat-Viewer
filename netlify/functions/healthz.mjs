export default async () => {
  return Response.json({ status: "ok" }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
};

export const config = {
  path: "/api/healthz",
};
