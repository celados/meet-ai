const { notarize } = require('@electron/notarize')

exports.default = async function notarizeMacApp(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const requireNotarization = process.env.MEET_DESKTOP_NOTARIZE === '1'
  const appleApiKey = process.env.APPLE_API_KEY_PATH || process.env.APPLE_API_KEY
  const hasApiKeyCredentials = Boolean(appleApiKey && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER)
  const hasAppleIdCredentials = Boolean(
    process.env.APPLE_ID &&
      process.env.APPLE_APP_SPECIFIC_PASSWORD &&
      process.env.APPLE_TEAM_ID,
  )

  if (!requireNotarization && !hasApiKeyCredentials && !hasAppleIdCredentials) {
    process.stdout.write('Skipping notarization: MEET_DESKTOP_NOTARIZE is not set and no Apple credentials were provided.\n')
    return
  }

  if (!hasApiKeyCredentials && !hasAppleIdCredentials) {
    throw new Error('Notarization requested but Apple notarization credentials are missing.')
  }

  const appName = context.packager.appInfo.productFilename
  const commonOptions = {
    appBundleId: context.packager.appInfo.appId,
    appPath: `${context.appOutDir}/${appName}.app`,
  }

  if (hasApiKeyCredentials) {
    await notarize({
      ...commonOptions,
      appleApiKey,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
    })
    return
  }

  await notarize({
    ...commonOptions,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })
}
