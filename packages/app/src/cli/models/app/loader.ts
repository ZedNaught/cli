import {
  Web,
  WebConfigurationSchema,
  App,
  AppInterface,
  WebType,
  getAppScopesArray,
  AppConfigurationInterface,
  LegacyAppSchema,
  AppConfiguration,
  CurrentAppConfiguration,
  getAppVersionedSchema,
  isCurrentAppSchema,
} from './app.js'
import {configurationFileNames, dotEnvFileNames} from '../../constants.js'
import metadata from '../../metadata.js'
import {ExtensionInstance} from '../extensions/extension-instance.js'
import {ExtensionsArraySchema, UnifiedSchema} from '../extensions/schemas.js'
import {ExtensionSpecification} from '../extensions/specification.js'
import {getCachedAppInfo} from '../../services/local-storage.js'
import use from '../../services/app/config/use.js'
import {loadLocalExtensionsSpecifications} from '../extensions/load-specifications.js'
import {BetaFlag} from '../../services/dev/fetch.js'
import {deepStrict, zod} from '@shopify/cli-kit/node/schema'
import {fileExists, readFile, glob, findPathUp, fileExistsSync} from '@shopify/cli-kit/node/fs'
import {readAndParseDotEnv, DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {
  getDependencies,
  getPackageManager,
  getPackageName,
  usesWorkspaces as appUsesWorkspaces,
} from '@shopify/cli-kit/node/node-package-manager'
import {resolveFramework} from '@shopify/cli-kit/node/framework'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import {joinPath, dirname, basename, relativePath, relativizePath} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputDebug, OutputMessage, outputToken} from '@shopify/cli-kit/node/output'
import {joinWithAnd, slugify} from '@shopify/cli-kit/common/string'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {checkIfIgnoredInGitRepository} from '@shopify/cli-kit/node/git'

const defaultExtensionDirectory = 'extensions/*'

export type AppLoaderMode = 'strict' | 'report'

type AbortOrReport = <T>(
  errorMessage: OutputMessage,
  fallback: T,
  configurationPath: string,
  rawErrors?: zod.ZodIssueBase[],
) => T
const noopAbortOrReport: AbortOrReport = (errorMessage, fallback, configurationPath) => fallback

export async function loadConfigurationFile(
  filepath: string,
  abortOrReport: AbortOrReport = (errorMessage) => {
    throw new AbortError(errorMessage)
  },
  decode: (input: string) => object = decodeToml,
): Promise<unknown> {
  if (!(await fileExists(filepath))) {
    return abortOrReport(
      outputContent`Couldn't find the configuration file at ${outputToken.path(filepath)}`,
      '',
      filepath,
    )
  }

  try {
    const configurationContent = await readFile(filepath)
    return decode(configurationContent)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // TOML errors have line, pos and col properties
    if (err.line && err.pos && err.col) {
      return abortOrReport(
        outputContent`Fix the following error in ${outputToken.path(filepath)}:\n${err.message}`,
        null,
        filepath,
      )
    } else {
      throw err
    }
  }
}

export async function parseConfigurationFile<TSchema extends zod.ZodType>(
  schema: TSchema,
  filepath: string,
  abortOrReport: AbortOrReport = (errorMessage) => {
    throw new AbortError(errorMessage)
  },
  decode: (input: string) => object = decodeToml,
): Promise<zod.TypeOf<TSchema> & {path: string}> {
  const fallbackOutput = {} as zod.TypeOf<TSchema>

  const configurationObject = await loadConfigurationFile(filepath, abortOrReport, decode)

  if (!configurationObject) return fallbackOutput

  const configuration = await parseConfigurationObject(schema, filepath, configurationObject, abortOrReport)
  return {...configuration, path: filepath}
}

export async function parseConfigurationObject<TSchema extends zod.ZodType>(
  schema: TSchema,
  filepath: string,
  configurationObject: unknown,
  abortOrReport: AbortOrReport,
): Promise<zod.TypeOf<TSchema>> {
  const fallbackOutput = {} as zod.TypeOf<TSchema>

  const parseResult = schema.safeParse(configurationObject)
  if (!parseResult.success) {
    const formattedError = JSON.stringify(parseResult.error.issues, null, 2)
    return abortOrReport(
      outputContent`Fix a schema error in ${outputToken.path(filepath)}:\n${formattedError}`,
      fallbackOutput,
      filepath,
      parseResult.error.issues,
    )
  }
  return parseResult.data
}

export function findSpecificationForType(specifications: ExtensionSpecification[], type: string) {
  return specifications.find(
    (spec) =>
      spec.identifier === type || spec.externalIdentifier === type || spec.additionalIdentifiers?.includes(type),
  )
}

export class AppErrors {
  private errors: {
    [key: string]: OutputMessage
  } = {}

  addError(path: string, message: OutputMessage): void {
    this.errors[path] = message
  }

  getError(path: string) {
    return this.errors[path]
  }

  isEmpty() {
    return Object.keys(this.errors).length === 0
  }

  toJSON(): OutputMessage[] {
    return Object.values(this.errors)
  }
}

interface AppLoaderConstructorArgs {
  directory: string
  mode?: AppLoaderMode
  configName?: string
  specifications?: ExtensionSpecification[]
  remoteBetas?: BetaFlag[]
}

/**
 * Load the local app from the given directory and using the provided extensions/functions specifications.
 * If the App contains extensions not supported by the current specs and mode is strict, it will throw an error.
 */
export async function loadApp(options: AppLoaderConstructorArgs): Promise<AppInterface> {
  const loader = new AppLoader(options)
  return loader.loaded()
}

export function getDotEnvFileName(configurationPath: string) {
  const configurationShorthand: string | undefined = getAppConfigurationShorthand(configurationPath)
  return configurationShorthand ? `${dotEnvFileNames.production}.${configurationShorthand}` : dotEnvFileNames.production
}

export async function loadDotEnv(appDirectory: string, configurationPath: string): Promise<DotEnvFile | undefined> {
  let dotEnvFile: DotEnvFile | undefined
  const dotEnvPath = joinPath(appDirectory, getDotEnvFileName(configurationPath))
  if (await fileExists(dotEnvPath)) {
    dotEnvFile = await readAndParseDotEnv(dotEnvPath)
  }
  return dotEnvFile
}

class AppLoader {
  private directory: string
  private mode: AppLoaderMode
  private configName?: string
  private errors: AppErrors = new AppErrors()
  private specifications: ExtensionSpecification[]
  private remoteBetas: BetaFlag[]

  constructor({directory, configName, mode, specifications, remoteBetas}: AppLoaderConstructorArgs) {
    this.mode = mode ?? 'strict'
    this.directory = directory
    this.specifications = specifications ?? []
    this.configName = configName
    this.remoteBetas = remoteBetas ?? []
  }

  findSpecificationForType(type: string) {
    return findSpecificationForType(this.specifications, type)
  }

  parseConfigurationFile<TSchema extends zod.ZodType>(
    schema: TSchema,
    filepath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decode: (input: any) => any = decodeToml,
  ) {
    return parseConfigurationFile(schema, filepath, this.abortOrReport.bind(this), decode)
  }

  async loaded() {
    const configurationLoader = new AppConfigurationLoader({
      directory: this.directory,
      configName: this.configName,
      specifications: this.specifications,
    })
    const {directory, configuration, configurationLoadResultMetadata, configSchema} = await configurationLoader.loaded()
    await logMetadataFromAppLoadingProcess(configurationLoadResultMetadata)

    const dotenv = await loadDotEnv(directory, configuration.path)

    const extensions = await this.loadExtensions(directory, configuration)

    const packageJSONPath = joinPath(directory, 'package.json')
    const name = await loadAppName(directory)
    const nodeDependencies = await getDependencies(packageJSONPath)
    const packageManager = await getPackageManager(directory)
    const {webs, usedCustomLayout: usedCustomLayoutForWeb} = await this.loadWebs(
      directory,
      configuration.web_directories,
    )
    const usesWorkspaces = await appUsesWorkspaces(directory)

    const appClass = new App({
      name,
      idEnvironmentVariableName: 'SHOPIFY_API_KEY',
      directory,
      packageManager,
      configuration,
      nodeDependencies,
      webs,
      modules: extensions,
      usesWorkspaces,
      dotenv,
      specifications: this.specifications,
      configSchema,
      remoteBetaFlags: this.remoteBetas,
    })

    if (!this.errors.isEmpty()) appClass.errors = this.errors

    await logMetadataForLoadedApp(appClass, {
      usedCustomLayoutForWeb,
      usedCustomLayoutForExtensions: configuration.extension_directories !== undefined,
    })

    return appClass
  }

  async loadWebs(appDirectory: string, webDirectories?: string[]): Promise<{webs: Web[]; usedCustomLayout: boolean}> {
    const defaultWebDirectory = '**'
    const webConfigGlobs = [...(webDirectories ?? [defaultWebDirectory])].map((webGlob) => {
      return joinPath(appDirectory, webGlob, configurationFileNames.web)
    })
    webConfigGlobs.push(`!${joinPath(appDirectory, '**/node_modules/**')}`)
    const webTomlPaths = await glob(webConfigGlobs)

    const webs = await Promise.all(webTomlPaths.map((path) => this.loadWeb(path)))
    this.validateWebs(webs)

    const webTomlsInStandardLocation = await glob(joinPath(appDirectory, `web/**/${configurationFileNames.web}`))
    const usedCustomLayout = webDirectories !== undefined || webTomlsInStandardLocation.length !== webTomlPaths.length

    return {webs, usedCustomLayout}
  }

  validateWebs(webs: Web[]): void {
    ;[WebType.Backend, WebType.Frontend].forEach((webType) => {
      const websOfType = webs.filter((web) => web.configuration.roles.includes(webType))
      if (websOfType.length > 1) {
        this.abortOrReport(
          outputContent`You can only have one web with the ${outputToken.yellow(webType)} role in your app`,
          undefined,
          joinPath(websOfType[1]!.directory, configurationFileNames.web),
        )
      }
    })
  }

  async loadWeb(WebConfigurationFile: string): Promise<Web> {
    const config = await this.parseConfigurationFile(WebConfigurationSchema, WebConfigurationFile)
    const roles = new Set('roles' in config ? config.roles : [])
    if ('type' in config) roles.add(config.type)
    const {type, ...processedWebConfiguration} = {...config, roles: Array.from(roles), type: undefined}
    return {
      directory: dirname(WebConfigurationFile),
      configuration: processedWebConfiguration,
      framework: await resolveFramework(dirname(WebConfigurationFile)),
    }
  }

  async createExtensionInstance(
    type: string,
    configurationObject: unknown,
    configurationPath: string,
    directory: string,
  ): Promise<ExtensionInstance | undefined> {
    const specification = findSpecificationForType(this.specifications, type)
    if (!specification) {
      return this.abortOrReport(
        outputContent`Invalid extension type "${type}" in "${relativizePath(configurationPath)}"`,
        undefined,
        configurationPath,
      )
    }

    const configuration = await parseConfigurationObject(
      specification.schema,
      configurationPath,
      configurationObject,
      this.abortOrReport.bind(this),
    )

    const entryPath = await this.findEntryPath(directory, specification)

    const extensionInstance = new ExtensionInstance({
      configuration,
      configurationPath,
      entryPath,
      directory,
      specification,
    })

    const validateResult = await extensionInstance.validate()
    if (validateResult.isErr()) {
      this.abortOrReport(outputContent`\n${validateResult.error}`, undefined, configurationPath)
    }
    return extensionInstance
  }

  async loadExtensions(appDirectory: string, appConfiguration: AppConfiguration): Promise<ExtensionInstance[]> {
    if (this.specifications.length === 0) return []

    const extensionPromises = await this.createExtensionInstances(appDirectory, appConfiguration.extension_directories)
    const configExtensionPromises = isCurrentAppSchema(appConfiguration)
      ? await this.createConfigExtensionInstances(appDirectory, appConfiguration)
      : []

    const extensions = await Promise.all([...extensionPromises, ...configExtensionPromises])
    const allExtensions = getArrayRejectingUndefined(extensions.flat())

    // Validate that all extensions have a unique handle.
    const handles = new Set()
    allExtensions.forEach((extension) => {
      if (extension.handle && handles.has(extension.handle)) {
        const matchingExtensions = allExtensions.filter((ext) => ext.handle === extension.handle)
        const result = joinWithAnd(matchingExtensions.map((ext) => ext.configuration.name))
        const handle = outputToken.cyan(extension.handle)

        this.abortOrReport(
          outputContent`Duplicated handle "${handle}" in extensions ${result}. Handle needs to be unique per extension.`,
          undefined,
          extension.configurationPath,
        )
      } else if (extension.handle) {
        handles.add(extension.handle)
      }
    })

    return allExtensions
  }

  async createExtensionInstances(appDirectory: string, extensionDirectories?: string[]) {
    const extensionConfigPaths = [...(extensionDirectories ?? [defaultExtensionDirectory])].map((extensionPath) => {
      return joinPath(appDirectory, extensionPath, '*.extension.toml')
    })
    extensionConfigPaths.push(`!${joinPath(appDirectory, '**/node_modules/**')}`)
    const configPaths = await glob(extensionConfigPaths)

    return configPaths.map(async (configurationPath) => {
      const directory = dirname(configurationPath)
      const obj = await loadConfigurationFile(configurationPath)
      const {extensions, type} = ExtensionsArraySchema.parse(obj)

      if (extensions) {
        // If the extension is an array, it's a unified toml file.
        // Parse all extensions by merging each extension config with the global unified configuration.
        const configuration = await this.parseConfigurationFile(UnifiedSchema, configurationPath)
        const extensionsInstancesPromises = configuration.extensions.map(async (extensionConfig) => {
          const mergedConfig = {...configuration, ...extensionConfig}
          const {extensions, ...restConfig} = mergedConfig
          if (!restConfig.handle) {
            // Handle is required for unified config extensions.
            this.abortOrReport(
              outputContent`Missing handle for extension "${restConfig.name}" at ${relativePath(
                appDirectory,
                configurationPath,
              )}`,
              undefined,
              configurationPath,
            )
            restConfig.handle = 'unknown-handle'
          }
          return this.createExtensionInstance(mergedConfig.type, restConfig, configurationPath, directory)
        })
        return Promise.all(extensionsInstancesPromises)
      } else if (type) {
        // Legacy toml file with a single extension.
        return this.createExtensionInstance(type, obj, configurationPath, directory)
      } else {
        return this.abortOrReport(
          outputContent`Invalid extension type at "${outputToken.path(
            relativePath(appDirectory, configurationPath),
          )}". Please specify a type.`,
          undefined,
          configurationPath,
        )
      }
    })
  }

  async createConfigExtensionInstances(directory: string, appConfiguration: CurrentAppConfiguration) {
    return this.specifications
      .filter((specification) => specification.experience === 'configuration')
      .map(async (specification) => {
        const specConfiguration = await parseConfigurationObject(
          specification.schema,
          appConfiguration.path,
          appConfiguration,
          this.abortOrReport.bind(this),
        )

        if (Object.keys(specConfiguration).length === 0) return

        return this.createExtensionInstance(
          specification.identifier,
          specConfiguration,
          appConfiguration.path,
          directory,
        ).then((extensionInstance) =>
          this.validateConfigurationExtensionInstance(appConfiguration.client_id, extensionInstance),
        )
      })
  }

  async validateConfigurationExtensionInstance(apiKey: string, extensionInstance?: ExtensionInstance) {
    if (!extensionInstance) return

    const configContent = await extensionInstance.commonDeployConfig(apiKey)
    return configContent ? extensionInstance : undefined
  }

  async findEntryPath(directory: string, specification: ExtensionSpecification) {
    let entryPath
    if (specification.appModuleFeatures().includes('single_js_entry_path')) {
      entryPath = (
        await Promise.all(
          ['index']
            .flatMap((name) => [`${name}.js`, `${name}.jsx`, `${name}.ts`, `${name}.tsx`])
            .flatMap((fileName) => [`src/${fileName}`, `${fileName}`])
            .map((relativePath) => joinPath(directory, relativePath))
            .map(async (sourcePath) => ((await fileExists(sourcePath)) ? sourcePath : undefined)),
        )
      ).find((sourcePath) => sourcePath !== undefined)
      if (!entryPath) {
        this.abortOrReport(
          outputContent`Couldn't find an index.{js,jsx,ts,tsx} file in the directories ${outputToken.path(
            directory,
          )} or ${outputToken.path(joinPath(directory, 'src'))}`,
          undefined,
          directory,
        )
      }
    } else if (specification.identifier === 'function') {
      entryPath = (
        await Promise.all(
          ['src/index.js', 'src/index.ts', 'src/main.rs']
            .map((relativePath) => joinPath(directory, relativePath))
            .map(async (sourcePath) => ((await fileExists(sourcePath)) ? sourcePath : undefined)),
        )
      ).find((sourcePath) => sourcePath !== undefined)
    }
    return entryPath
  }

  abortOrReport<T>(errorMessage: OutputMessage, fallback: T, configurationPath: string): T {
    if (this.mode === 'strict') {
      throw new AbortError(errorMessage)
    } else {
      this.errors.addError(configurationPath, errorMessage)
      return fallback
    }
  }
}

/**
 * Parse the app configuration file from the given directory.
 * If the app configuration does not match any known schemas, it will throw an error.
 */
export async function loadAppConfiguration(
  options: AppConfigurationLoaderConstructorArgs,
): Promise<AppConfigurationInterface> {
  const loader = new AppConfigurationLoader(options)
  const result = await loader.loaded()
  await logMetadataFromAppLoadingProcess(result.configurationLoadResultMetadata)
  return result
}

interface AppConfigurationLoaderConstructorArgs {
  directory: string
  configName?: string
  specifications?: ExtensionSpecification[]
  remoteBetas?: BetaFlag[]
}

type LinkedConfigurationSource =
  // Config file was passed via a flag to a command
  | 'flag'
  // Config file came from the cache (i.e. app use)
  | 'cached'

type ConfigurationLoadResultMetadata = {
  allClientIdsByConfigName: {[key: string]: string}
} & (
  | {
      usesLinkedConfig: false
    }
  | {
      usesLinkedConfig: true
      name: string
      gitTracked: boolean
      source: LinkedConfigurationSource
      usesCliManagedUrls?: boolean
    }
)

class AppConfigurationLoader {
  private directory: string
  private configName?: string
  private specifications?: ExtensionSpecification[]
  private remoteBetas: BetaFlag[]

  constructor({directory, configName, specifications, remoteBetas}: AppConfigurationLoaderConstructorArgs) {
    this.directory = directory
    this.configName = configName
    this.specifications = specifications
    this.remoteBetas = remoteBetas ?? []
  }

  async loaded() {
    const specifications = this.specifications ?? (await loadLocalExtensionsSpecifications())
    const appDirectory = await this.getAppDirectory()
    const configSource: LinkedConfigurationSource = this.configName ? 'flag' : 'cached'
    const cachedCurrentConfig = getCachedAppInfo(appDirectory)?.configFile
    const cachedCurrentConfigPath = cachedCurrentConfig ? joinPath(appDirectory, cachedCurrentConfig) : null

    if (!this.configName && cachedCurrentConfigPath && !fileExistsSync(cachedCurrentConfigPath)) {
      const warningContent = {
        headline: `Couldn't find ${cachedCurrentConfig}`,
        body: [
          "If you have multiple config files, select a new one. If you only have one config file, it's been selected as your default.",
        ],
      }
      this.configName = await use({directory: appDirectory, warningContent, shouldRenderSuccess: false})
    }

    this.configName = this.configName ?? cachedCurrentConfig

    const {configurationPath, configurationFileName} = await this.getConfigurationPath(appDirectory)
    const file = await loadConfigurationFile(configurationPath)
    const appVersionedSchema = getAppVersionedSchema(specifications)
    const appSchema = isCurrentAppSchema(file as AppConfiguration) ? appVersionedSchema : LegacyAppSchema
    const parseStrictSchemaEnabled = specifications.length > 0
    const configuration = await parseConfigurationFile(
      parseStrictSchemaEnabled ? deepStrict(appSchema) : appSchema,
      configurationPath,
    )
    const allClientIdsByConfigName = await this.getAllLinkedConfigClientIds(appDirectory)

    let configurationLoadResultMetadata: ConfigurationLoadResultMetadata = {
      usesLinkedConfig: false,
      allClientIdsByConfigName,
    }

    if (isCurrentAppSchema(configuration)) {
      let gitTracked = false
      try {
        gitTracked = !(await checkIfIgnoredInGitRepository(appDirectory, [configurationPath]))[0]
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch {
        // leave as false
      }

      configurationLoadResultMetadata = {
        ...configurationLoadResultMetadata,
        usesLinkedConfig: true,
        name: configurationFileName,
        gitTracked,
        source: configSource,
        usesCliManagedUrls: configuration.build?.automatically_update_urls_on_dev,
      }
    }

    return {directory: appDirectory, configuration, configurationLoadResultMetadata, configSchema: appVersionedSchema}
  }

  // Sometimes we want to run app commands from a nested folder (for example within an extension). So we need to
  // traverse up the filesystem to find the root app directory.
  async getAppDirectory() {
    if (!(await fileExists(this.directory))) {
      throw new AbortError(outputContent`Couldn't find directory ${outputToken.path(this.directory)}`)
    }

    // In order to find the chosen config for the app, we need to find the directory of the app.
    // But we can't know the chosen config because the cache key is the directory itself. So we
    // look for all possible `shopify.app.*toml` files and stop at the first directory that contains one.
    const appDirectory = await findPathUp(
      async (directory) => {
        const found = await glob(joinPath(directory, appConfigurationFileNameGlob))
        if (found.length > 0) {
          return directory
        }
      },
      {
        cwd: this.directory,
        type: 'directory',
      },
    )

    if (appDirectory) {
      return appDirectory
    } else {
      throw new AbortError(
        outputContent`Couldn't find the configuration file for ${outputToken.path(
          this.directory,
        )}, are you in an app directory?`,
      )
    }
  }

  async getConfigurationPath(appDirectory: string) {
    const configurationFileName = getAppConfigurationFileName(this.configName)
    const configurationPath = joinPath(appDirectory, configurationFileName)

    if (await fileExists(configurationPath)) {
      return {configurationPath, configurationFileName}
    } else {
      throw new AbortError(
        outputContent`Couldn't find ${configurationFileName} in ${outputToken.path(this.directory)}.`,
      )
    }
  }

  /**
   * Looks for all likely linked config files in the app folder, parses, and returns a mapping of name to client ID.
   */
  async getAllLinkedConfigClientIds(appDirectory: string): Promise<{[key: string]: string}> {
    const configNamesToClientId: {[key: string]: string} = {}
    const candidates = await glob(joinPath(appDirectory, appConfigurationFileNameGlob))

    const entries = (
      await Promise.all(
        candidates.map(async (candidateFile) => {
          try {
            const configuration = await parseConfigurationFile(
              // we only care about the client ID, so no need to parse the entire file
              zod.object({client_id: zod.string().optional()}),
              candidateFile,
              // we're not interested in error reporting at all
              noopAbortOrReport,
            )
            if (configuration.client_id !== undefined) {
              configNamesToClientId[basename(candidateFile)] = configuration.client_id
              return [basename(candidateFile), configuration.client_id] as [string, string]
            }
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch {
            // can ignore errors in parsing
          }
        }),
      )
    ).filter((entry) => entry !== undefined) as [string, string][]
    return Object.fromEntries(entries)
  }
}

export async function loadAppName(appDirectory: string): Promise<string> {
  const packageJSONPath = joinPath(appDirectory, 'package.json')
  return (await getPackageName(packageJSONPath)) ?? basename(appDirectory)
}

async function getProjectType(webs: Web[]): Promise<'node' | 'php' | 'ruby' | 'frontend' | undefined> {
  const backendWebs = webs.filter((web) => isWebType(web, WebType.Backend))
  const frontendWebs = webs.filter((web) => isWebType(web, WebType.Frontend))
  if (backendWebs.length > 1) {
    outputDebug('Unable to decide project type as multiple web backends')
    return
  } else if (backendWebs.length === 0 && frontendWebs.length > 0) {
    return 'frontend'
  } else if (backendWebs.length === 0) {
    outputDebug('Unable to decide project type as no web backend')
    return
  }
  const {directory} = backendWebs[0]!

  const nodeConfigFile = joinPath(directory, 'package.json')
  const rubyConfigFile = joinPath(directory, 'Gemfile')
  const phpConfigFile = joinPath(directory, 'composer.json')

  if (await fileExists(nodeConfigFile)) {
    return 'node'
  } else if (await fileExists(rubyConfigFile)) {
    return 'ruby'
  } else if (await fileExists(phpConfigFile)) {
    return 'php'
  }
  return undefined
}

export function isWebType(web: Web, type: WebType): boolean {
  return web.configuration.roles.includes(type)
}

async function logMetadataForLoadedApp(
  app: App,
  loadingStrategy: {
    usedCustomLayoutForWeb: boolean
    usedCustomLayoutForExtensions: boolean
  },
) {
  await metadata.addPublicMetadata(async () => {
    const projectType = await getProjectType(app.webs)

    const extensionsToAddToMetrics = app.allExtensions.filter((ext) => ext.isSentToMetrics())
    const extensionFunctionCount = extensionsToAddToMetrics.filter((extension) => extension.isFunctionExtension).length
    const extensionUICount = extensionsToAddToMetrics.filter((extension) => extension.isESBuildExtension).length
    const extensionThemeCount = extensionsToAddToMetrics.filter((extension) => extension.isThemeExtension).length

    const extensionTotalCount = extensionsToAddToMetrics.length

    const webBackendCount = app.webs.filter((web) => isWebType(web, WebType.Backend)).length
    const webBackendFramework =
      webBackendCount === 1 ? app.webs.filter((web) => isWebType(web, WebType.Backend))[0]?.framework : undefined
    const webFrontendCount = app.webs.filter((web) => isWebType(web, WebType.Frontend)).length

    const extensionsBreakdownMapping: {[key: string]: number} = {}
    for (const extension of extensionsToAddToMetrics) {
      if (extensionsBreakdownMapping[extension.type] === undefined) {
        extensionsBreakdownMapping[extension.type] = 1
      } else {
        extensionsBreakdownMapping[extension.type]++
      }
    }

    return {
      project_type: projectType,
      app_extensions_any: extensionTotalCount > 0,
      app_extensions_breakdown: JSON.stringify(extensionsBreakdownMapping),
      app_extensions_count: extensionTotalCount,
      app_extensions_custom_layout: loadingStrategy.usedCustomLayoutForExtensions,
      app_extensions_function_any: extensionFunctionCount > 0,
      app_extensions_function_count: extensionFunctionCount,
      app_extensions_theme_any: extensionThemeCount > 0,
      app_extensions_theme_count: extensionThemeCount,
      app_extensions_ui_any: extensionUICount > 0,
      app_extensions_ui_count: extensionUICount,
      app_name_hash: hashString(app.name),
      app_path_hash: hashString(app.directory),
      app_scopes: JSON.stringify(getAppScopesArray(app.configuration).sort()),
      app_web_backend_any: webBackendCount > 0,
      app_web_backend_count: webBackendCount,
      app_web_custom_layout: loadingStrategy.usedCustomLayoutForWeb,
      app_web_framework: webBackendFramework,
      app_web_frontend_any: webFrontendCount > 0,
      app_web_frontend_count: webFrontendCount,
      env_package_manager_workspaces: app.usesWorkspaces,
    }
  })

  await metadata.addSensitiveMetadata(async () => {
    return {
      app_name: app.name,
    }
  })
}

async function logMetadataFromAppLoadingProcess(loadMetadata: ConfigurationLoadResultMetadata) {
  await metadata.addPublicMetadata(async () => {
    return {
      // Generic config as code instrumentation
      cmd_app_all_configs_any: Object.keys(loadMetadata.allClientIdsByConfigName).length > 0,
      cmd_app_all_configs_clients: JSON.stringify(loadMetadata.allClientIdsByConfigName),
      cmd_app_linked_config_used: loadMetadata.usesLinkedConfig,
      ...(loadMetadata.usesLinkedConfig
        ? {
            cmd_app_linked_config_name: loadMetadata.name,
            cmd_app_linked_config_git_tracked: loadMetadata.gitTracked,
            cmd_app_linked_config_source: loadMetadata.source,
            cmd_app_linked_config_uses_cli_managed_urls: loadMetadata.usesCliManagedUrls,
          }
        : {}),
    }
  })
}

export const appConfigurationFileNameRegex = /^shopify\.app(\.[-\w]+)?\.toml$/
const appConfigurationFileNameGlob = 'shopify.app*.toml'

export function getAppConfigurationFileName(configName?: string) {
  if (!configName) {
    return configurationFileNames.app
  }

  if (appConfigurationFileNameRegex.test(configName)) {
    return configName
  } else {
    return `shopify.app.${slugify(configName)}.toml`
  }
}

export function getAppConfigurationShorthand(path: string) {
  const match = basename(path).match(appConfigurationFileNameRegex)
  return match?.[1]?.slice(1)
}
