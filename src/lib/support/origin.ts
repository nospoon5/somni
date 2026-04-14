type ResolveSupportOriginInput = {
  appOrigin: string
  currentSupportPage: string
  queryOrigin: string | null
  lastInAppPage: string | null
  documentReferrer: string
}

function sameOriginPath(referrer: string, appOrigin: string) {
  if (!referrer) return ''

  try {
    const referrerUrl = new URL(referrer)
    if (referrerUrl.origin !== appOrigin) return ''
    return `${referrerUrl.pathname}${referrerUrl.search}`
  } catch {
    return ''
  }
}

export function resolveSupportOrigin(input: ResolveSupportOriginInput) {
  const queryOrigin = input.queryOrigin?.trim() || ''
  const lastInAppPage = input.lastInAppPage?.trim() || ''
  const referrerPath = sameOriginPath(input.documentReferrer, input.appOrigin)

  return queryOrigin || lastInAppPage || referrerPath || input.currentSupportPage
}
