import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Why: installed apps should use the product name users see in the browser so launchers and tabs stay in sync.
    name: 'mBook',
    short_name: 'mBook',
    description: 'Measure, bill, and invoice landscaping projects from one mobile-friendly workspace',
    start_url: '/measurements',
    display: 'standalone',
    background_color: '#f7f5ef',
    theme_color: '#255a48',
    icons: [
      // Why: dedicated square PNGs prevent install surfaces from stretching the wide wordmark artwork.
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
