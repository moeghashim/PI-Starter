import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Route } from "../src/routes/index.js";

test("the home route renders the starter and shared package greeting", () => {
	const HomePage = Route.options.component;
	assert.ok(HomePage);
	const html = renderToStaticMarkup(createElement(HomePage));
	assert.match(html, /Hello, PI-Starter!/);
	assert.match(html, /Launch the app first/);
	assert.match(html, /Deploy on Cloudflare/);
});
