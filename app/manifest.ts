import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Why: PWA installs should open the measurements hub (canonical capture entry) instead of removed /capture routes.
    name: 'mBook Capture',
    short_name: 'mBook',
    description: 'Offline-first measurement capture for landscaping projects',
    start_url: '/measurements',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#16a34a',
    icons: [
      {
        // Why: favicon.svg exists in the app and avoids broken icon links during install checks.
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
