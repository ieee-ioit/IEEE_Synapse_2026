import Script from "next/script";

/**
 * Vercel Web Analytics (cookie-free) through its script endpoint, so no npm package is needed.
 * It only exists on Vercel deployments and only after Web Analytics is switched on for the project
 * (Vercel dashboard, Analytics tab). Everywhere else nothing is rendered, so local runs and
 * previews without the feature log no failed requests.
 */
export default function Analytics() {
  if (!process.env.VERCEL) return null;
  return (
    <>
      <Script id="vercel-analytics-init" strategy="afterInteractive">
        {"window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };"}
      </Script>
      <Script src="/_vercel/insights/script.js" strategy="afterInteractive" defer />
    </>
  );
}
