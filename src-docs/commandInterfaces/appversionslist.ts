export interface appversionslist {
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
   * The Client ID to fetch versions for.
   */
  '--client-id <value>'?: string

  /**
   * Output the versions list as JSON.
   */
  '--json'?: ''
}
