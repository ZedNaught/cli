export interface appdeploy {
  /**
   * Disable color output.
   */
  '--no-color'?: ''

  /**
   * Increase the verbosity of the logs.
   */
  '--verbose'?: ''

  /**
   * The path to your app directory.
   */
  '--path <value>'?: string

  /**
   * The name of the app configuration.
   */
  '-c, --config <value>'?: string

  /**
   * The Client ID of your app.
   */
  '--client-id <value>'?: string

  /**
   * Reset all your settings.
   */
  '--reset'?: ''

  /**
   * Deploy without asking for confirmation.
   */
  '-f, --force'?: ''

  /**
   * Creates a version but doesn't release it - it's not made available to merchants.
   */
  '--no-release'?: ''

  /**
   * Optional message that will be associated with this version. This is for internal use only and won't be available externally.
   */
  '--message <value>'?: string

  /**
   * Optional version tag that will be associated with this app version. If not provided, an auto-generated identifier will be generated for this app version.
   */
  '--version <value>'?: string

  /**
   * URL associated with the new app version.
   */
  '--source-control-url <value>'?: string
}
