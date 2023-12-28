export interface apprelease {
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
   * Release without asking for confirmation.
   */
  '-f, --force'?: ''

  /**
   * The name of the app version to release.
   */
  '--version <value>': string
}
