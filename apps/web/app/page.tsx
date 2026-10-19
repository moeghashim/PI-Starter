const appCards = [
	{
		title: "Choose one host",
		description:
			"Use Vercel Git integration or Cloudflare Workers with OpenNext. Provider-specific settings stay separate.",
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
			"Repo skills load natively in Codex and Claude Code. Every push goes through a validation gate before it opens a pull request.",
		accent: "Gated pushes",
	},
];

export default function HomePage() {
	return (
		<main className="page-shell">
			<section className="hero">
				<p className="eyebrow">Solo Agent Starter</p>
				<h1>
					Launch the app first.
					<br />
					Publish the package when it matters.
				</h1>
				<p className="hero-copy">
					PI-Starter includes a deployable Next.js app, a shared package workspace, and agent guidance designed for
					one maintainer shipping through validated pull requests.
				</p>
				<div className="hero-actions">
					<a className="primary-action" href="https://vercel.com/new">
						Deploy on Vercel
					</a>
					<a
						className="secondary-action"
						href="https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/"
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
