// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'sj-wao';
export const SITE_DESCRIPTION = '個人開発のログ、技術メモ、日々のこと。';

export type SocialLink = {
	name: string;
	url: string;
	icon: 'github' | 'x';
};

export const SOCIAL_LINKS: SocialLink[] = [
	{ name: 'GitHub', url: 'https://github.com/Akihiro-Arai', icon: 'github' },
];

// Public API URL for the sj-wao-metrics Worker (see worker/README.md).
// TODO(#6): replace <subdomain> once the Worker has been deployed for the
// first time — `npx wrangler deploy` prints the real workers.dev subdomain.
export const METRICS_API_URL = 'https://sj-wao-metrics.<subdomain>.workers.dev/api/metrics';
