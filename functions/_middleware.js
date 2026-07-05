// Flip to false to take the site out of maintenance mode.
const MAINTENANCE_MODE = true;

export async function onRequest(context) {
	if (!MAINTENANCE_MODE) return context.next();

	const url = new URL("/maintenance.html", context.request.url);
	const asset = await context.env.ASSETS.fetch(new Request(url, context.request));

	return new Response(asset.body, {
		status: 503,
		headers: {
			"content-type": "text/html; charset=UTF-8",
			"retry-after": "3600",
		},
	});
}
