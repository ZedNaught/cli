import {CreateAppMutation, CreateAppMutationVariables, CreateAppMutationSchema} from './shopify-developers-client/graphql/create-app.js'
import {DeveloperPlatformClient, Paginateable} from '../developer-platform-client.js'
import {PartnersSession} from '../../../cli/services/context/partner-account-info.js'
import {
  filterDisabledBetas,
} from '../../../cli/services/dev/fetch.js'
import {MinimalOrganizationApp, Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {selectOrganizationPrompt} from '../../prompts/dev.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../../api/graphql/all_app_extension_registrations.js'
import {ActiveAppVersionQuerySchema} from '../../api/graphql/app_active_version.js'
import {
  GenerateSignedUploadUrlSchema,
  GenerateSignedUploadUrlVariables,
} from '../../api/graphql/generate_signed_upload_url.js'
import {ExtensionUpdateDraftInput, ExtensionUpdateSchema} from '../../api/graphql/update_draft.js'
import {AppDeploySchema, AppDeployVariables} from '../../api/graphql/app_deploy.js'
import {FunctionUploadUrlGenerateResponse} from '@shopify/cli-kit/node/api/partners'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {graphqlRequest, GraphQLVariables, GraphQLResponse} from '@shopify/cli-kit/node/api/graphql'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import Bottleneck from 'bottleneck'

const ORG1 = {
  id: '1',
  businessName: 'Test Org',
}

export class ShopifyDevelopersClient implements DeveloperPlatformClient {
  private _session: PartnersSession | undefined

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('ShopifyDevelopersClient.session() should not be invoked dynamically in a unit test')
      }
      // Need to replace with actual auth
      this._session = {
        token: 'token',
        accountInfo: {
          type: 'UserAccount',
          email: 'mail@example.com',
        }
      }
    }
    return this._session
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async refreshToken(): Promise<string> {
    return this.token()
  }

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromId(_appId: string): Promise<OrganizationApp | undefined> {
    throw new AbortError('Not implemented: appFromId')
  }

  async organizations(): Promise<Organization[]> {
    return [ORG1]
  }

  async selectOrg(): Promise<Organization> {
    const organizations = await this.organizations()
    return selectOrganizationPrompt(organizations)
  }

  async orgFromId(orgId: string): Promise<Organization> {
    if (orgId === '1') return ORG1

    throw new AbortError(`Cannot fetch organization with id ${orgId}`)
  }

  async orgAndApps(orgId: string): Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>> {
    if (orgId === '1') {
      return {
        organization: ORG1,
        apps: [],
        hasMorePages: false,
      }
    } else {
      throw new AbortError(`Cannot fetch organization with id ${orgId}`)
    }
  }

  async appsForOrg(_organizationId: string, _term?: string): Promise<Paginateable<{apps: MinimalOrganizationApp[]}>> {
    return {
      apps: [],
      hasMorePages: false,
    }
  }

  async specifications(_appId: string): Promise<ExtensionSpecification[]> {
    return []
  }

  async createApp(
    org: Organization,
    name: string,
    options?: {
      isLaunchable?: boolean
      scopesArray?: string[]
      directory?: string
    },
  ): Promise<OrganizationApp> {
    const variables = createAppVars(name, options?.isLaunchable, options?.scopesArray)

    const mutation = CreateAppMutation
    const result = await developerPlatformRequest<CreateAppMutationSchema>(org.id, mutation, await this.token(), variables)
    if (result.appCreate.userErrors?.length > 0) {
      const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
      throw new AbortError(errors)
    }

    // Need to figure this out still
    const betas = filterDisabledBetas([])
    const createdApp = result.appCreate.app
    return {...createdApp, title: name, apiKey: createdApp.id, apiSecretKeys: [], grantedScopes: options?.scopesArray ?? [], organizationId: org.id, newApp: true, betas}
  }

  async devStoresForOrg(_orgId: string): Promise<OrganizationStore[]> {
    return []
  }

  async appExtensionRegistrations(_appId: string): Promise<AllAppExtensionRegistrationsQuerySchema> {
    throw new AbortError('Not implemented: appExtensionRegistrations')
  }

  async activeAppVersion(_appId: string): Promise<ActiveAppVersionQuerySchema> {
    throw new BugError('Not implemented: activeAppVersion')
  }

  async functionUploadUrl(): Promise<FunctionUploadUrlGenerateResponse> {
    throw new AbortError('Not implemented: functionUploadUrl')
  }

  async generateSignedUploadUrl(_input: GenerateSignedUploadUrlVariables): Promise<GenerateSignedUploadUrlSchema> {
    throw new AbortError('Not implemented: generateSignedUploadUrl')
  }

  async updateExtension(_input: ExtensionUpdateDraftInput): Promise<ExtensionUpdateSchema> {
    throw new AbortError('Not implemented: updateExtension')
  }

  async deploy(_input: AppDeployVariables): Promise<AppDeploySchema> {
    throw new AbortError('Not implemented: deploy')
  }
}

// API Rate limiter for partners API (Limit is 10 requests per second)
// Jobs are launched every 150ms to add an extra 50ms margin per request.
// Only 10 requests can be executed concurrently.
const limiter = new Bottleneck({
  minTime: 150,
  maxConcurrent: 10,
})

/**
 * Executes a GraphQL query against the Partners API.
 *
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
async function developerPlatformRequest<T>(orgId: string, query: string, token: string, variables?: GraphQLVariables): Promise<T> {
  const api = 'Shopify Developers'
  const fqdn = (await partnersFqdn()).replace(/^partners/, 'app.shopify')
  const url = `https://${fqdn}/organization/${orgId}/graphql`
  const result = limiter.schedule<T>(() =>
    graphqlRequest({
      query,
      api,
      url,
      token,
      variables,
      responseOptions: {onResponse: handleDeprecations},
    }),
  )

  return result
}

interface Deprecation {
  supportedUntilDate?: string
}

interface WithDeprecations {
  deprecations: Deprecation[]
}

/**
 * Sets the next deprecation date from [GraphQL response extensions](https://www.apollographql.com/docs/resources/graphql-glossary/#extensions)
 * if `response.extensions.deprecations` objects contain a `supportedUntilDate` (ISO 8601-formatted string).
 *
 * @param response - The response of the query.
 */
export function handleDeprecations<T>(response: GraphQLResponse<T>): void {
  if (!response.extensions) return

  const deprecationDates: Date[] = []
  for (const deprecation of (response.extensions as WithDeprecations).deprecations) {
    if (deprecation.supportedUntilDate) {
      deprecationDates.push(new Date(deprecation.supportedUntilDate))
    }
  }

  // setNextDeprecationDate(deprecationDates)
}

interface AppModule {
  uuid: string
  title: string
  specificationIdentifier: string
  config: string
}

// this is a temporary solution for editions to support https://vault.shopify.io/gsd/projects/31406
// read more here: https://vault.shopify.io/gsd/projects/31406
const MAGIC_URL = 'https://shopify.dev/apps/default-app-home'
// const MAGIC_REDIRECT_URL = 'https://shopify.dev/apps/default-app-home/api/auth'

function createAppVars(name: string, isLaunchable = true, scopesArray?: string[]): CreateAppMutationVariables {
  const config = isLaunchable ? {
    app_url: 'https://example.com',
    // redirect_url: ['https://example.com/api/auth'],
  } : {
    app_url: MAGIC_URL,
    // redirect_url: [MAGIC_REDIRECT_URL],
  }

  const appModules: AppModule[] = [
    {
      uuid: randomUUID(),
      title: 'home',
      specificationIdentifier: 'app_home',
      config: JSON.stringify(config)
    },
    {
      uuid: randomUUID(),
      title: 'branding',
      specificationIdentifier: 'branding',
      config: JSON.stringify({name}),
    },
  ]
  if (scopesArray && scopesArray.length > 0) {
    appModules.push({
      uuid: randomUUID(),
      title: 'app access',
      specificationIdentifier: "app_access",
      config: JSON.stringify({scopes: scopesArray}),
    })
  }

  return {appModules}
}
