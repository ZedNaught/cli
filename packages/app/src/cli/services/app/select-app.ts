import {OrganizationApp} from '../../models/organization.js'
import {selectOrganizationPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {Flag} from '../dev/fetch.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {AppModuleVersion} from '../../api/graphql/app_active_version.js'
import {buildSpecsAppConfiguration} from '../../models/app/app.js'
import {SpecsAppConfiguration} from '../../models/extensions/specifications/types/app_config.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'

export async function selectApp(): Promise<OrganizationApp> {
  const developerPlatformClient = selectDeveloperPlatformClient()
  const orgs = await developerPlatformClient.organizations()
  const org = await selectOrganizationPrompt(orgs)
  const {apps, hasMorePages} = await developerPlatformClient.appsForOrg(org.id)
  const selectedAppApiKey = await selectAppPrompt(apps, hasMorePages, org.id, {developerPlatformClient})
  const fullSelectedApp = await developerPlatformClient.appFromId(selectedAppApiKey)
  return fullSelectedApp!
}

export async function fetchAppRemoteConfiguration(
  apiKey: string,
  developerPlatformClient: DeveloperPlatformClient,
  specifications: ExtensionSpecification[],
  flags: Flag[],
) {
  const activeAppVersion = await developerPlatformClient.activeAppVersion(apiKey)
  const appModuleVersionsConfig =
    activeAppVersion.app.activeAppVersion?.appModuleVersions.filter(
      (module) => module.specification?.experience === 'configuration',
    ) || []
  const remoteAppConfiguration = remoteAppConfigurationExtensionContent(appModuleVersionsConfig, specifications, flags)
  return buildSpecsAppConfiguration(remoteAppConfiguration) as SpecsAppConfiguration
}

export function remoteAppConfigurationExtensionContent(
  configRegistrations: AppModuleVersion[],
  specifications: ExtensionSpecification[],
  flags: Flag[],
) {
  let remoteAppConfig: {[key: string]: unknown} = {}
  const configSpecifications = specifications.filter((spec) => spec.experience === 'configuration')
  configRegistrations.forEach((module) => {
    const configSpec = configSpecifications.find(
      (spec) => spec.identifier === module.specification?.identifier.toLowerCase(),
    )
    if (!configSpec) return
    const configString = module.config
    if (!configString) return
    const config = configString ? JSON.parse(configString) : {}

    remoteAppConfig = deepMergeObjects(remoteAppConfig, configSpec.reverseTransform?.(config, {flags}) ?? config)
  })
  return {...remoteAppConfig}
}
