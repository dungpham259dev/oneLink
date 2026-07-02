export function parseUtm(sp: URLSearchParams) {
  return {
    utmSource: sp.get("utm_source"),
    utmMedium: sp.get("utm_medium"),
    utmCampaign: sp.get("utm_campaign"),
  };
}
