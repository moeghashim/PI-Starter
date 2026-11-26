import { hello } from "@pi-starter/core";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomePage });

const appCards = [
	{
		title: "Choose one host",
		description:
			"Deploy to Vercel, Cloudflare Workers, or any Nitro host. One app, with provider settings kept separate.",
		accent: "Deploy from main",
	},
	{
		title: "Publish a package",
		description:
			"Keep shared logic in packages/core and ship it with the existing release flow when it earns its own lifecycle.",
		accent: "Publish is explicit",
	},
	{
		title: "Work with agents",
		description:
			"Repo skills load natively in Codex and Claude Code. GitHub checks each pull request before it can merge.",
		accent: "Required PR checks",
	},
];

function HomePage() {
	return (
		<main className="page-shell">
			<section className="hero">
				<p className="eyebrow">{hello("PI-Starter")}</p>
				<h1>
					Launch the app first.
					<br />
					Publish the package when it matters.
				</h1>
				<p className="hero-copy">
					PI-Starter includes a deployable TanStack Start app, a shared package workspace, and agent guidance
					designed for one maintainer shipping through validated pull requests.
				</p>
				<div className="hero-actions">
					<a className="primary-action" href="https://vercel.com/new">
						Deploy on Vercel
					</a>
					<a
						className="secondary-action"
						href="https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/"
					>
						Deploy on Cloudflare
					</a>
					<a className="secondary-action" href="https://github.com/moeghashim/PI-Starter">
						View the template
					</a>
				</div>
			</section>

			<section className="card-grid" aria-label="Starter capabilities">
				{appCards.map((card) => (
					<article className="feature-card" key={card.title}>
						<p className="card-accent">{card.accent}</p>
						<h2>{card.title}</h2>
						<p>{card.description}</p>
					</article>
				))}
			</section>

			<section className="workflow-panel">
				<div>
					<p className="eyebrow">Default flow</p>
					<h2>Keep shipping simple.</h2>
				</div>
				<pre>
					<code>{`npm run doctor
npm install
npm run check
npm test
npm run agent:check`}</code>
				</pre>
			</section>
		</main>
	);
}
