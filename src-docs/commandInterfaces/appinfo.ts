export interface appinfo {
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
   * format output as JSON
   */
  '--json'?: ''

  /**
   * Outputs environment variables necessary for running and deploying web/.
   */
  '--web-env'?: ''
}
