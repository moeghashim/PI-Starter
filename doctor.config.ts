import { defineConfig } from "react-doctor/api";

export default defineConfig({
	$schema: "https://react.doctor/schema/config.json",
	rootDir: "apps/web",
	noScore: true,
	share: false,
	ignore: {
		overrides: [
			{
				files: ["lib/use-mount-effect.ts"],
				rules: ["react-doctor/exhaustive-deps"],
			},
		],
	},
});
