import {fetchAppFromConfigOrSelect} from './fetch-app-from-config-or-select.js'
import {getURLs, PartnersURLs, updateURLs, validatePartnersURLs} from '../dev/urls.js'
import {allowedRedirectionURLsPrompt, appUrlPrompt} from '../../prompts/update-url.js'
import {AppInterface} from '../../models/app/app.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export interface UpdateURLOptions {
  app: AppInterface
  apiKey?: string
  appURL?: string
  redirectURLs?: string[]
}

export default async function updateURL(options: UpdateURLOptions): Promise<void> {
  const token = await ensureAuthenticatedPartners()
  const apiKey = options.apiKey || (await fetchAppFromConfigOrSelect(options.app)).apiKey
  const newURLs = await getNewURLs(token, apiKey, options)
  await updateURLs(newURLs, apiKey, token)
  printResult(newURLs)
}

async function getNewURLs(token: string, apiKey: string, options: UpdateURLOptions): Promise<PartnersURLs> {
  const currentURLs: PartnersURLs = await getURLs(apiKey, token)
  const newURLs: PartnersURLs = {
    applicationUrl: options.appURL || (await appUrlPrompt(currentURLs.applicationUrl)),
    redirectUrlWhitelist:
      options.redirectURLs || (await allowedRedirectionURLsPrompt(currentURLs.redirectUrlWhitelist.join(','))),
  }
  validatePartnersURLs(newURLs)
  return newURLs
}

function printResult(urls: PartnersURLs): void {
  renderSuccess({
    headline: 'App URLs updated.',
    customSections: [
      {title: 'App URL', body: {list: {items: [urls.applicationUrl]}}},
      {title: 'Allowed redirection URL(s)', body: {list: {items: urls.redirectUrlWhitelist}}},
    ],
  })
}
